import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import type { ExternalOrder } from '../marketplace-connectors/core/marketplace-types';
import { MarketplaceListing } from '../marketplace-connectors/mercado-livre/entities/marketplace-listing.entity';
import { MarketplaceOrderImport } from '../marketplace-connectors/mercado-livre/entities/marketplace-order-import.entity';
import { ProductMarketplaceLink } from '../product-marketplace-links/entities/product-marketplace-link.entity';
import { ProductMarketplaceLinkStatus } from '../product-marketplace-links/enums/product-marketplace-link.enums';
import { Product } from '../products/entities/product.entity';
import { ProductStatus } from '../products/enums/product.enums';
import { SalesChannelConnection } from '../sales-channels/entities/sales-channel-connection.entity';
import {
  CommissionStatus,
  DocumentType,
  FiscalStatus,
  OrderAddressType,
  OrderHistorySource,
  OrderIssueCode,
  OrderIssueSeverity,
  OrderIssueStatus,
  OrderSource,
  PaymentMethod,
  PaymentStatus,
  ShippingStatus,
} from './enums/order.enums';
import {
  CompanyOrderSequence,
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
import { MercadoLivreOrderStatusMapper } from './mappers/mercado-livre-order-status.mapper';

const money = (n: number) => Number(n).toFixed(2),
  qty = (n: number) => Number(n).toFixed(3);
@Injectable()
export class OrderImportService {
  constructor(
    private readonly db: DataSource,
    private readonly mapper: MercadoLivreOrderStatusMapper,
  ) {}
  async importMarketplace(
    connection: SalesChannelConnection,
    external: ExternalOrder,
    imported: MarketplaceOrderImport,
    reprocessing = false,
  ) {
    return this.db.transaction(async (m) => {
      const repo = m.getRepository(Order);
      let order = await repo
        .createQueryBuilder('o')
        .setLock('pessimistic_write')
        .where(
          'o.companyId=:companyId AND o.salesChannelConnectionId=:connectionId AND o.externalOrderId=:externalId',
          {
            companyId: connection.companyId,
            connectionId: connection.id,
            externalId: external.externalId,
          },
        )
        .getOne();
      if (
        !reprocessing &&
        order?.externalUpdatedAt &&
        order.externalUpdatedAt >= external.updatedAt
      )
        return order;
      const mapped = this.mapper.map(
          external.status,
          external.paymentStatus,
          external.shippingStatus,
        ),
        previous = order
          ? {
              o: order.status,
              p: order.paymentStatus,
              s: order.shippingStatus,
              f: order.fiscalStatus,
            }
          : null;
      if (!order)
        order = repo.create({
          companyId: connection.companyId,
          internalNumber: await this.nextNumber(m, connection.companyId),
          source: OrderSource.MARKETPLACE,
          createdByUserId: null,
        });
      Object.assign(order, {
        salesChannelId: connection.salesChannelId,
        salesChannelConnectionId: connection.id,
        marketplaceOrderImportId: imported.id,
        externalOrderId: external.externalId,
        externalOrderNumber: external.externalNumber,
        status: mapped.order,
        paymentStatus: mapped.payment,
        shippingStatus: mapped.shipping,
        fiscalStatus: mapped.fiscal,
        externalStatus: external.status,
        externalPaymentStatus: external.paymentStatus,
        externalShippingStatus: external.shippingStatus,
        currency: external.currency,
        itemsSubtotal: money(external.subtotal),
        shippingAmount: money(external.shippingAmount),
        discountAmount: money(external.discountAmount),
        commissionAmount: null,
        commissionStatus: CommissionStatus.NOT_AVAILABLE,
        otherFeesAmount: '0.00',
        totalAmount: money(external.totalAmount),
        paidAmount:
          mapped.payment === PaymentStatus.PAID
            ? money(external.totalAmount)
            : '0.00',
        refundedAmount: '0.00',
        purchasedAt: external.purchasedAt,
        paidAt:
          mapped.payment === PaymentStatus.PAID ? external.updatedAt : null,
        externalCreatedAt: external.purchasedAt,
        externalUpdatedAt: external.updatedAt,
        importedAt: new Date(),
        updatedByUserId: null,
        errorCode: null,
        errorMessage: null,
      });
      order = await repo.save(order);
      await this.replaceSnapshots(m, order, external);
      await this.replaceIssues(m, order, external, mapped.unknown);
      if (
        reprocessing ||
        !previous ||
        previous.o !== order.status ||
        previous.p !== order.paymentStatus ||
        previous.s !== order.shippingStatus ||
        previous.f !== order.fiscalStatus
      )
        await m.getRepository(OrderStatusHistory).save({
          companyId: order.companyId,
          orderId: order.id,
          previousOrderStatus: previous?.o ?? null,
          newOrderStatus: order.status,
          previousPaymentStatus: previous?.p ?? null,
          newPaymentStatus: order.paymentStatus,
          previousShippingStatus: previous?.s ?? null,
          newShippingStatus: order.shippingStatus,
          previousFiscalStatus: previous?.f ?? null,
          newFiscalStatus: order.fiscalStatus,
          source: reprocessing
            ? OrderHistorySource.REPROCESSING
            : OrderHistorySource.IMPORT,
          externalEventId: reprocessing
            ? null
            : `import:${external.externalId}:${external.updatedAt.toISOString()}`,
          changedByUserId: null,
          reason: reprocessing
            ? 'Pedido reprocessado a partir dos dados normalizados.'
            : previous
              ? 'Pedido externo atualizado.'
              : 'Pedido externo importado.',
          metadata: { connectionId: connection.id },
          occurredAt: external.updatedAt,
        });
      return order;
    });
  }
  private async nextNumber(m: EntityManager, companyId: string) {
    await m.query(
      `INSERT INTO company_order_sequences(company_id,next_number) VALUES($1,1) ON CONFLICT(company_id) DO NOTHING`,
      [companyId],
    );
    const repo = m.getRepository(CompanyOrderSequence);
    const sequence = await repo
      .createQueryBuilder('sequence')
      .setLock('pessimistic_write')
      .where('sequence.companyId = :companyId', { companyId })
      .getOneOrFail();
    const current = sequence.nextNumber;
    sequence.nextNumber = (BigInt(current) + 1n).toString();
    await repo.save(sequence);
    return current;
  }
  private async replaceSnapshots(m: EntityManager, o: Order, e: ExternalOrder) {
    await m
      .getRepository(OrderIssue)
      .delete({ companyId: o.companyId, orderId: o.id });
    await m
      .getRepository(OrderItem)
      .delete({ companyId: o.companyId, orderId: o.id });
    await m
      .getRepository(OrderAddress)
      .delete({ companyId: o.companyId, orderId: o.id });
    await m
      .getRepository(OrderPayment)
      .delete({ companyId: o.companyId, orderId: o.id });
    await m
      .getRepository(OrderShipment)
      .delete({ companyId: o.companyId, orderId: o.id });
    await m.getRepository(OrderCustomer).upsert(
      {
        companyId: o.companyId,
        orderId: o.id,
        externalCustomerId: null,
        name: e.buyer.name || 'Comprador',
        email: e.buyer.email,
        phone: null,
        documentType: e.buyer.document
          ? this.documentType(e.buyer.document)
          : null,
        document: e.buyer.document?.replace(/\D/g, '') ?? null,
        stateRegistration: null,
        isCompany: (e.buyer.document?.replace(/\D/g, '').length ?? 0) > 11,
      },
      ['orderId'],
    );
    if (e.shippingAddress.street || e.shippingAddress.city)
      await m.getRepository(OrderAddress).save({
        companyId: o.companyId,
        orderId: o.id,
        type: OrderAddressType.SHIPPING,
        recipientName: e.buyer.name || 'Comprador',
        street: e.shippingAddress.street,
        number: e.shippingAddress.number ?? 'S/N',
        complement: e.shippingAddress.complement,
        district: e.shippingAddress.district,
        city: e.shippingAddress.city,
        state: e.shippingAddress.state,
        postalCode: e.shippingAddress.postalCode.replace(/\D/g, ''),
        countryCode: e.shippingAddress.country.slice(0, 2).toUpperCase(),
        reference: null,
      });
    for (const x of e.items) {
      const listing = await m.getRepository(MarketplaceListing).findOneBy({
        companyId: o.companyId,
        connectionId: o.salesChannelConnectionId!,
        externalItemId: x.externalItemId,
        externalVariationId: x.variationId ?? IsNull(),
      });
      const link = listing
        ? await m.getRepository(ProductMarketplaceLink).findOneBy({
            companyId: o.companyId,
            marketplaceListingId: listing.id,
            status: ProductMarketplaceLinkStatus.ACTIVE,
          })
        : null;
      const product = link
        ? await m
            .getRepository(Product)
            .findOneBy({ companyId: o.companyId, id: link.productId })
        : null;
      await m.getRepository(OrderItem).save({
        companyId: o.companyId,
        orderId: o.id,
        productId: product?.id ?? null,
        productMarketplaceLinkId: link?.id ?? null,
        marketplaceListingId: listing?.id ?? null,
        externalItemId: x.externalItemId,
        externalVariationId: x.variationId,
        externalSku: x.externalSku,
        skuSnapshot:
          product?.sku ?? x.externalSku ?? `EXTERNAL-${x.externalItemId}`,
        nameSnapshot: product?.name ?? x.title,
        descriptionSnapshot: product?.description ?? null,
        unitOfMeasureSnapshot: product?.unitOfMeasure ?? 'UN',
        quantity: qty(x.quantity),
        unitPrice: money(x.unitPrice),
        grossAmount: money(x.totalPrice),
        discountAmount: '0.00',
        commissionAmount: null,
        shippingAllocationAmount: null,
        netAmount: money(x.totalPrice),
        currency: e.currency,
        status: null,
        ncmSnapshot: product?.ncm ?? null,
        cestSnapshot: product?.cest ?? null,
        cfopSnapshot: product?.defaultCfop ?? null,
        merchandiseOriginSnapshot: product?.merchandiseOrigin ?? null,
        taxUnitSnapshot: product?.unitOfMeasure ?? null,
      });
    }
    if (e.paymentStatus !== 'unknown')
      await m.getRepository(OrderPayment).save({
        companyId: o.companyId,
        orderId: o.id,
        externalPaymentId: null,
        method: PaymentMethod.UNKNOWN,
        methodDetail: null,
        status: o.paymentStatus,
        amount: o.paidAmount,
        installments: null,
        authorizationCode: null,
        paidAt: o.paidAt,
        refundedAt: null,
        externalCreatedAt: null,
        externalUpdatedAt: e.updatedAt,
      });
    const shipmentId =
      typeof e.metadata.shipmentId === 'string' ? e.metadata.shipmentId : null;
    if (shipmentId)
      await m.getRepository(OrderShipment).save({
        companyId: o.companyId,
        orderId: o.id,
        externalShipmentId: shipmentId,
        status: o.shippingStatus,
        substatus: null,
        logisticType: null,
        shippingMode: null,
        carrierName: null,
        trackingNumber: null,
        trackingUrl: null,
        shippingAmount: o.shippingAmount,
        estimatedDeliveryAt: null,
        readyToShipAt: null,
        shippedAt: null,
        deliveredAt: null,
        returnedAt: null,
        externalUpdatedAt: e.updatedAt,
      });
    await m.getRepository(OrderFiscalData).upsert(
      {
        companyId: o.companyId,
        orderId: o.id,
        customerDocument: e.buyer.document?.replace(/\D/g, '') ?? null,
        customerStateRegistration: null,
        fiscalName: e.buyer.name || 'Comprador',
        fiscalEmail: e.buyer.email,
        operationNature: null,
        defaultCfop: null,
        fiscalStatus: FiscalStatus.NOT_ISSUED,
        invoiceId: null,
        invoiceAccessKey: null,
        invoiceNumber: null,
        invoiceSeries: null,
        issuedAt: null,
      },
      ['orderId'],
    );
  }
  private async replaceIssues(
    m: EntityManager,
    o: Order,
    e: ExternalOrder,
    unknown: string[],
  ) {
    const items = await m
      .getRepository(OrderItem)
      .findBy({ companyId: o.companyId, orderId: o.id });
    const issues: Partial<OrderIssue>[] = [];
    for (const item of items) {
      if (!item.productId)
        issues.push({
          companyId: o.companyId,
          orderId: o.id,
          orderItemId: item.id,
          code: OrderIssueCode.PRODUCT_LINK_MISSING,
          severity: OrderIssueSeverity.WARNING,
          message: `O item ${item.skuSnapshot} não possui produto vinculado.`,
          status: OrderIssueStatus.OPEN,
        });
      else {
        const product = await m.getRepository(Product).findOneBy({
          id: item.productId,
          companyId: o.companyId,
        });
        if (product?.status !== ProductStatus.ACTIVE)
          issues.push({
            companyId: o.companyId,
            orderId: o.id,
            orderItemId: item.id,
            code: OrderIssueCode.PRODUCT_INACTIVE,
            severity: OrderIssueSeverity.WARNING,
            message: `O produto ${item.skuSnapshot} está inativo.`,
            status: OrderIssueStatus.OPEN,
          });
      }
    }
    const calculated = e.subtotal + e.shippingAmount - e.discountAmount;
    if (Math.abs(calculated - e.totalAmount) > 0.01)
      issues.push({
        companyId: o.companyId,
        orderId: o.id,
        orderItemId: null,
        code: OrderIssueCode.TOTAL_MISMATCH,
        severity: OrderIssueSeverity.WARNING,
        message: 'O total externo diverge da composição normalizada.',
        status: OrderIssueStatus.OPEN,
      });
    if (
      !e.shippingAddress.street &&
      o.shippingStatus !== ShippingStatus.NOT_REQUIRED
    )
      issues.push({
        companyId: o.companyId,
        orderId: o.id,
        orderItemId: null,
        code: OrderIssueCode.SHIPPING_DATA_MISSING,
        severity: OrderIssueSeverity.WARNING,
        message: 'Endereço de entrega não informado pelo canal.',
        status: OrderIssueStatus.OPEN,
      });
    if (e.paymentStatus === 'unknown')
      issues.push({
        companyId: o.companyId,
        orderId: o.id,
        orderItemId: null,
        code: OrderIssueCode.PAYMENT_DATA_MISSING,
        severity: OrderIssueSeverity.WARNING,
        message: 'Dados de pagamento não informados pelo canal.',
        status: OrderIssueStatus.OPEN,
      });
    if (unknown.length)
      issues.push({
        companyId: o.companyId,
        orderId: o.id,
        orderItemId: null,
        code: OrderIssueCode.UNKNOWN_EXTERNAL_STATUS,
        severity: OrderIssueSeverity.WARNING,
        message: `Status externo ainda não mapeado: ${unknown.join(', ')}.`,
        status: OrderIssueStatus.OPEN,
      });
    if (issues.length) await m.getRepository(OrderIssue).save(issues);
  }
  private documentType(value: string) {
    const n = value.replace(/\D/g, '');
    return n.length === 11
      ? DocumentType.CPF
      : n.length === 14
        ? DocumentType.CNPJ
        : DocumentType.OTHER;
  }
}
