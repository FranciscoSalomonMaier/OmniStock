import {
  Order,
  OrderShipment,
  OrderStatusHistory,
} from '../../orders/entities/order.entity';
import {
  OrderStatus,
  PaymentStatus,
  ShippingStatus,
  FiscalStatus,
} from '../../orders/enums/order.enums';
import { MercadoLivreWebhookDispatcher } from './mercado-livre-webhook.dispatcher';
import { MarketplaceWebhookEventType as Type } from './webhook.contracts';
import { MarketplaceListing } from '../mercado-livre/entities/marketplace-listing.entity';
import { ProductMarketplaceLink } from '../../product-marketplace-links/entities/product-marketplace-link.entity';
import { InventoryBalance } from '../../inventory/entities/inventory-balance.entity';
import {
  MarketplaceStockSync,
  MarketplaceStockDivergence,
} from '../stock/marketplace-stock-sync.entity';

describe('MercadoLivreWebhookDispatcher', () => {
  const c = { id: 'account', companyId: 'company', externalAccountId: '456' };
  const e = {
    id: 'event',
    correlationId: 'correlation',
    externalOrderId: '789',
    externalResourceId: '42',
    externalShipmentId: '42',
    externalProductId: 'MLB123',
    eventType: Type.ORDER_UPDATED,
  };
  let db: { getRepository: jest.Mock; transaction?: jest.Mock };
  let productMapper: { mapProducts: jest.Mock };
  let tokens: { validTokens: jest.Mock },
    api: {
      getCollection: jest.Mock;
      getItem: jest.Mock;
      getShipment: jest.Mock;
      getShipmentItems: jest.Mock;
    },
    orders: { ingest: jest.Mock },
    divergence: { existsBy: jest.Mock; create: jest.Mock; save: jest.Mock },
    listings: { upsertListing: jest.Mock },
    dispatcher: MercadoLivreWebhookDispatcher;
  beforeEach(() => {
    tokens = {
      validTokens: jest
        .fn()
        .mockResolvedValue({ accessToken: 'test-only-token' }),
    };
    api = {
      getCollection: jest.fn().mockResolvedValue({
        collector_id: 456,
        order_id: 789,
        status: 'approved',
      }),
      getItem: jest.fn().mockResolvedValue({ id: 'MLB123', seller_id: 456 }),
      getShipment: jest.fn().mockResolvedValue({
        id: 42,
        sender_id: 456,
        status: 'delivered',
        last_updated: '2026-10-13T10:00:00Z',
      }),
      getShipmentItems: jest
        .fn()
        .mockResolvedValue([{ order_id: 789, sender_id: 456 }]),
    };
    orders = {
      ingest: jest.fn().mockResolvedValue({
        id: 'order',
        externalStatus: 'paid',
        paymentStatus: 'PAID',
      }),
    };
    listings = { upsertListing: jest.fn().mockResolvedValue(undefined) };
    divergence = {
      existsBy: jest.fn().mockResolvedValue(false),
      create: jest.fn((x) => x as unknown),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const getRepository = jest.fn((entity: unknown) => {
      if (entity === MarketplaceListing)
        return { findOneBy: jest.fn().mockResolvedValue({ id: 'listing' }) };
      if (entity === ProductMarketplaceLink)
        return {
          findOneBy: jest
            .fn()
            .mockResolvedValue({ id: 'link', productId: 'product' }),
        };
      if (entity === InventoryBalance)
        return {
          findOneBy: jest.fn().mockResolvedValue({
            currentQuantity: '10',
            reservedQuantity: '2',
          }),
        };
      if (entity === MarketplaceStockSync)
        return { findOne: jest.fn().mockResolvedValue({ sentQuantity: 8 }) };
      if (entity === MarketplaceStockDivergence) return divergence;
      throw Error('Unexpected repository');
    });
    db = { getRepository };
    productMapper = {
      mapProducts: jest
        .fn()
        .mockReturnValue([{ externalId: 'MLB123', availableQuantity: 8 }]),
    };
    dispatcher = new MercadoLivreWebhookDispatcher(
      db as never,
      api as never,
      tokens as never,
      productMapper as never,
      listings as never,
      orders as never,
      { describe: jest.fn().mockResolvedValue({ isBundle: false }) } as never,
    );
  });
  it.each([Type.ORDER_CREATED, Type.ORDER_UPDATED, Type.ORDER_CANCELLED])(
    'reuses the same order pipeline for %s',
    async (eventType) => {
      await dispatcher.dispatch(
        { ...e, eventType } as never,
        c as never,
        Date.now() + 30000,
      );
      expect(orders.ingest).toHaveBeenCalledWith(
        c,
        '789',
        'correlation',
        'WEBHOOK',
        'event',
      );
    },
  );
  it('payment refreshes credentials and reimports the authoritative order', async () => {
    await dispatcher.dispatch(
      { ...e, eventType: Type.PAYMENT_APPROVED } as never,
      c as never,
      Date.now() + 30000,
    );
    expect(tokens.validTokens).toHaveBeenCalledWith(c);
    expect(api.getCollection).toHaveBeenCalledWith('test-only-token', '42');
    expect(orders.ingest).toHaveBeenCalledTimes(1);
  });
  it('rejects a payment from another collector', async () => {
    api.getCollection.mockResolvedValue({ collector_id: 999, order_id: 789 });
    await expect(
      dispatcher.dispatch(
        { ...e, eventType: Type.PAYMENT_APPROVED } as never,
        c as never,
        Date.now() + 30000,
      ),
    ).rejects.toThrow();
    expect(orders.ingest).not.toHaveBeenCalled();
  });
  it('stock confirmation does not write central stock or generate outbound jobs', async () => {
    const r = await dispatcher.dispatch(
      { ...e, eventType: Type.PRODUCT_UPDATED } as never,
      c as never,
      Date.now() + 30000,
    );
    expect(r.classification).toBe('CONFIRMATION');
    expect(divergence.save).not.toHaveBeenCalled();
    expect(listings.upsertListing).toHaveBeenCalledTimes(1);
  });
  it('rejects a foreign seller before updating listing or stock', async () => {
    api.getItem.mockResolvedValue({ id: 'MLB123', seller_id: 999 });
    await expect(
      dispatcher.dispatch(
        { ...e, eventType: Type.PRODUCT_UPDATED } as never,
        c as never,
        Date.now() + 30000,
      ),
    ).rejects.toThrow();
    expect(listings.upsertListing).not.toHaveBeenCalled();
  });
  it('checks the processing deadline before HTTP and ingestion', async () => {
    await expect(
      dispatcher.dispatch(e as never, c as never, Date.now() - 1),
    ).rejects.toThrow('Tempo de processamento');
    expect(orders.ingest).not.toHaveBeenCalled();
  });
  it('does not issue requests for unknown events', async () => {
    expect(
      await dispatcher.dispatch(
        { ...e, eventType: Type.UNKNOWN } as never,
        c as never,
        Date.now() + 30000,
      ),
    ).toEqual({ classification: 'UNSUPPORTED' });
    expect(orders.ingest).not.toHaveBeenCalled();
  });
  it('records external divergence without changing central stock', async () => {
    productMapper.mapProducts.mockReturnValue([
      { externalId: 'MLB123', availableQuantity: 4 },
    ]);
    const result = await dispatcher.dispatch(
      { ...e, eventType: Type.STOCK_UPDATED } as never,
      c as never,
      Date.now() + 30000,
    );
    expect(result.classification).toBe('EXTERNAL_CHANGE');
    expect(divergence.save).toHaveBeenCalledWith(
      expect.objectContaining({ expectedQuantity: 8, externalQuantity: 4 }),
    );
  });
  it('does not create another equivalent open divergence', async () => {
    productMapper.mapProducts.mockReturnValue([
      { externalId: 'MLB123', availableQuantity: 4 },
    ]);
    divergence.existsBy.mockResolvedValue(true);
    await dispatcher.dispatch(
      { ...e, eventType: Type.PRODUCT_UPDATED } as never,
      c as never,
      Date.now() + 30000,
    );
    expect(divergence.save).not.toHaveBeenCalled();
  });
  it('imports all shipment orders and updates verified tracking with history', async () => {
    const current = {
      id: 'order',
      status: OrderStatus.SHIPPED,
      paymentStatus: PaymentStatus.PAID,
      shippingStatus: ShippingStatus.SHIPPED,
      fiscalStatus: FiscalStatus.AUTHORIZED,
      shippingAmount: '0',
      externalStatus: 'paid',
      externalPaymentStatus: 'approved',
    };
    const save = jest.fn().mockResolvedValue(undefined),
      shipmentSave = jest.fn().mockResolvedValue(undefined),
      historySave = jest.fn().mockResolvedValue(undefined);
    const manager = {
      save,
      getRepository: (entity: unknown) =>
        entity === Order
          ? { findOne: jest.fn().mockResolvedValue(current) }
          : entity === OrderShipment
            ? {
                findOneBy: jest.fn().mockResolvedValue({
                  id: 'shipment',
                  externalUpdatedAt: new Date('2026-10-12T10:00:00Z'),
                }),
                save: shipmentSave,
              }
            : entity === OrderStatusHistory
              ? { save: historySave }
              : null,
    };
    db.transaction = jest.fn((work: (m: never) => Promise<unknown>) =>
      work(manager as never),
    );
    api.getShipment.mockResolvedValue({
      id: 42,
      sender_id: 456,
      status: 'delivered',
      last_updated: '2026-10-13T10:00:00Z',
      tracking_number: 'TEST-TRACK',
    });
    await dispatcher.dispatch(
      { ...e, eventType: Type.SHIPMENT_UPDATED } as never,
      c as never,
      Date.now() + 30000,
    );
    expect(current.shippingStatus).toBe(ShippingStatus.DELIVERED);
    expect(current.status).toBe(OrderStatus.DELIVERED);
    expect(shipmentSave).toHaveBeenCalledWith(
      expect.objectContaining({ trackingNumber: 'TEST-TRACK' }),
    );
    expect(historySave).toHaveBeenCalledTimes(1);
  });
  it('does not regress shipment when API response is older than stored version', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const manager = {
      save,
      getRepository: (entity: unknown) =>
        entity === Order
          ? {
              findOne: jest.fn().mockResolvedValue({
                id: 'order',
                shippingStatus: ShippingStatus.DELIVERED,
              }),
            }
          : {
              findOneBy: jest.fn().mockResolvedValue({
                externalUpdatedAt: new Date('2026-10-14T10:00:00Z'),
              }),
            },
    };
    db.transaction = jest.fn((work: (m: never) => Promise<unknown>) =>
      work(manager as never),
    );
    await dispatcher.dispatch(
      { ...e, eventType: Type.SHIPMENT_UPDATED } as never,
      c as never,
      Date.now() + 30000,
    );
    expect(save).not.toHaveBeenCalled();
  });
});
