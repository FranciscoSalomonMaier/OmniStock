import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MarketplaceConnectorError } from './marketplace-errors';
import { ConnectionPublicExceptionFilter } from './connection-public-exception.filter';
import { publicConnectionLastError } from './connection-public-error';
import { SalesChannelsService } from '../../sales-channels/sales-channels.service';

describe('Public connection failures', () => {
  const secret = 'PRIVATE_TOKEN_CONFIGURATION_AND_STACK';
  const id = 'c21f9505-2ef2-4108-9f48-403277cc3d91';
  afterEach(() => jest.restoreAllMocks());
  it('does not expose historical callback stages or provider messages from the connection API', async () => {
    const connection = {
      id: 'connection',
      lastErrorAt: new Date(),
      lastErrorCode: 'MERCADO_LIVRE_TOKEN_EXCHANGE_FAILED',
      lastErrorMessage: `${secret} Etapa: TOKEN_EXCHANGE. Diagnóstico: ${id}.`,
      channel: { id: 'channel' },
      tokenExpiresAt: null,
      grantedScopes: [],
    };
    const args = [
      { findOne: () => Promise.resolve(connection) },
      { findOne: () => Promise.resolve(connection) },
      { findOneBy: () => Promise.resolve(null) },
    ] as unknown as ConstructorParameters<typeof SalesChannelsService>;
    const result = await new SalesChannelsService(...args).response(
      'company',
      'connection',
    );
    expect(result.lastError).toMatchObject({
      code: 'CONNECTION_UNAVAILABLE',
      diagnosticId: id,
    });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain('TOKEN_EXCHANGE');
    expect(JSON.stringify(result)).not.toContain('MERCADO_LIVRE_');
  });
  it.each(['TOKEN_EXPIRED', 'REAUTH_REQUIRED'])(
    'offers reconnection for %s',
    (code) => {
      const result = publicConnectionLastError(new Date(), code, secret);
      expect(result.code).toBe('RECONNECT_REQUIRED');
      expect(result.message).toContain('reconectada');
      expect(JSON.stringify(result)).not.toContain(secret);
    },
  );
  it('sanitizes old errors with no diagnostic identifier', () => {
    const result = publicConnectionLastError(
      new Date(),
      'UNKNOWN_PROVIDER_ERROR',
      secret,
    );
    expect(result.code).toBe('CONNECTION_UNAVAILABLE');
    expect(result).not.toHaveProperty('diagnosticId');
    expect(JSON.stringify(result)).not.toContain(secret);
  });
  function setup() {
    const json = jest.fn();
    const response = { status: jest.fn().mockReturnThis(), json };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost;
    const log = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    return { response, host, log };
  }
  it.each([
    new MarketplaceConnectorError('INVALID_CREDENTIALS', secret, false, 400),
    new Error(secret),
    new ServiceUnavailableException(secret),
  ])('keeps internal errors out of HTTP responses and logs', (error) => {
    const { response, host, log } = setup();
    new ConnectionPublicExceptionFilter().catch(error, host);
    const calls = response.json.mock.calls as unknown as [
      { code: string; message: string; diagnosticId: string },
    ][];
    const body = calls[0][0];
    expect(body.code).toBe('CONNECTION_UNAVAILABLE');
    expect(body.message).toContain(body.diagnosticId);
    expect(body).not.toHaveProperty('providerStatus');
    expect(
      JSON.stringify(response.json.mock.calls) + JSON.stringify(log.mock.calls),
    ).not.toContain(secret);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ diagnosticId: body.diagnosticId }),
    );
  });
  it('preserves correctable input validation messages', () => {
    const { response, host, log } = setup();
    new ConnectionPublicExceptionFilter().catch(
      new BadRequestException('Selecione uma conexão.'),
      host,
    );
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Selecione uma conexão.' }),
    );
    expect(log).not.toHaveBeenCalled();
  });
});
