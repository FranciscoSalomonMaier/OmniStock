import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { TokenEncryptionService } from '../../sales-channels/token-encryption.service';
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
    const encryption = new TokenEncryptionService(
      new ConfigService({
        MARKETPLACE_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString(
          'base64',
        ),
      }),
    );
    const verifier = 'v'.repeat(43);
    const states = {
      create: jest.fn((value: unknown) => value),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const oauth = {
      encryptedCodeVerifier: encryption.encrypt(verifier),
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
      getAuthorizationUrl: jest.fn().mockResolvedValue({
        url: 'https://auth.example.test',
        expiresAt: new Date(),
      }),
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
      states,
      connections,
      { transaction: async (fn: (m: unknown) => unknown) => await fn(manager) },
      connector,
      api,
      credentials,
      { getOrThrow: () => 'https://app.example.test' },
      encryption,
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
      states,
      encryption,
      verifier,
      oauth,
      manager,
    };
  }
  it('stores only the encrypted verifier and sends its S256 challenge', async () => {
    const x = setup();
    const result = await x.service.authorize('company', 'connection', 'user');
    const stored = x.states.create.mock.calls[0][0] as {
      encryptedCodeVerifier: Parameters<TokenEncryptionService['decrypt']>[0];
      stateHash: string;
    };
    const verifier = x.encryption.decrypt(stored.encryptedCodeVerifier);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    expect(x.connector.getAuthorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({ codeChallenge: challenge }),
    );
    expect(JSON.stringify(stored)).not.toContain(verifier);
    expect(JSON.stringify(result)).not.toContain(verifier);
    await x.service.authorize('company', 'connection', 'user');
    const next = x.states.create.mock.calls[1][0] as typeof stored;
    expect(x.encryption.decrypt(next.encryptedCodeVerifier)).not.toBe(verifier);
  });
  it('uses the bound verifier once and clears it in the state transaction', async () => {
    const x = setup();
    await x.service.callback(secret, secret, undefined);
    expect(x.connector.exchangeAuthorizationCode).toHaveBeenCalledWith(
      expect.objectContaining({ codeVerifier: x.verifier }),
    );
    expect(x.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        encryptedCodeVerifier: null,
        consumedAt: expect.any(Date) as unknown,
      }),
    );
    const replay = await x.service.callback(secret, secret, undefined);
    expect(replay).toContain('AUTHORIZATION_EXPIRED');
    expect(x.connector.exchangeAuthorizationCode).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain(x.verifier);
  });
  it.each(['legacy', 'expired', 'tampered'])(
    'rejects %s state without requesting a token',
    async (kind) => {
      const x = setup();
      if (kind === 'legacy')
        x.oauth.encryptedCodeVerifier =
          null as unknown as typeof x.oauth.encryptedCodeVerifier;
      if (kind === 'expired') x.oauth.expiresAt = new Date(0);
      if (kind === 'tampered')
        x.oauth.encryptedCodeVerifier.ciphertext = 'invalid';
      const url = await x.service.callback(secret, secret, undefined);
      expect(url).toContain(
        kind === 'tampered'
          ? 'CONNECTION_UNAVAILABLE'
          : 'AUTHORIZATION_EXPIRED',
      );
      expect(x.connector.exchangeAuthorizationCode).not.toHaveBeenCalled();
    },
  );
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
      expect(params.get('code')).toBe('CONNECTION_UNAVAILABLE');
      expect(url).not.toContain(stage);
      const saved = x.connections.update.mock.calls[0] as unknown as [
        unknown,
        { lastErrorMessage: string },
      ];
      expect(saved[1].lastErrorMessage).not.toContain(stage);
      expect(saved[1].lastErrorMessage).not.toContain('OAuth');
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
        expect.objectContaining({
          lastErrorMessage: expect.stringContaining(
            'Código de atendimento:',
          ) as unknown,
        }),
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
    ).resolves.toContain('CONNECTION_UNAVAILABLE');
    expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
  });
  it('rejects invalid states before exchanging a code', async () => {
    const x = setup();
    x.query.getOne.mockResolvedValueOnce(null);
    const url = await x.service.callback(secret, secret, undefined);
    expect(url).toContain('AUTHORIZATION_EXPIRED');
    expect(x.connector.exchangeAuthorizationCode).not.toHaveBeenCalled();
    expect(x.connections.update).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
  });
  it('does not log incoming authorization errors', async () => {
    const x = setup();
    const url = await x.service.callback(undefined, undefined, secret);
    expect(url).toContain('AUTHORIZATION_CANCELLED');
    expect(JSON.stringify(log.mock.calls) + url).not.toContain(secret);
  });
});
