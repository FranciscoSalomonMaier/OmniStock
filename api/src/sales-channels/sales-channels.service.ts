import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketplaceConnectorError } from '../marketplace-connectors/core/marketplace-errors';
import {
  CreateSalesChannelConnectionDto,
  UpdateSalesChannelConnectionDto,
} from './dto/sales-channel.dto';
import { SalesChannelConnection } from './entities/sales-channel-connection.entity';
import { SalesChannelCredential } from './entities/sales-channel-credential.entity';
import { SalesChannel } from './entities/sales-channel.entity';
import { SalesChannelConnectionStatus } from './enums/sales-channel.enums';
@Injectable()
export class SalesChannelsService {
  private readonly logger = new Logger(SalesChannelsService.name);
  constructor(
    @InjectRepository(SalesChannel) private channels: Repository<SalesChannel>,
    @InjectRepository(SalesChannelConnection)
    private connections: Repository<SalesChannelConnection>,
    @InjectRepository(SalesChannelCredential)
    private credentials: Repository<SalesChannelCredential>,
  ) {}
  catalog() {
    return this.channels.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }
  async channel(id: string) {
    const x = await this.channels.findOneBy({ id, isActive: true });
    if (!x) throw new NotFoundException('Canal não encontrado');
    return x;
  }
  async create(
    companyId: string,
    userId: string,
    dto: CreateSalesChannelConnectionDto,
  ) {
    const channel = await this.channel(dto.salesChannelId);
    const saved = await this.connections.save(
      this.connections.create({
        companyId,
        salesChannelId: channel.id,
        displayName: dto.displayName,
        status: SalesChannelConnectionStatus.PENDING,
        externalAccountId: null,
        externalAccountName: null,
        connectedAt: null,
        disconnectedAt: null,
        tokenExpiresAt: null,
        grantedScopes: [],
        lastSyncAt: null,
        lastSuccessfulSyncAt: null,
        lastErrorAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        metadata: null,
        createdByUserId: userId,
        updatedByUserId: null,
      }),
    );
    this.audit('connection.created', saved, userId);
    return this.view(saved, channel);
  }
  async list(companyId: string) {
    return Promise.all(
      (
        await this.connections.find({
          where: { companyId },
          relations: { channel: true },
          order: { createdAt: 'DESC' },
        })
      ).map((x) => this.view(x, x.channel)),
    );
  }
  async get(companyId: string, id: string) {
    const x = await this.connections.findOne({
      where: { id, companyId },
      relations: { channel: true },
    });
    if (!x) throw new NotFoundException('Conexão não encontrada');
    return x;
  }
  async response(companyId: string, id: string) {
    const x = await this.get(companyId, id);
    return this.view(x, x.channel);
  }
  async rename(
    companyId: string,
    id: string,
    userId: string,
    dto: UpdateSalesChannelConnectionDto,
  ) {
    const x = await this.get(companyId, id);
    if (dto.displayName) x.displayName = dto.displayName;
    x.updatedByUserId = userId;
    return this.view(await this.connections.save(x), x.channel);
  }
  async status(
    companyId: string,
    id: string,
    userId: string,
    status: SalesChannelConnectionStatus,
  ) {
    const x = await this.get(companyId, id);
    x.status = status;
    x.updatedByUserId = userId;
    this.audit('connection.status', x, userId);
    return this.view(await this.connections.save(x), x.channel);
  }
  async disconnect(companyId: string, id: string, userId: string) {
    const x = await this.get(companyId, id);
    await this.credentials.delete({ companyId, connectionId: id });
    x.status = SalesChannelConnectionStatus.DISCONNECTED;
    x.disconnectedAt = new Date();
    x.updatedByUserId = userId;
    this.audit('connection.disconnected', x, userId);
    return this.view(await this.connections.save(x), x.channel);
  }
  async recordIntegrationError(
    companyId: string,
    id: string,
    userId: string,
    error: unknown,
  ) {
    const x = await this.get(companyId, id);
    x.lastErrorAt = new Date();
    x.lastErrorCode =
      error instanceof MarketplaceConnectorError
        ? error.code
        : 'UNKNOWN_PROVIDER_ERROR';
    x.lastErrorMessage =
      error instanceof MarketplaceConnectorError
        ? error.message
        : 'Não foi possível concluir a operação com o canal.';
    x.updatedByUserId = userId;
    await this.connections.save(x);
    this.audit('integration.failed', x, userId);
  }
  async clearIntegrationError(companyId: string, id: string, userId: string) {
    const x = await this.get(companyId, id);
    x.lastErrorAt = null;
    x.lastErrorCode = null;
    x.lastErrorMessage = null;
    x.updatedByUserId = userId;
    await this.connections.save(x);
    this.audit('integration.validated', x, userId);
  }
  private async view(x: SalesChannelConnection, channel: SalesChannel) {
    const credential = await this.credentials.findOneBy({
      companyId: x.companyId,
      connectionId: x.id,
    });
    return {
      id: x.id,
      channel: {
        id: channel.id,
        code: channel.code,
        name: channel.name,
        type: channel.type,
        supportsOAuth: channel.supportsOAuth,
        supportsProducts: channel.supportsProducts,
        supportsOrders: channel.supportsOrders,
        supportsStock: channel.supportsStock,
        supportsPrices: channel.supportsPrices,
        supportsInvoices: channel.supportsInvoices,
      },
      displayName: x.displayName,
      externalAccountId: x.externalAccountId,
      externalAccountName: x.externalAccountName,
      status: x.status,
      connectedAt: x.connectedAt,
      disconnectedAt: x.disconnectedAt,
      tokenExpiresAt: x.tokenExpiresAt,
      grantedScopes: { raw: x.grantedScopes, capabilities: null },
      lastSyncAt: x.lastSyncAt,
      lastSuccessfulSyncAt: x.lastSuccessfulSyncAt,
      lastError: x.lastErrorAt
        ? {
            at: x.lastErrorAt,
            code: x.lastErrorCode,
            message: x.lastErrorMessage,
          }
        : null,
      hasAccessToken: Boolean(credential?.encryptedAccessToken),
      hasRefreshToken: Boolean(credential?.encryptedRefreshToken),
      tokenExpiresSoon: Boolean(
        x.tokenExpiresAt && x.tokenExpiresAt.getTime() - Date.now() < 86400000,
      ),
      requiresReauthorization: [
        SalesChannelConnectionStatus.TOKEN_EXPIRED,
        SalesChannelConnectionStatus.REAUTH_REQUIRED,
      ].includes(x.status),
      createdAt: x.createdAt,
      updatedAt: x.updatedAt,
    };
  }
  private audit(event: string, x: SalesChannelConnection, userId: string) {
    this.logger.log({
      event,
      companyId: x.companyId,
      connectionId: x.id,
      channelId: x.salesChannelId,
      userId,
    });
  }
}
