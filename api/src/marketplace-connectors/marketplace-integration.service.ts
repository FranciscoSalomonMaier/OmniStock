import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SalesChannelConnection } from '../sales-channels/entities/sales-channel-connection.entity';
import { SalesChannelConnectionStatus } from '../sales-channels/enums/sales-channel.enums';
import { SalesChannelsService } from '../sales-channels/sales-channels.service';
import { MarketplaceConnectorRegistry } from './core/marketplace-connector.registry';
import {
  connectorNotImplemented,
  MarketplaceConnectorError,
} from './core/marketplace-errors';
import { MarketplaceCredentialProvider } from './core/marketplace-credential.provider';
import type {
  ConnectorContext,
  MarketplaceCapabilities,
} from './core/marketplace-types';
@Injectable()
export class MarketplaceIntegrationService {
  constructor(
    private readonly connections: SalesChannelsService,
    private readonly registry: MarketplaceConnectorRegistry,
    private readonly credentialProvider: MarketplaceCredentialProvider,
  ) {}
  async capabilities(companyId: string, connectionId: string) {
    const connection = await this.connections.get(companyId, connectionId);
    return this.registry.getDescriptor(connection.channel.code);
  }
  async validateConnection(
    companyId: string,
    connectionId: string,
    userId: string,
  ) {
    const connection = await this.connections.get(companyId, connectionId);
    this.assertReady(connection);
    const connector = this.registry.get(connection.channel.code);
    this.assertImplemented(connector.getCapabilities(), 'authorization');
    try {
      const context = await this.context(connection);
      const result = await connector.validateConnection(context);
      await this.connections.clearIntegrationError(
        companyId,
        connectionId,
        userId,
      );
      return result;
    } catch (error) {
      await this.connections.recordIntegrationError(
        companyId,
        connectionId,
        userId,
        error,
      );
      throw error;
    }
  }
  private assertReady(connection: SalesChannelConnection) {
    if (connection.status === SalesChannelConnectionStatus.DISABLED)
      throw new MarketplaceConnectorError(
        'CONNECTION_DISABLED',
        'Esta conexão está desabilitada.',
      );
    if (connection.status === SalesChannelConnectionStatus.DISCONNECTED)
      throw new MarketplaceConnectorError(
        'CONNECTION_NOT_READY',
        'Esta conexão foi desconectada.',
      );
  }
  private assertImplemented(
    capabilities: MarketplaceCapabilities,
    operation: keyof MarketplaceCapabilities,
  ) {
    const capability = capabilities[operation];
    if (!capability.supportedByProvider)
      throw new MarketplaceConnectorError(
        'OPERATION_NOT_SUPPORTED',
        'Este canal não oferece suporte a esta operação.',
      );
    if (!capability.implemented) throw connectorNotImplemented();
  }
  private async context(
    connection: SalesChannelConnection,
  ): Promise<ConnectorContext> {
    const credentials = await this.credentialProvider.get(
      connection.companyId,
      connection.id,
    );
    return {
      companyId: connection.companyId,
      connectionId: connection.id,
      channelCode: connection.channel.code,
      externalAccountId: connection.externalAccountId,
      correlationId: randomUUID(),
      operationId: randomUUID(),
      locale: 'pt-BR',
      credentials,
      metadata: Object.freeze({}),
    };
  }
}
