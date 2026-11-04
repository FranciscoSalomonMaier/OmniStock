import { Logger } from '@nestjs/common';
import { MercadoLivreIntegrationService } from './mercado-livre-integration.service';
import { MarketplaceConnectorError } from '../core/marketplace-errors';

describe('Mercado Livre OAuth callback diagnostics', () => {
  const secret = 'DO_NOT_LOG_ACCESS_TOKEN_CLIENT_SECRET_AUTH_CODE';
  let log: jest.SpyInstance;
  beforeEach(() => {
    log = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  function setup() {
    const oauth = {
      companyId: 'company',
      connectionId: 'connection',
      userId: 'user',
      returnPath: '/integrations/mercado-livre/callback',
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
    };
    const query = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(oauth),
    };
    const connections = {
      findOne: jest.fn().mockResolvedValue({
        id: 'connection',
        channel: { code: 'MERCADO_LIVRE' },
      }),
      save: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    };
    const connector = {
      exchangeAuthorizationCode: jest.fn().mockResolvedValue({
        accessToken: secret,
        refreshToken: secret,
        tokenExpiresAt: new Date(),
        grantedScopes: [],
      }),
    };
    const api = {
      getCurrentUser: jest
        .fn()
        .mockResolvedValue({ id: 123, nickname: 'seller' }),
    };
    const credentials = { save: jest.fn().mockResolvedValue(undefined) };
    const manager = {
      getRepository: () => ({ createQueryBuilder: () => query }),
      save: jest.fn().mockResolvedValue(oauth),
    };
    const args = [
      {},
      connections,
      { transaction: async (fn: (m: unknown) => unknown) => await fn(manager) },
      connector,
      api,
      credentials,
      { getOrThrow: () => 'https://app.example.test' },
    ] as unknown as ConstructorParameters<
      typeof MercadoLivreIntegrationService
    >;
    return {
      service: new MercadoLivreIntegrationService(...args),
      connections,
      connector,
      api,
      credentials,
      query,
    };
  }
  it('connects successfully without logging tokens and clears prior errors', async () => {
    const { service, connections } = setup();
    const url = await service.callback(secret, secret, undefined);
    expect(new URL(url).searchParams.get('status')).toBe('success');
    expect(connections.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'CONNECTED', lastErrorCode: null }),
    );
    expect(log).not.toHaveBeenCalled();
  });
  it.each([
    'LOAD_CONNECTION',
    'TOKEN_EXCHANGE',
    'ACCOUNT_LOOKUP',
    'SAVE_CREDENTIALS',
    'SAVE_CONNECTION',
  ] as const)(
    'identifies %s without leaking provider errors',
    async (stage) => {
      const x = setup();
      const error = new MarketplaceConnectorError(
        'INVALID_CREDENTIALS',
        secret,
        false,
        403,
        null,
        null,
        new Error(secret),
      );
      const operation = {
        LOAD_CONNECTION: x.connections.findOne,
        TOKEN_EXCHANGE: x.connector.exchangeAuthorizationCode,
        ACCOUNT_LOOKUP: x.api.getCurrentUser,
        SAVE_CREDENTIALS: x.credentials.save,
        SAVE_CONNECTION: x.connections.save,
      }[stage];
      operation.mockRejectedValueOnce(error);
      const url = await x.service.callback(secret, secret, undefined);
      const params = new URL(url).searchParams;
      expect(params.get('status')).toBe('error');
      expect(params.get('diagnosticId')).toMatch(/^[0-9a-f-]{36}$/);
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({
          stage,
          providerStatus: 403,
          connectorCode: 'INVALID_CREDENTIALS',
          diagnosticId: params.get('diagnosticId'),
        }),
      );
      expect(x.connections.update).toHaveBeenCalledWith(
        { id: 'connection', companyId: 'company' },
        expect.objectContaining({ lastErrorCode: params.get('code') }),
      );
      expect(
        JSON.stringify(log.mock.calls) +
          JSON.stringify(x.connections.update.mock.calls) +
          url,
      ).not.toContain(secret);
      if (stage === 'TOKEN_EXCHANGE')
        expect(x.api.getCurrentUser).not.toHaveBeenCalled();
      if (stage === 'ACCOUNT_LOOKUP')
        expect(x.credentials.save).not.toHaveBeenCalled();
    },
  );
  it('does not expose unexpected exception messages or stacks', async () => {
    const x = setup();
    x.credentials.save.mockRejectedValueOnce(new Error(secret));
    const url = await x.service.callback(secret, secret, undefined);
    expect(JSON.stringify(log.mock.calls) + url).not.toContain(secret);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'SAVE_CREDENTIALS',
        providerStatus: null,
        connectorCode: null,
      }),
    );
  });
  it('still redirects if writing the last error fails', async () => {
    const x = setup();
    x.api.getCurrentUser.mockRejectedValueOnce(new Error(secret));
    x.connections.update.mockRejectedValueOnce(new Error(secret));
    await expect(
      x.service.callback(secret, secret, undefined),
    ).resolves.toContain('MERCADO_LIVRE_ACCOUNT_LOOKUP_FAILED');
    expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
  });
  it('rejects invalid states before exchanging a code', async () => {
    const x = setup();
    x.query.getOne.mockResolvedValueOnce(null);
    const url = await x.service.callback(secret, secret, undefined);
    expect(url).toContain('MERCADO_LIVRE_INVALID_STATE');
    expect(x.connector.exchangeAuthorizationCode).not.toHaveBeenCalled();
    expect(x.connections.update).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
  });
  it('does not log incoming authorization errors', async () => {
    const x = setup();
    const url = await x.service.callback(undefined, undefined, secret);
    expect(url).toContain('MERCADO_LIVRE_AUTHORIZATION_DENIED');
    expect(JSON.stringify(log.mock.calls) + url).not.toContain(secret);
  });
});
