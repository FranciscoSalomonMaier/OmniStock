import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
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
  InventoryOutboxEvent,
  OutboxEventStatus,
} from './entities/inventory-outbox-event.entity';
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
    if (q.stockSituation === 'OUT')
      qb.andWhere('(b.current_quantity-b.reserved_quantity)=0');
    if (q.stockSituation === 'LOW')
      qb.andWhere(
        '(b.current_quantity-b.reserved_quantity)>0 AND (b.current_quantity-b.reserved_quantity)<=p.minimum_stock',
      );
    if (q.stockSituation === 'RESERVED') qb.andWhere('b.reserved_quantity>0');
    if (q.stockSituation === 'NORMAL')
      qb.andWhere(
        '(b.current_quantity-b.reserved_quantity)>p.minimum_stock AND b.reserved_quantity=0',
      );
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
    const syncRows: Array<{
      productId: string;
      linkedChannels: string;
      errorChannels: string;
      syncStatus: string | null;
    }> = entities.length
      ? await this.db.query(
          `SELECT p.id AS "productId",
             COUNT(DISTINCT l.id) FILTER(WHERE l.status='ACTIVE')::text AS "linkedChannels",
             COUNT(DISTINCT l.id) FILTER(WHERE l.status='ACTIVE' AND latest_sync.status='FAILED')::text AS "errorChannels",
             (SELECT ms.status::text FROM marketplace_stock_syncs ms WHERE ms.company_id=p.company_id AND ms.product_id=p.id ORDER BY ms.created_at DESC LIMIT 1) AS "syncStatus"
           FROM products p
           LEFT JOIN product_marketplace_links l ON l.product_id=p.id AND l.company_id=p.company_id
           LEFT JOIN LATERAL (
             SELECT ms.status::text AS status
             FROM marketplace_stock_syncs ms
             WHERE ms.product_marketplace_link_id=l.id AND ms.company_id=p.company_id
             ORDER BY ms.created_at DESC
             LIMIT 1
           ) latest_sync ON true
           WHERE p.company_id=$1 AND p.id=ANY($2::uuid[]) GROUP BY p.id`,
          [companyId, entities.map((x) => x.productId)],
        )
      : [];
    const syncByProduct = new Map(syncRows.map((x) => [x.productId, x]));
    return {
      data: entities.map((b) => ({
        ...this.view(b, b.product),
        syncStatus: syncByProduct.get(b.productId)?.syncStatus ?? 'NOT_SYNCED',
        linkedChannels: Number(
          syncByProduct.get(b.productId)?.linkedChannels ?? 0,
        ),
        errorChannels: Number(
          syncByProduct.get(b.productId)?.errorChannels ?? 0,
        ),
      })),
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
      .addSelect(
        'COUNT(*) FILTER (WHERE b.current_quantity-b.reserved_quantity=0)',
        'withoutStock',
      )
      .where('b.company_id=:companyId', { companyId })
      .getRawOne<{
        totalProducts: string;
        belowMinimum: string;
        withReservation: string;
        withoutStock: string;
      }>();
    return (
      rows ?? {
        totalProducts: '0',
        belowMinimum: '0',
        withReservation: '0',
        withoutStock: '0',
      }
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
  async reserveOrderItems(
    companyId: string,
    items: Array<{ orderItemId: string; productId: string; quantity: string }>,
  ) {
    return this.db.transaction(async (m) => {
      const results: InventoryReservation[] = [];
      for (const item of [...items].sort((a, b) =>
        a.productId.localeCompare(b.productId),
      )) {
        await this.product(m, companyId, item.productId);
        await m
          .createQueryBuilder()
          .insert()
          .into(InventoryBalance)
          .values({
            companyId,
            productId: item.productId,
            currentQuantity: '0',
            reservedQuantity: '0',
          })
          .orIgnore()
          .execute();
        const balance = await m
          .getRepository(InventoryBalance)
          .createQueryBuilder('balance')
          .setLock('pessimistic_write')
          .where(
            'balance.company_id=:companyId AND balance.product_id=:productId',
            {
              companyId,
              productId: item.productId,
            },
          )
          .getOneOrFail();
        const referenceId = `ORDER_ITEM:${item.orderItemId}`;
        let reservation = await m.findOneBy(InventoryReservation, {
          companyId,
          productId: item.productId,
          referenceType: InventoryReferenceType.ORDER,
          referenceId,
        });
        const wanted = units(item.quantity),
          old =
            reservation?.status === InventoryReservationStatus.ACTIVE
              ? units(reservation.quantity)
              : 0n,
          delta = wanted - old,
          current = units(balance.currentQuantity),
          reserved = units(balance.reservedQuantity);
        if (delta > 0n && delta > current - reserved)
          throw new ConflictException(
            `Estoque insuficiente para o item ${item.orderItemId}.`,
          );
        if (delta !== 0n)
          await this.persist(
            m,
            balance,
            null,
            delta > 0n
              ? InventoryMovementType.RESERVATION
              : InventoryMovementType.RESERVATION_CANCELED,
            delta > 0n ? delta : -delta,
            current,
            reserved + delta,
            delta > 0n
              ? 'Reserva automática de pedido'
              : 'Ajuste de reserva do pedido',
            null,
            null,
            InventoryReferenceType.ORDER,
            referenceId,
          );
        if (!reservation)
          reservation = m.create(InventoryReservation, {
            companyId,
            productId: item.productId,
            inventoryBalanceId: balance.id,
            referenceType: InventoryReferenceType.ORDER,
            referenceId,
            reason: 'Reserva automática de pedido',
            expiresAt: null,
            createdByUserId: null,
            completedAt: null,
            canceledAt: null,
          });
        reservation.quantity = decimal(wanted);
        reservation.status = InventoryReservationStatus.ACTIVE;
        reservation.canceledAt = null;
        reservation = await m.save(reservation);
        results.push(reservation);
      }
      return results;
    });
  }
  async cancelOrderReservations(companyId: string, reservationIds: string[]) {
    return this.db.transaction(async (m) => {
      for (const id of [...new Set(reservationIds)].sort()) {
        const reservation = await m.findOneBy(InventoryReservation, {
          id,
          companyId,
        });
        if (
          !reservation ||
          reservation.status !== InventoryReservationStatus.ACTIVE
        )
          continue;
        const balance = await m
          .getRepository(InventoryBalance)
          .createQueryBuilder('balance')
          .setLock('pessimistic_write')
          .where('balance.id=:id AND balance.company_id=:companyId', {
            id: reservation.inventoryBalanceId,
            companyId,
          })
          .getOneOrFail();
        await this.persist(
          m,
          balance,
          null,
          InventoryMovementType.RESERVATION_CANCELED,
          units(reservation.quantity),
          units(balance.currentQuantity),
          units(balance.reservedQuantity) - units(reservation.quantity),
          'Cancelamento de reserva do pedido',
          null,
          null,
          InventoryReferenceType.ORDER,
          reservation.referenceId,
        );
        reservation.status = InventoryReservationStatus.CANCELED;
        reservation.canceledAt = new Date();
        await m.save(reservation);
      }
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
      if (await m.findOneBy(InventoryMovement, { reversalOfMovementId: id }))
        throw new ConflictException('Esta movimentação já foi estornada.');
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
    const qb = this.movements
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.product', 'product')
      .leftJoinAndSelect('movement.performedBy', 'performedBy')
      .where('movement.companyId=:c', { c });
    if (q.search)
      qb.andWhere('(product.sku ILIKE :search OR product.name ILIKE :search)', {
        search: `%${q.search}%`,
      });
    if (q.productId)
      qb.andWhere('movement.productId=:productId', { productId: q.productId });
    if (q.type) qb.andWhere('movement.type=:type', { type: q.type });
    if (q.performedByUserId)
      qb.andWhere('movement.performedByUserId=:user', {
        user: q.performedByUserId,
      });
    if (q.referenceType)
      qb.andWhere('movement.referenceType=:referenceType', {
        referenceType: q.referenceType,
      });
    if (q.referenceId)
      qb.andWhere('movement.referenceId ILIKE :referenceId', {
        referenceId: `%${q.referenceId}%`,
      });
    if (q.dateFrom && q.dateTo) {
      const from = new Date(q.dateFrom),
        to = new Date(q.dateTo);
      if (from > to) throw new BadRequestException('Período inválido.');
      if (to.getTime() - from.getTime() > 366 * 86400000)
        throw new BadRequestException('O período máximo é de 366 dias.');
      qb.andWhere('movement.occurredAt BETWEEN :from AND :to', { from, to });
    } else if (q.dateFrom)
      qb.andWhere('movement.occurredAt>=:from', { from: new Date(q.dateFrom) });
    else if (q.dateTo)
      qb.andWhere('movement.occurredAt<=:to', { to: new Date(q.dateTo) });
    const [data, total] = await qb
      .orderBy(
        'movement.occurredAt',
        q.sortDirection.toUpperCase() as 'ASC' | 'DESC',
      )
      .skip((q.page - 1) * q.limit)
      .take(q.limit)
      .getManyAndCount();
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
      const duplicateAfterLock = await m.findOneBy(InventoryMovement, {
        companyId: c,
        idempotencyKey: k,
      });
      if (duplicateAfterLock) {
        if (duplicateAfterLock.requestHash !== hash)
          throw new ConflictException(
            'Idempotency-Key reutilizada com dados diferentes.',
          );
        return duplicateAfterLock;
      }
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
      const duplicateAfterLock = await m.findOneBy(InventoryMovement, {
        companyId: c,
        idempotencyKey: k,
      });
      if (duplicateAfterLock) {
        if (duplicateAfterLock.requestHash !== hash)
          throw new ConflictException(
            'Idempotency-Key reutilizada com dados diferentes.',
          );
        return duplicateAfterLock;
      }
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
    u: string | null,
    type: InventoryMovementType,
    qty: bigint,
    current: bigint,
    reserved: bigint,
    reason: string,
    notes: string | undefined | null,
    key: string | null,
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
    const movement = await m.save(
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
    if (cb - rb !== current - reserved) {
      const source =
        referenceType === InventoryReferenceType.ORDER
          ? type === InventoryMovementType.RESERVATION_CANCELED
            ? 'ORDER_CANCELLATION'
            : 'ORDER_IMPORT'
          : u
            ? 'MANUAL'
            : 'SYSTEM';
      await m.save(
        InventoryOutboxEvent,
        m.create(InventoryOutboxEvent, {
          companyId: b.companyId,
          aggregateType: 'INVENTORY',
          aggregateId: b.productId,
          eventType: 'InventoryAvailabilityChanged',
          payload: {
            companyId: b.companyId,
            productId: b.productId,
            previousOnHand: Number(decimal(cb)),
            currentOnHand: Number(decimal(current)),
            previousReserved: Number(decimal(rb)),
            currentReserved: Number(decimal(reserved)),
            previousAvailable: Number(decimal(cb - rb)),
            currentAvailable: Number(decimal(current - reserved)),
            inventoryVersion: b.version,
            movementId: movement.id,
            movementType: type,
            source,
            correlationId: key ?? randomUUID(),
            occurredAt: movement.occurredAt.toISOString(),
          },
          status: OutboxEventStatus.PENDING,
          attempts: 0,
          availableAt: new Date(),
          processedAt: null,
          lastError: null,
        }),
      );
    }
    return movement;
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
