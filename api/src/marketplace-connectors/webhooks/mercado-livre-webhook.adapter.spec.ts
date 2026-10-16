import { ConfigService } from '@nestjs/config';
import { MercadoLivreWebhookAdapter } from './mercado-livre-webhook.adapter';
import { MarketplaceWebhookEventType as Type } from './webhook.contracts';
const base = {
  application_id: 123,
  user_id: 456,
  topic: 'orders_v2',
  resource: '/orders/789',
  sent: '2026-10-13T10:00:00Z',
  received: '2026-10-13T09:59:59Z',
  attempts: 1,
};
describe('MercadoLivreWebhookAdapter', () => {
  const adapter = new MercadoLivreWebhookAdapter(
    new ConfigService({ MERCADO_LIVRE_CLIENT_ID: '123' }),
  );
  it('accepts the official notification including received and normalizes safely', async () => {
    const e = await adapter.normalize({ payload: base });
    expect(e).toMatchObject({
      externalAccountId: '456',
      externalOrderId: '789',
      eventType: Type.ORDER_UPDATED,
    });
    expect(e.payload).not.toHaveProperty('companyId');
  });
  it.each([
    { ...base, application_id: 999 },
    { ...base, user_id: {} },
    { ...base, companyId: 'attacker' },
    { ...base, resource: 'https://attacker.test/orders/1' },
    { ...base, resource: '/orders/1?token=secret' },
    { ...base, access_token: 'secret' },
    { ...base, received: 'bad date' },
  ])(
    'rejects malformed, untrusted or confidential payloads',
    async (payload) => {
      await expect(adapter.normalize({ payload })).rejects.toThrow(
        'Notificação inválida.',
      );
    },
  );
  it.each([
    ['items', '/items/MLB123', Type.PRODUCT_UPDATED],
    ['stock-location', '/user-products/MLBU123/stock', Type.STOCK_UPDATED],
    ['shipments', '/shipments/42', Type.SHIPMENT_UPDATED],
    ['payments', '/collections/42', Type.PAYMENT_APPROVED],
    ['created_orders', '/orders/42', Type.ORDER_CREATED],
  ])(
    'maps %s to a verified resource handler',
    async (topic, resource, eventType) => {
      expect(
        (await adapter.normalize({ payload: { ...base, topic, resource } }))
          .eventType,
      ).toBe(eventType);
    },
  );
  it('stores unsupported topics without routing arbitrary API paths', async () => {
    expect(
      (
        await adapter.normalize({
          payload: { ...base, topic: 'questions', resource: '/questions/1' },
        })
      ).eventType,
    ).toBe(Type.UNKNOWN);
  });
});
