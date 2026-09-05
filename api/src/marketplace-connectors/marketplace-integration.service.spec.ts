import { SalesChannelConnection } from '../sales-channels/entities/sales-channel-connection.entity';
import {
  SalesChannelCode,
  SalesChannelConnectionStatus,
} from '../sales-channels/enums/sales-channel.enums';
import { SalesChannelsService } from '../sales-channels/sales-channels.service';
import { MarketplaceConnector } from './core/marketplace-connector.interface';
import { MarketplaceConnectorRegistry } from './core/marketplace-connector.registry';
import { MarketplaceCredentialProvider } from './core/marketplace-credential.provider';
import { MarketplaceIntegrationService } from './marketplace-integration.service';

describe('MarketplaceIntegrationService', () => {
  it('carrega as credenciais antes de validar uma conexão', async () => {
    const connection = {
      id: 'connection-id',
      companyId: 'company-id',
      externalAccountId: 'seller-id',
      status: SalesChannelConnectionStatus.CONNECTED,
      channel: { code: SalesChannelCode.MERCADO_LIVRE },
    } as SalesChannelConnection;
    const credentials = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    };
    const validateConnection = jest.fn().mockResolvedValue({ valid: true });
    const connector = {
      getCapabilities: () => ({
        authorization: { supportedByProvider: true, implemented: true },
      }),
      validateConnection,
    } as unknown as MarketplaceConnector;
    const clearIntegrationError = jest.fn();
    const connections = {
      get: jest.fn().mockResolvedValue(connection),
      recordIntegrationError: jest.fn(),
      clearIntegrationError,
    } as unknown as SalesChannelsService;
    const registry = {
      get: jest.fn().mockReturnValue(connector),
    } as unknown as MarketplaceConnectorRegistry;
    const getCredentials = jest.fn().mockResolvedValue(credentials);
    const credentialProvider = {
      get: getCredentials,
    } as unknown as MarketplaceCredentialProvider;
    const service = new MarketplaceIntegrationService(
      connections,
      registry,
      credentialProvider,
    );

    await expect(
      service.validateConnection(
        connection.companyId,
        connection.id,
        'user-id',
      ),
    ).resolves.toEqual({ valid: true });
    expect(getCredentials).toHaveBeenCalledWith(
      connection.companyId,
      connection.id,
    );
    expect(validateConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: connection.companyId,
        connectionId: connection.id,
        externalAccountId: connection.externalAccountId,
        credentials,
      }),
    );
    expect(clearIntegrationError).toHaveBeenCalledWith(
      connection.companyId,
      connection.id,
      'user-id',
    );
  });
});
