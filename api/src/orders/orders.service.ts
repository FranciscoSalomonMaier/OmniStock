import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CompanyRole } from '../common/enums/company-role.enum';
import type { ExternalOrder } from '../marketplace-connectors/core/marketplace-types';
import { MarketplaceOrderImportItem } from '../marketplace-connectors/mercado-livre/entities/marketplace-order-import-item.entity';
import { MarketplaceOrderImport } from '../marketplace-connectors/mercado-livre/entities/marketplace-order-import.entity';
import { SalesChannelConnection } from '../sales-channels/entities/sales-channel-connection.entity';
import {
  CancelOrderDto,
  ListOrdersDto,
  ResolveOrderIssueDto,
} from './dto/order.dto';
import {
  Order,
  OrderAddress,
  OrderCustomer,
  OrderFiscalData,
  OrderIssue,
  OrderItem,
  OrderPayment,
  OrderShipment,
  OrderStatusHistory,
} from './entities/order.entity';
import {
  OrderHistorySource,
  OrderIssueStatus,
  OrderStatus,
} from './enums/order.enums';
import { OrderImportService } from './order-import.service';
import { OrderStatusTransitionService } from './order-status-transition.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private orders: Repository<Order>,
    @InjectRepository(OrderItem) private items: Repository<OrderItem>,
    @InjectRepository(OrderCustomer)
    private customers: Repository<OrderCustomer>,
    @InjectRepository(OrderAddress) private addresses: Repository<OrderAddress>,
    @InjectRepository(OrderPayment) private payments: Repository<OrderPayment>,
    @InjectRepository(OrderShipment)
    private shipments: Repository<OrderShipment>,
    @InjectRepository(OrderFiscalData)
    private fiscal: Repository<OrderFiscalData>,
    @InjectRepository(OrderIssue) private issues: Repository<OrderIssue>,
    @InjectRepository(OrderStatusHistory)
    private history: Repository<OrderStatusHistory>,
    @InjectRepository(MarketplaceOrderImport)
    private imports: Repository<MarketplaceOrderImport>,
    @InjectRepository(MarketplaceOrderImportItem)
    private importItems: Repository<MarketplaceOrderImportItem>,
    @InjectRepository(SalesChannelConnection)
    private connections: Repository<SalesChannelConnection>,
    private db: DataSource,
    private transitions: OrderStatusTransitionService,
    private importer: OrderImportService,
  ) {}
  async list(companyId: string, q: ListOrdersDto) {
    const qb = this.orders
      .createQueryBuilder('o')
      .leftJoin('sales_channels', 'ch', 'ch.id=o.sales_channel_id')
      .leftJoin(
        'sales_channel_connections',
        'cn',
        'cn.id=o.sales_channel_connection_id',
      )
      .leftJoin(
        'order_customers',
        'cu',
        'cu.order_id=o.id AND cu.company_id=o.company_id',
      )
      .where('o.company_id=:companyId', { companyId });
    if (q.search)
      qb.andWhere(
        `(CAST(o.internal_number AS text) ILIKE :search OR o.external_order_id ILIKE :search OR cu.name ILIKE :search OR EXISTS(SELECT 1 FROM order_items oi WHERE oi.order_id=o.id AND oi.company_id=o.company_id AND (oi.sku_snapshot ILIKE :search OR oi.name_snapshot ILIKE :search)))`,
        { search: `%${q.search}%` },
      );
    if (q.internalNumber) qb.andWhere('o.internal_number=:internalNumber', q);
    if (q.externalOrderId)
      qb.andWhere('o.external_order_id=:externalOrderId', q);
    if (q.source) qb.andWhere('o.source=:source', q);
    if (q.channelCode) qb.andWhere('ch.code=:channelCode', q);
    if (q.connectionId)
      qb.andWhere('o.sales_channel_connection_id=:connectionId', q);
    if (q.orderStatus) qb.andWhere('o.status=:orderStatus', q);
    if (q.paymentStatus) qb.andWhere('o.payment_status=:paymentStatus', q);
    if (q.shippingStatus) qb.andWhere('o.shipping_status=:shippingStatus', q);
    if (q.fiscalStatus) qb.andWhere('o.fiscal_status=:fiscalStatus', q);
    if (q.customerName)
      qb.andWhere('cu.name ILIKE :customerName', {
        customerName: `%${q.customerName}%`,
      });
    if (q.productSku)
      qb.andWhere(
        'EXISTS(SELECT 1 FROM order_items oi WHERE oi.order_id=o.id AND oi.company_id=o.company_id AND oi.sku_snapshot ILIKE :sku)',
        { sku: `%${q.productSku}%` },
      );
    if (q.dateFrom) qb.andWhere('o.purchased_at>=:dateFrom', q);
    if (q.dateTo) qb.andWhere('o.purchased_at<=:dateTo', q);
    if (q.withIssues)
      qb.andWhere(
        `EXISTS(SELECT 1 FROM order_issues iss WHERE iss.order_id=o.id AND iss.company_id=o.company_id AND iss.status='OPEN')`,
      );
    const sort: Record<string, string> = {
        internalNumber: 'o.internal_number',
        purchasedAt: 'o.purchased_at',
        totalAmount: 'o.total_amount',
        status: 'o.status',
        createdAt: 'o.created_at',
        updatedAt: 'o.updated_at',
      },
      total = await qb.getCount(),
      rows = await qb
        .select([
          'o.id AS id',
          'o.internal_number AS "internalNumber"',
          'o.external_order_id AS "externalOrderId"',
          'o.source AS source',
          'ch.name AS "channelName"',
          'cn.display_name AS "connectionName"',
          'cu.name AS "customerName"',
          'o.total_amount AS "totalAmount"',
          'o.currency AS currency',
          'o.status AS "orderStatus"',
          'o.payment_status AS "paymentStatus"',
          'o.shipping_status AS "shippingStatus"',
          'o.fiscal_status AS "fiscalStatus"',
          'o.purchased_at AS "purchasedAt"',
          'o.updated_at AS "updatedAt"',
          `(SELECT COUNT(*)::int FROM order_items oi WHERE oi.order_id=o.id) AS "itemsCount"`,
          `(SELECT COALESCE(SUM(oi.quantity),0) FROM order_items oi WHERE oi.order_id=o.id) AS "totalQuantity"`,
          `(SELECT COUNT(*)::int FROM order_issues iss WHERE iss.order_id=o.id AND iss.status='OPEN') AS "issuesCount"`,
        ])
        .orderBy(
          sort[q.sortBy],
          q.sortDirection.toUpperCase() as 'ASC' | 'DESC',
        )
        .offset((q.page - 1) * q.limit)
        .limit(q.limit)
        .getRawMany<Record<string, unknown>>();
    return {
      data: rows.map((r) => ({
        ...r,
        internalNumber: String(r.internalNumber).padStart(6, '0'),
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
    const r = await this.orders
      .createQueryBuilder('o')
      .where('o.company_id=:companyId', { companyId })
      .select(`COUNT(*) FILTER(WHERE o.status='NEW')`, 'new')
      .addSelect(
        `COUNT(*) FILTER(WHERE o.status='AWAITING_INVOICE')`,
        'awaitingInvoice',
      )
      .addSelect(
        `COUNT(*) FILTER(WHERE o.status='READY_TO_SHIP')`,
        'readyToShip',
      )
      .addSelect(`COUNT(*) FILTER(WHERE o.status='CANCELED')`, 'canceled')
      .addSelect(
        `(SELECT COUNT(DISTINCT i.order_id) FROM order_issues i WHERE i.company_id=:companyId AND i.status='OPEN')`,
        'withIssues',
      )
      .getRawOne<Record<string, string>>();
    return Object.fromEntries(
      Object.entries(r ?? {}).map(([k, v]) => [k, Number(v)]),
    );
  }
  async details(companyId: string, id: string, role: CompanyRole) {
    const order = await this.one(companyId, id),
      [
        customer,
        addresses,
        items,
        payments,
        shipments,
        fiscal,
        issues,
        history,
      ] = await Promise.all([
        this.customers.findOneBy({ companyId, orderId: id }),
        this.addresses.findBy({ companyId, orderId: id }),
        this.items.findBy({ companyId, orderId: id }),
        this.payments.findBy({ companyId, orderId: id }),
        this.shipments.findBy({ companyId, orderId: id }),
        this.fiscal.findOneBy({ companyId, orderId: id }),
        this.issues.findBy({ companyId, orderId: id }),
        this.history.find({
          where: { companyId, orderId: id },
          order: { occurredAt: 'DESC' },
          take: 20,
        }),
      ]);
    const sensitive = [
        CompanyRole.ADMIN,
        CompanyRole.MANAGER,
        CompanyRole.BILLING,
        CompanyRole.SUPPORT,
      ].includes(role),
      mask = (x: string | null) => (!x || sensitive ? x : `***${x.slice(-4)}`);
    return {
      ...order,
      internalNumber: this.format(order.internalNumber),
      customer: customer
        ? {
            ...customer,
            document: mask(customer.document),
            email: sensitive ? customer.email : null,
            phone: sensitive ? customer.phone : null,
          }
        : null,
      addresses: sensitive
        ? addresses
        : addresses.map((a) => ({
            ...a,
            street: '***',
            number: '***',
            complement: null,
            reference: null,
          })),
      items,
      payments,
      shipments,
      fiscal: fiscal
        ? { ...fiscal, customerDocument: mask(fiscal.customerDocument) }
        : null,
      issues,
      history,
    };
  }
  async cancel(
    companyId: string,
    id: string,
    userId: string,
    d: CancelOrderDto,
  ) {
    return this.db.transaction(async (m) => {
      const repo = m.getRepository(Order),
        o = await repo
          .createQueryBuilder('o')
          .setLock('pessimistic_write')
          .where('o.id=:id AND o.company_id=:companyId', { id, companyId })
          .getOne();
      if (!o) throw new NotFoundException('Pedido não encontrado.');
      this.transitions.assert(o.status, OrderStatus.CANCELED);
      const previous = o.status;
      o.status = OrderStatus.CANCELED;
      o.canceledAt = new Date();
      o.updatedByUserId = userId;
      await repo.save(o);
      await m.getRepository(OrderStatusHistory).save({
        companyId,
        orderId: id,
        previousOrderStatus: previous,
        newOrderStatus: o.status,
        previousPaymentStatus: o.paymentStatus,
        newPaymentStatus: o.paymentStatus,
        previousShippingStatus: o.shippingStatus,
        newShippingStatus: o.shippingStatus,
        previousFiscalStatus: o.fiscalStatus,
        newFiscalStatus: o.fiscalStatus,
        source: OrderHistorySource.USER,
        externalEventId: null,
        changedByUserId: userId,
        reason: d.reason,
        metadata: null,
        occurredAt: new Date(),
      });
      return { id: o.id, status: o.status, canceledAt: o.canceledAt };
    });
  }
  async resolve(
    companyId: string,
    orderId: string,
    issueId: string,
    userId: string,
    d: ResolveOrderIssueDto,
  ) {
    const issue = await this.issues.findOneBy({
      id: issueId,
      orderId,
      companyId,
    });
    if (!issue) throw new NotFoundException('Pendência não encontrada.');
    if (issue.status !== OrderIssueStatus.OPEN)
      throw new ConflictException('Pendência já encerrada.');
    issue.status = OrderIssueStatus.RESOLVED;
    issue.resolvedAt = new Date();
    issue.resolvedByUserId = userId;
    issue.resolutionNote = d.justification;
    return this.issues.save(issue);
  }
  async reprocess(companyId: string, id: string) {
    const o = await this.one(companyId, id);
    if (!o.marketplaceOrderImportId || !o.salesChannelConnectionId)
      throw new ConflictException(
        'Pedido não possui importação externa para reprocessar.',
      );
    const [imp, items, connection] = await Promise.all([
      this.imports.findOneBy({ id: o.marketplaceOrderImportId, companyId }),
      this.importItems.findBy({
        orderImportId: o.marketplaceOrderImportId,
        companyId,
      }),
      this.connections.findOneBy({ id: o.salesChannelConnectionId, companyId }),
    ]);
    if (!imp || !connection)
      throw new NotFoundException('Origem externa não encontrada.');
    const external: ExternalOrder = {
      externalId: imp.externalOrderId,
      externalNumber: imp.externalOrderId,
      status: imp.status,
      paymentStatus: imp.paymentStatus ?? 'unknown',
      shippingStatus: imp.shippingStatus ?? 'unknown',
      purchasedAt: imp.purchasedAt,
      updatedAt: imp.externalUpdatedAt,
      buyer: {
        name: imp.buyerNickname ?? 'Comprador',
        document: null,
        email: null,
      },
      shippingAddress: {
        street: '',
        number: null,
        complement: null,
        district: null,
        city: '',
        state: '',
        postalCode: '',
        country: 'BR',
      },
      items: items.map((x) => ({
        externalItemId: x.externalItemId,
        externalProductId: x.externalItemId,
        externalSku: x.externalSku,
        title: x.title,
        quantity: x.quantity,
        unitPrice: Number(x.unitPrice),
        totalPrice: Number(x.totalPrice),
        variationId: x.externalVariationId,
      })),
      subtotal: Number(imp.totalAmount),
      shippingAmount: 0,
      discountAmount: 0,
      totalAmount: Number(imp.totalAmount),
      currency: imp.currency,
      metadata: { shipmentId: imp.shipmentId },
    };
    return this.importer.importMarketplace(connection, external, imp, true);
  }
  historyFor(companyId: string, id: string) {
    return this.ensureThen(companyId, id, () =>
      this.history.find({
        where: { companyId, orderId: id },
        order: { occurredAt: 'DESC' },
      }),
    );
  }
  issuesFor(companyId: string, id: string) {
    return this.ensureThen(companyId, id, () =>
      this.issues.find({
        where: { companyId, orderId: id },
        order: { createdAt: 'DESC' },
      }),
    );
  }
  paymentsFor(companyId: string, id: string) {
    return this.ensureThen(companyId, id, () =>
      this.payments.findBy({ companyId, orderId: id }),
    );
  }
  shipmentFor(companyId: string, id: string) {
    return this.ensureThen(companyId, id, () =>
      this.shipments.findBy({ companyId, orderId: id }),
    );
  }
  fiscalFor(companyId: string, id: string) {
    return this.ensureThen(companyId, id, () =>
      this.fiscal.findOneBy({ companyId, orderId: id }),
    );
  }
  private async ensureThen<T>(
    companyId: string,
    id: string,
    fn: () => Promise<T>,
  ) {
    await this.one(companyId, id);
    return fn();
  }
  private async one(companyId: string, id: string) {
    const o = await this.orders.findOneBy({ id, companyId });
    if (!o) throw new NotFoundException('Pedido não encontrado.');
    return o;
  }
  private format(n: string) {
    return n.padStart(6, '0');
  }
}
