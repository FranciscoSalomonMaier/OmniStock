import { withProviderDeadline } from '../core/provider-request-budget';
import { ConfigService } from '@nestjs/config';
import { MercadoLivreApiClient } from './mercado-livre-api.client';

describe('MercadoLivreApiClient provider errors', () => {
  const client = new MercadoLivreApiClient(
    new ConfigService({
      MERCADO_LIVRE_CLIENT_SECRET: 'private-secret',
    }),
  );
  afterEach(() => jest.restoreAllMocks());

  it('preserves HTTP status, provider code and validation causes without credentials', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'validation_error',
          message: 'Invalid quantity private-secret private-token',
          cause: [
            {
              code: 'item.available_quantity.invalid',
              message: 'Quantity must be positive',
            },
          ],
        }),
        { status: 400, headers: { 'x-request-id': 'request-123' } },
      ),
    );
    try {
      await client.updateItem('private-token', 'MLB123', {
        available_quantity: 0,
      });
      throw new Error('Expected rejection');
    } catch (error) {
      expect(error).toMatchObject({
        providerStatus: 400,
        providerRequestId: 'request-123',
        retryable: false,
      });
      const message = (error as Error).message;
      expect(message).toContain('HTTP 400');
      expect(message).toContain('validation_error');
      expect(message).toContain('item.available_quantity.invalid');
      expect(message).not.toContain('private-secret');
      expect(message).not.toContain('private-token');
    }
  });

  it('keeps authentication classification when provider returns HTML', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('<html>blocked</html>', { status: 401 }));
    await expect(
      client.updateItem('token', 'MLB123', { available_quantity: 0 }),
    ).rejects.toMatchObject({
      code: 'REAUTH_REQUIRED',
      providerStatus: 401,
      retryable: false,
    });
  });
  it('delegates 429 retries to the durable webhook worker and preserves Retry-After', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'rate_limit' }), {
        status: 429,
        headers: { 'retry-after': '3' },
      }),
    );
    await expect(
      withProviderDeadline(Date.now() + 30000, () =>
        client.getCurrentUser('private-token'),
      ),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('does not call the provider after an expired processing budget', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    await expect(
      withProviderDeadline(Date.now() - 1, () =>
        client.getCurrentUser('private-token'),
      ),
    ).rejects.toMatchObject({ code: 'PROVIDER_TIMEOUT' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
