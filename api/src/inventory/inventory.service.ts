import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { Product } from '../products/entities/product.entity';
import {
  AdjustmentDto,
  ListInventoryDto,
  ListMovementsDto,
  ListReservationsDto,
  ReservationDto,
  StockOperationDto,
} from './dto/inventory.dto';
import { InventoryBalance } from './entities/inventory-balance.entity';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { InventoryReservation } from './entities/inventory-reservation.entity';
import {
  InventoryMovementType,
  InventoryReferenceType,
  InventoryReservationStatus,
} from './enums/inventory.enums';
export const units = (v: string) => {
  if (!/^(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?$/.test(v))
    throw new BadRequestException('Quantidade inválida');
  const [a, b = ''] = v.split('.');
  return BigInt(a) * 1000n + BigInt((b + '000').slice(0, 3));
};
export const decimal = (v: bigint) =>
  `${v / 1000n}.${(v % 1000n).toString().padStart(3, '0')}`;
@Injectable()
export class InventoryService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @InjectRepository(InventoryBalance)
    private readonly balances: Repository<InventoryBalance>,
    @InjectRepository(InventoryMovement)
    private readonly movements: Repository<InventoryMovement>,
    @InjectRepository(InventoryReservation)
    private readonly reservations: Repository<InventoryReservation>,
  ) {}
  async getBalance(companyId: string, productId: string) {
    const product = await this.product(this.db.manager, companyId, productId);
    let balance = await this.balances.findOneBy({ companyId, productId });
    if (!balance) {
      try {
        balance = await this.balances.save(
          this.balances.create({
            companyId,
            productId,
            currentQuantity: '0',
            reservedQuantity: '0',
          }),
        );
      } catch {
        balance = await this.balances.findOneBy({ companyId, productId });
      }
    }
    if (!balance)
      throw new ConflictException('Não foi possível inicializar o saldo');
    return this.view(balance, product);
  }
  async listBalances(companyId: string, q: ListInventoryDto) {
    await this.ensureCompanyBalances(companyId);
    const qb = this.balances
      .createQueryBuilder('b')
      .innerJoinAndSelect('b.product', 'p', 'p.company_id=b.company_id')
      .where('b.company_id=:companyId', { companyId });
    if (q.search)
      qb.andWhere('(p.sku ILIKE :s OR p.name ILIKE :s OR p.barcode ILIKE :s)', {
        s: `%${q.search}%`,
      });
    if (q.productId) qb.andWhere('p.id=:productId', { productId: q.productId });
    if (q.categoryId)
      qb.andWhere('p.category_id=:categoryId', { categoryId: q.categoryId });
    if (q.status) qb.andWhere('p.status=:status', { status: q.status });
    if (q.belowMinimum === 'true')
      qb.andWhere('(b.current_quantity-b.reserved_quantity)<=p.minimum_stock');
    if (q.withReservation === 'true') qb.andWhere('b.reserved_quantity>0');
    const sort: Record<string, string> = {
      sku: 'p.sku',
      name: 'p.name',
      currentQuantity: 'b.current_quantity',
      reservedQuantity: 'b.reserved_quantity',
      availableQuantity: '(b.current_quantity-b.reserved_quantity)',
      minimumStock: 'p.minimum_stock',
      updatedAt: 'b.updated_at',
    };
    qb.orderBy(sort[q.sortBy], q.sortDirection.toUpperCase() as 'ASC' | 'DESC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit);
    const [entities, total] = await qb.getManyAndCount();
    return {
      data: entities.map((b) => this.view(b, b.product)),
      meta: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    };
  }
  async summary(companyId: string) {
    await this.ensureCompanyBalances(companyId);
    const rows = await this.balances
      .createQueryBuilder('b')
      .innerJoin(Product, 'p', 'p.id=b.product_id')
      .select('COUNT(*)', 'totalProducts')
      .addSelect(
        'COUNT(*) FILTER (WHERE b.current_quantity-b.reserved_quantity<=p.minimum_stock)',
        'belowMinimum',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE b.reserved_quantity>0)',
        'withReservation',
      )
      .where('b.company_id=:companyId', { companyId })
      .getRawOne<{
        totalProducts: string;
        belowMinimum: string;
        withReservation: string;
      }>();
    return (
      rows ?? { totalProducts: '0', belowMinimum: '0', withReservation: '0' }
    );
  }
  entry(c: string, u: string, d: StockOperationDto, k: string) {
    return this.change(c, u, d, k, InventoryMovementType.ENTRY, 1);
  }
  exit(c: string, u: string, d: StockOperationDto, k: string) {
    return this.change(c, u, d, k, InventoryMovementType.EXIT, -1);
  }
  async adjust(c: string, u: string, d: AdjustmentDto, k: string) {
    return this.transaction(c, u, d.productId, k, d, async (m, b) => {
      const before = units(b.currentQuantity),
        reserved = units(b.reservedQuantity),
        target = units(d.countedQuantity);
      if (target === before)
        throw new ConflictException(
          'Nenhuma alteração de saldo foi necessária.',
        );
      if (target < reserved)
        throw new ConflictException(
          'O ajuste não pode deixar o saldo abaixo da quantidade reservada.',
        );
      return this.persist(
        m,
        b,
        u,
        target > before
          ? InventoryMovementType.ADJUSTMENT_INCREASE
          : InventoryMovementType.ADJUSTMENT_DECREASE,
        target > before ? target - before : before - target,
        target,
        reserved,
        d.reason,
        d.notes,
        k,
        null,
        null,
      );
    });
  }
  async createReservation(c: string, u: string, d: ReservationDto, k: string) {
    return this.transaction(c, u, d.productId, k, d, async (m, b) => {
      const qty = units(d.quantity),
        current = units(b.currentQuantity),
        reserved = units(b.reservedQuantity);
      if (qty <= 0n || qty > current - reserved)
        throw new ConflictException(
          'A quantidade reservada é maior que o saldo disponível.',
        );
      const existing = await m.findOneBy(InventoryReservation, {
        companyId: c,
        productId: d.productId,
        referenceType: d.referenceType,
        referenceId: d.referenceId,
      });
      if (existing) throw new ConflictException('Esta reserva já existe.');
      const movement = await this.persist(
        m,
        b,
        u,
        InventoryMovementType.RESERVATION,
        qty,
        current,
        reserved + qty,
        d.reason,
        d.notes,
        k,
        d.referenceType,
        d.referenceId,
      );
      const reservation = await m.save(
        InventoryReservation,
        m.create(InventoryReservation, {
          companyId: c,
          productId: d.productId,
          inventoryBalanceId: b.id,
          quantity: decimal(qty),
          status: InventoryReservationStatus.ACTIVE,
          referenceType: d.referenceType,
          referenceId: d.referenceId,
          reason: d.reason,
          expiresAt: d.expiresAt ?? null,
          createdByUserId: u,
          completedAt: null,
          canceledAt: null,
        }),
      );
      return { movement, reservation };
    });
  }
  cancelReservation(c: string, u: string, id: string, k: string) {
    return this.processReservation(c, u, id, k, false);
  }
  completeReservation(c: string, u: string, id: string, k: string) {
    return this.processReservation(c, u, id, k, true);
  }
  async reverseSale(c: string, u: string, id: string, k: string) {
    if (!k) throw new BadRequestException('Idempotency-Key é obrigatório');
    return this.db.transaction(async (m) => {
      const hash = createHash('sha256')
        .update(JSON.stringify({ id, action: 'reverse' }))
        .digest('hex');
      const duplicate = await m.findOneBy(InventoryMovement, {
        companyId: c,
        idempotencyKey: k,
      });
      if (duplicate) {
        if (duplicate.requestHash !== hash)
          throw new ConflictException(
            'Idempotency-Key reutilizada com dados diferentes.',
          );
        return duplicate;
      }
      const original = await m.findOneBy(InventoryMovement, {
        id,
        companyId: c,
        type: InventoryMovementType.SALE_COMPLETED,
      });
      if (!original) throw new NotFoundException('Movimentação não encontrada');
      if (await m.findOneBy(InventoryMovement, { reversalOfMovementId: id }))
        throw new ConflictException('Esta movimentação já foi estornada.');
      const b = await m
        .getRepository(InventoryBalance)
        .createQueryBuilder('b')
        .setLock('pessimistic_write')
        .where('b.id=:id AND b.company_id=:c', {
          id: original.inventoryBalanceId,
          c,
        })
        .getOneOrFail();
      const movement = await this.persist(
        m,
        b,
        u,
        InventoryMovementType.SALE_CANCELED_REVERSAL,
        units(original.quantity),
        units(b.currentQuantity) + units(original.quantity),
        units(b.reservedQuantity),
        'Estorno por cancelamento',
        null,
        k,
        InventoryReferenceType.SALE,
        original.referenceId,
        id,
      );
      movement.requestHash = hash;
      return m.save(movement);
    });
  }
  async listMovements(c: string, q: ListMovementsDto) {
    const where: FindOptionsWhere<InventoryMovement> = { companyId: c };
    if (q.productId) where.productId = q.productId;
    if (q.type) where.type = q.type;
    if (q.performedByUserId) where.performedByUserId = q.performedByUserId;
    if (q.referenceType) where.referenceType = q.referenceType;
    if (q.referenceId) where.referenceId = q.referenceId;
    const [data, total] = await this.movements.findAndCount({
      where,
      relations: { product: true, performedBy: true },
      order: { occurredAt: q.sortDirection.toUpperCase() as 'ASC' | 'DESC' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    });
    return {
      data,
      meta: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    };
  }
  async movement(c: string, id: string) {
    const x = await this.movements.findOne({
      where: { companyId: c, id },
      relations: { product: true, performedBy: true },
    });
    if (!x) throw new NotFoundException('Movimentação não encontrada');
    return x;
  }
  async listReservations(c: string, q: ListReservationsDto) {
    const where: FindOptionsWhere<InventoryReservation> = { companyId: c };
    if (q.productId) where.productId = q.productId;
    if (q.status) where.status = q.status;
    const [data, total] = await this.reservations.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    });
    return {
      data,
      meta: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    };
  }
  async reservation(c: string, id: string) {
    const x = await this.reservations.findOneBy({ companyId: c, id });
    if (!x) throw new NotFoundException('Reserva não encontrada');
    return x;
  }
  private change(
    c: string,
    u: string,
    d: StockOperationDto,
    k: string,
    t: InventoryMovementType,
    sign: 1 | -1,
  ) {
    return this.transaction(c, u, d.productId, k, d, async (m, b) => {
      const qty = units(d.quantity),
        current = units(b.currentQuantity),
        reserved = units(b.reservedQuantity);
      if (qty <= 0n)
        throw new BadRequestException('Quantidade deve ser maior que zero');
      if (sign < 0 && qty > current - reserved)
        throw new ConflictException('Estoque disponível insuficiente.');
      return this.persist(
        m,
        b,
        u,
        t,
        qty,
        current + BigInt(sign) * qty,
        reserved,
        d.reason,
        d.notes,
        k,
        InventoryReferenceType.MANUAL,
        null,
      );
    });
  }
  private async processReservation(
    c: string,
    u: string,
    id: string,
    k: string,
    complete: boolean,
  ) {
    if (!k) throw new BadRequestException('Idempotency-Key é obrigatório');
    return this.db.transaction(async (m) => {
      const hash = createHash('sha256')
        .update(JSON.stringify({ id, complete }))
        .digest('hex');
      const duplicate = await m.findOneBy(InventoryMovement, {
        companyId: c,
        idempotencyKey: k,
      });
      if (duplicate) {
        if (duplicate.requestHash !== hash)
          throw new ConflictException(
            'Idempotency-Key reutilizada com dados diferentes.',
          );
        return duplicate;
      }
      const r = await m
        .getRepository(InventoryReservation)
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.id=:id AND r.company_id=:c', { id, c })
        .getOne();
      if (!r) throw new NotFoundException('Reserva não encontrada');
      if (r.status !== InventoryReservationStatus.ACTIVE)
        throw new ConflictException(
          `Esta reserva já foi ${r.status === InventoryReservationStatus.COMPLETED ? 'concluída' : 'cancelada'}.`,
        );
      const b = await m
        .getRepository(InventoryBalance)
        .createQueryBuilder('b')
        .setLock('pessimistic_write')
        .where('b.id=:id', { id: r.inventoryBalanceId })
        .getOneOrFail();
      const qty = units(r.quantity),
        current = units(b.currentQuantity),
        reserved = units(b.reservedQuantity);
      const movement = await this.persist(
        m,
        b,
        u,
        complete
          ? InventoryMovementType.SALE_COMPLETED
          : InventoryMovementType.RESERVATION_CANCELED,
        qty,
        complete ? current - qty : current,
        reserved - qty,
        complete ? 'Baixa por venda' : 'Cancelamento de reserva',
        r.reason,
        k,
        r.referenceType,
        r.referenceId,
      );
      movement.requestHash = hash;
      await m.save(movement);
      r.status = complete
        ? InventoryReservationStatus.COMPLETED
        : InventoryReservationStatus.CANCELED;
      if (complete) r.completedAt = new Date();
      else r.canceledAt = new Date();
      await m.save(r);
      return { movement, reservation: r };
    });
  }
  private async transaction(
    c: string,
    u: string,
    p: string,
    k: string,
    payload: unknown,
    fn: (m: EntityManager, b: InventoryBalance) => Promise<unknown>,
  ) {
    if (!k) throw new BadRequestException('Idempotency-Key é obrigatório');
    return this.db.transaction(async (m) => {
      const hash = createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex');
      const existing = await m.findOneBy(InventoryMovement, {
        companyId: c,
        idempotencyKey: k,
      });
      if (existing) {
        if (existing.requestHash !== hash)
          throw new ConflictException(
            'Idempotency-Key reutilizada com dados diferentes.',
          );
        return existing;
      }
      await this.product(m, c, p);
      await m
        .createQueryBuilder()
        .insert()
        .into(InventoryBalance)
        .values({
          companyId: c,
          productId: p,
          currentQuantity: '0',
          reservedQuantity: '0',
        })
        .orIgnore()
        .execute();
      const b = await m
        .getRepository(InventoryBalance)
        .createQueryBuilder('b')
        .setLock('pessimistic_write')
        .where('b.company_id=:c AND b.product_id=:p', { c, p })
        .getOneOrFail();
      const result = await fn(m, b);
      await m.update(
        InventoryMovement,
        { companyId: c, idempotencyKey: k },
        { requestHash: hash },
      );
      return result;
    });
  }
  private async persist(
    m: EntityManager,
    b: InventoryBalance,
    u: string,
    type: InventoryMovementType,
    qty: bigint,
    current: bigint,
    reserved: bigint,
    reason: string,
    notes: string | undefined | null,
    key: string,
    referenceType: InventoryReferenceType | null,
    referenceId: string | null,
    reversal: string | null = null,
  ) {
    const cb = units(b.currentQuantity),
      rb = units(b.reservedQuantity);
    if (current < 0n || reserved < 0n || reserved > current)
      throw new ConflictException('Operação viola os limites do estoque.');
    b.currentQuantity = decimal(current);
    b.reservedQuantity = decimal(reserved);
    await m.save(b);
    return m.save(
      InventoryMovement,
      m.create(InventoryMovement, {
        companyId: b.companyId,
        productId: b.productId,
        inventoryBalanceId: b.id,
        type,
        quantity: decimal(qty),
        currentQuantityBefore: decimal(cb),
        currentQuantityAfter: decimal(current),
        reservedQuantityBefore: decimal(rb),
        reservedQuantityAfter: decimal(reserved),
        availableQuantityBefore: decimal(cb - rb),
        availableQuantityAfter: decimal(current - reserved),
        reason,
        notes: notes ?? null,
        referenceType,
        referenceId,
        idempotencyKey: key,
        requestHash: null,
        performedByUserId: u,
        reversalOfMovementId: reversal,
        occurredAt: new Date(),
      }),
    );
  }
  private async product(m: EntityManager, c: string, p: string) {
    const x = await m.findOneBy(Product, { id: p, companyId: c });
    if (!x)
      throw new NotFoundException(
        'O produto não pertence à empresa selecionada.',
      );
    return x;
  }
  private async ensureCompanyBalances(companyId: string) {
    await this.db.query(
      `INSERT INTO inventory_balances(company_id,product_id,current_quantity,reserved_quantity)
       SELECT company_id,id,0,0 FROM products WHERE company_id=$1
       ON CONFLICT(company_id,product_id) DO NOTHING`,
      [companyId],
    );
  }
  private view(b: InventoryBalance, p: Product) {
    const a = units(b.currentQuantity) - units(b.reservedQuantity);
    return {
      product: {
        id: p.id,
        sku: p.sku,
        name: p.name,
        unitOfMeasure: p.unitOfMeasure,
        minimumStock: p.minimumStock,
        category: p.category,
        status: p.status,
      },
      currentQuantity: decimal(units(b.currentQuantity)),
      reservedQuantity: decimal(units(b.reservedQuantity)),
      availableQuantity: decimal(a),
      isBelowMinimumStock: a <= units(p.minimumStock),
      updatedAt: b.updatedAt,
    };
  }
}
