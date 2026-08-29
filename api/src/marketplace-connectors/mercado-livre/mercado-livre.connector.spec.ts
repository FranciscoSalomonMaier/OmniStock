import { ConfigService } from '@nestjs/config';
import { MercadoLivreApiClient } from './mercado-livre-api.client';
import { MercadoLivreConnector } from './mercado-livre.connector';
describe('MercadoLivreConnector', () => {
  const config = new ConfigService({
    MERCADO_LIVRE_CONNECTOR_ENABLED: true,
    MERCADO_LIVRE_CLIENT_ID: '123',
    MERCADO_LIVRE_REDIRECT_URI: 'https://example.com/callback',
    MERCADO_LIVRE_AUTH_BASE_URL:
      'https://auth.mercadolivre.com.br/authorization',
  });
  const connector = new MercadoLivreConnector(
    config,
    {} as MercadoLivreApiClient,
  );
  it('gera URL oficial sem segredos', async () => {
    const result = await connector.getAuthorizationUrl({
      companyId: 'c',
      connectionId: 'x',
      redirectUri: '',
      state: 'state-value',
      codeChallenge: null,
    });
    const url = new URL(result.url);
    expect(url.origin).toBe('https://auth.mercadolivre.com.br');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('123');
    expect(url.searchParams.get('state')).toBe('state-value');
    expect(result.url).not.toContain('client_secret');
  });
  it('declara operações reais implementadas', () => {
    const capabilities = connector.getCapabilities();
    expect(capabilities.authorization.implemented).toBe(true);
    expect(capabilities.productImport.implemented).toBe(true);
    expect(capabilities.invoiceSubmission.implemented).toBe(false);
  });
});
