import { MercadoLivreWebhookService } from './mercado-livre-webhook.service';
describe('MercadoLivreWebhookService compatibility facade', () => {
  it('delegates to the single durable webhook pipeline without another order queue', async () => {
    const receive = jest.fn().mockResolvedValue({ received: true });
    const service = new MercadoLivreWebhookService({ receive } as never);
    const payload = { topic: 'orders_v2', resource: '/orders/1' };
    await expect(service.receive(payload)).resolves.toEqual({ received: true });
    expect(receive).toHaveBeenCalledWith({ payload });
  });
});
