import { preserveImportedProgress } from '../../orders/imported-statuses';
import { MercadoLivreItem } from '../mercado-livre/mercado-livre.types';
import { Injectable } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { MarketplaceWebhookEvent } from '../../orders/entities/marketplace-webhook-event.entity';
import { SalesChannelConnection } from '../../sales-channels/entities/sales-channel-connection.entity';
import {
  Order,
  OrderShipment,
  OrderStatusHistory,
} from '../../orders/entities/order.entity';
import {
  OrderHistorySource,
  ShippingStatus,
} from '../../orders/enums/order.enums';
import { MercadoLivreOrderStatusMapper } from '../../orders/mappers/mercado-livre-order-status.mapper';
import { MercadoLivreIntegrationService } from '../mercado-livre/mercado-livre-integration.service';
import { MercadoLivreApiClient } from '../mercado-livre/mercado-livre-api.client';
import { MercadoLivreConnector } from '../mercado-livre/mercado-livre.connector';
import { MercadoLivreProcessor } from '../mercado-livre/mercado-livre.processor';
import { MarketplaceOrderProcessor } from '../orders/marketplace-order.processor';
import { MarketplaceListing } from '../mercado-livre/entities/marketplace-listing.entity';
import { InventoryBalance } from '../../inventory/entities/inventory-balance.entity';
import { ProductMarketplaceLink } from '../../product-marketplace-links/entities/product-marketplace-link.entity';
import { ProductMarketplaceLinkStatus } from '../../product-marketplace-links/enums/product-marketplace-link.enums';
import {
  MarketplaceStockSync,
  MarketplaceStockDivergence,
  StockDivergenceStatus,
  StockSyncStatus,
} from '../stock/marketplace-stock-sync.entity';
import { BundlesCompositionService } from '../../product_bundles/bundles-composition/bundles-composition.service';
import { MarketplaceConnectorError } from '../core/marketplace-errors';
import { MarketplaceWebhookEventType as Type } from './webhook.contracts';
@Injectable()
export class MercadoLivreWebhookDispatcher {
  constructor(
    private db: DataSource,
    private api: MercadoLivreApiClient,
    private tokens: MercadoLivreIntegrationService,
    private connector: MercadoLivreConnector,
    private listings: MercadoLivreProcessor,
    private orders: MarketplaceOrderProcessor,
    private bundles: BundlesCompositionService,
  ) {}
  async dispatch(
    e: MarketplaceWebhookEvent,
    c: SalesChannelConnection,
    deadline: number,
  ) {
    const check = () => {
      if (Date.now() > deadline)
        throw new MarketplaceConnectorError(
          'PROVIDER_TIMEOUT',
          'Tempo de processamento excedido.',
          true,
        );
    };
    const handlers: Record<string, () => Promise<Record<string, unknown>>> = {
      [Type.ORDER_CREATED]: () => this.order(e, c, check),
      [Type.ORDER_UPDATED]: () => this.order(e, c, check),
      [Type.ORDER_CANCELLED]: () => this.order(e, c, check),
      [Type.PAYMENT_APPROVED]: () => this.payment(e, c, check),
      [Type.SHIPMENT_UPDATED]: () => this.shipment(e, c, check),
      [Type.PRODUCT_UPDATED]: () => this.product(e, c, check),
      [Type.STOCK_UPDATED]: () =>
        e.topic === 'stock-location'
          ? this.stockLocations(e, c, check)
          : this.product(e, c, check),
    };
    const handler = handlers[e.eventType];
    return handler ? handler() : { classification: 'UNSUPPORTED' };
  }
  private async order(
    e: MarketplaceWebhookEvent,
    c: SalesChannelConnection,
    check: () => void,
  ) {
    if (!e.externalOrderId)
      throw new MarketplaceConnectorError(
        'VALIDATION_ERROR',
        'Pedido ausente.',
      );
    check();
    const order = await this.orders.ingest(
      c,
      e.externalOrderId,
      e.correlationId,
      'WEBHOOK',
      e.id,
    );
    return {
      orderId: order.id,
      eventType:
        order.externalStatus === 'cancelled' ||
        order.externalStatus === 'canceled'
          ? Type.ORDER_CANCELLED
          : String(order.paymentStatus) === 'PAID'
            ? Type.PAYMENT_APPROVED
            : e.eventType,
    };
  }
  private async payment(
    e: MarketplaceWebhookEvent,
    c: SalesChannelConnection,
    check: () => void,
  ) {
    const t = await this.tokens.validTokens(c);
    check();
    const p = await this.api.getCollection(
      t.accessToken!,
      e.externalResourceId!,
    );
    if (String(p.collector_id) !== c.externalAccountId || !p.order_id)
      throw new MarketplaceConnectorError(
        'RESOURCE_NOT_FOUND',
        'Pagamento não corresponde à conta ou pedido.',
      );
    e.externalOrderId = String(p.order_id);
    return this.order(e, c, check);
  }
  private async shipment(
    e: MarketplaceWebhookEvent,
    c: SalesChannelConnection,
    check: () => void,
  ) {
    const t = await this.tokens.validTokens(c);
    check();
    const shipment = await this.api.getShipment(
      t.accessToken!,
      e.externalShipmentId!,
    );
    if (String(shipment.sender_id) !== c.externalAccountId)
      throw new MarketplaceConnectorError(
        'RESOURCE_NOT_FOUND',
        'Envio não corresponde à conta.',
      );
    check();
    const items = await this.api.getShipmentItems(
      t.accessToken!,
      e.externalShipmentId!,
    );
    const ids = [
      ...new Set(
        items
          .filter(
            (i) => String(i.sender_id ?? i.seller_id) === c.externalAccountId,
          )
          .map((i) => String(i.order_id)),
      ),
    ];
    if (!ids.length)
      throw new MarketplaceConnectorError(
        'RESOURCE_NOT_FOUND',
        'Pedidos do envio não encontrados.',
      );
    for (const id of ids) {
      check();
      const order = await this.orders.ingest(
        c,
        id,
        e.correlationId,
        'WEBHOOK',
        e.id,
      );
      check();
      await this.db.transaction(async (m) => {
        const current = await m.getRepository(Order).findOne({
          where: { id: order.id, companyId: c.companyId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!current) return;
        const repo = m.getRepository(OrderShipment);
        const local = await repo.findOneBy({
          companyId: c.companyId,
          orderId: order.id,
          externalShipmentId: e.externalShipmentId!,
        });
        const updated = shipment.last_updated ?? shipment.date_last_updated;
        const at = updated ? new Date(updated) : null;
        if (
          !at ||
          !Number.isFinite(at.getTime()) ||
          (local?.externalUpdatedAt && local.externalUpdatedAt > at)
        )
          return;
        const status = new MercadoLivreOrderStatusMapper().map(
          'paid',
          'approved',
          shipment.status,
        ).shipping;
        if (status === ShippingStatus.UNKNOWN) return;
        const rank: Partial<Record<ShippingStatus, number>> = {
          [ShippingStatus.PENDING]: 0,
          [ShippingStatus.READY_TO_SHIP]: 1,
          [ShippingStatus.SHIPPED]: 2,
          [ShippingStatus.IN_TRANSIT]: 2,
          [ShippingStatus.DELIVERED]: 3,
        };
        if ((rank[status] ?? 10) < (rank[current.shippingStatus] ?? -1)) return;
        const previous = current.shippingStatus;
        const previousOrderStatus = current.status;
        const progressed = preserveImportedProgress(
          current,
          new MercadoLivreOrderStatusMapper().map(
            current.externalStatus ?? 'paid',
            current.externalPaymentStatus ?? 'approved',
            shipment.status,
          ),
        );
        current.status = progressed.order;
        current.shippingStatus = status;
        current.externalShippingStatus = shipment.status;
        await m.save(current);
        await repo.save({
          ...local,
          companyId: c.companyId,
          orderId: order.id,
          externalShipmentId: e.externalShipmentId!,
          status,
          substatus: shipment.substatus ?? null,
          logisticType: shipment.logistic_type ?? null,
          trackingNumber: shipment.tracking_number ?? null,
          carrierName: shipment.tracking_method ?? null,
          shippingAmount: current.shippingAmount,
          externalUpdatedAt: at,
          deliveredAt:
            status === ShippingStatus.DELIVERED
              ? new Date(
                  shipment.status_history?.date_delivered ?? at.toISOString(),
                )
              : (local?.deliveredAt ?? null),
          shippedAt: shipment.status_history?.date_shipped
            ? new Date(shipment.status_history.date_shipped)
            : status === ShippingStatus.SHIPPED
              ? at
              : (local?.shippedAt ?? null),
        });
        if (previous !== status)
          await m.getRepository(OrderStatusHistory).save({
            companyId: c.companyId,
            orderId: order.id,
            previousOrderStatus,
            newOrderStatus: current.status,
            previousShippingStatus: previous,
            newShippingStatus: status,
            source: OrderHistorySource.SHIPPING,
            externalEventId: `shipment:${shipment.id}:${at.toISOString()}`,
            reason: 'Atualização confirmada pela API do marketplace.',
            occurredAt: at,
            metadata: { webhookEventId: e.id },
          });
      });
    }
    return { classification: 'SHIPMENT_UPDATED', orders: ids };
  }
  private async stockLocations(
    e: MarketplaceWebhookEvent,
    c: SalesChannelConnection,
    check: () => void,
  ) {
    const t = await this.tokens.validTokens(c);
    check();
    const stock = await this.api.getUserProductStock(
      t.accessToken!,
      e.externalResourceId!,
    );
    if (String(stock.user_id) !== c.externalAccountId)
      throw new MarketplaceConnectorError(
        'RESOURCE_NOT_FOUND',
        'Estoque externo não corresponde à conta.',
      );
    let offset = 0,
      total = 1;
    const results: Array<Record<string, unknown>> = [];
    while (offset < total) {
      check();
      const page = await this.api.searchUserProductItems(
        t.accessToken!,
        c.externalAccountId,
        e.externalResourceId!,
        offset,
      );
      total = page.paging.total;
      if (!page.results.length) break;
      for (const itemId of page.results) {
        check();
        results.push(
          await this.product({ ...e, externalProductId: itemId }, c, check),
        );
      }
      offset += page.results.length;
    }
    return {
      classification: results.some(
        (r) => r.classification === 'EXTERNAL_CHANGE',
      )
        ? 'DIVERGENCE'
        : 'CONFIRMATION',
      userProductId: stock.id,
      items: results,
    };
  }
  private async product(
    e: MarketplaceWebhookEvent,
    c: SalesChannelConnection,
    check: () => void,
  ) {
    const t = await this.tokens.validTokens(c);
    check();
    let item: MercadoLivreItem;
    try {
      item = await this.api.getItem(t.accessToken!, e.externalProductId!);
    } catch (error) {
      if (
        error instanceof MarketplaceConnectorError &&
        error.code === 'RESOURCE_NOT_FOUND'
      ) {
        await this.db.query(
          `UPDATE product_marketplace_links SET status='INVALID',updated_at=now() WHERE company_id=$1 AND marketplace_listing_id IN(SELECT id FROM marketplace_listings WHERE company_id=$1 AND connection_id=$2 AND external_item_id=$3) AND status='ACTIVE'`,
          [c.companyId, c.id, e.externalProductId],
        );
      }
      throw error;
    }
    if (String(item.seller_id) !== c.externalAccountId)
      throw new MarketplaceConnectorError(
        'RESOURCE_NOT_FOUND',
        'Anúncio não corresponde à conta.',
      );
    const products = this.connector.mapProducts(item);
    let classification = 'CONFIRMATION';
    for (const p of products) {
      check();
      await this.listings.upsertListing(c, p);
      const listing = await this.db
        .getRepository(MarketplaceListing)
        .findOneBy({
          companyId: c.companyId,
          connectionId: c.id,
          externalItemId: p.externalId,
          externalVariationId: p.variationId ?? IsNull(),
        });
      if (!listing) continue;
      const link = await this.db
        .getRepository(ProductMarketplaceLink)
        .findOneBy({
          companyId: c.companyId,
          marketplaceListingId: listing.id,
          status: ProductMarketplaceLinkStatus.ACTIVE,
        });
      if (!link) continue;
      const composition = await this.bundles.describe(
        c.companyId,
        link.productId,
      );
      const b = await this.db
        .getRepository(InventoryBalance)
        .findOneBy({ companyId: c.companyId, productId: link.productId });
      const expected = composition.isBundle
        ? composition.availableKits
        : Math.max(
            0,
            Math.floor(
              Number(b?.currentQuantity ?? 0) -
                Number(b?.reservedQuantity ?? 0),
            ),
          );
      const last = await this.db.getRepository(MarketplaceStockSync).findOne({
        where: {
          companyId: c.companyId,
          productMarketplaceLinkId: link.id,
          status: StockSyncStatus.SUCCESS,
        },
        order: { synchronizedAt: 'DESC' },
      });
      if (p.availableQuantity === expected) {
        classification = 'CONFIRMATION';
        continue;
      }
      classification =
        last &&
        p.availableQuantity === last.sentQuantity &&
        b &&
        last.inventoryVersion < b.version &&
        last.synchronizedAt &&
        Date.now() - last.synchronizedAt.getTime() < 5 * 60000
          ? 'STALE_EVENT'
          : 'EXTERNAL_CHANGE';
      const repo = this.db.getRepository(MarketplaceStockDivergence);
      const exists = await repo.existsBy({
        companyId: c.companyId,
        productMarketplaceLinkId: link.id,
        status: StockDivergenceStatus.OPEN,
        expectedQuantity: expected,
        externalQuantity: p.availableQuantity ?? undefined,
      });
      if (!exists)
        await repo.save(
          repo.create({
            companyId: c.companyId,
            productId: link.productId,
            productMarketplaceLinkId: link.id,
            marketplaceAccountId: c.id,
            expectedQuantity: expected,
            externalQuantity: p.availableQuantity,
            status: StockDivergenceStatus.OPEN,
            detectedAt: new Date(),
            notes: `Webhook ${classification}; evento ${e.id}.`,
          }),
        );
    }
    return { classification, externalProductId: item.id };
  }
}
