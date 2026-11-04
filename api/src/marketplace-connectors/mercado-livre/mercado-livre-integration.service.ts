import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { MarketplaceCredentialProvider } from '../core/marketplace-credential.provider';
import {
  publicConnectionError,
  connectionUnavailableMessage,
} from '../core/connection-public-error';
import { MarketplaceConnectorError } from '../core/marketplace-errors';
import { SalesChannelConnection } from '../../sales-channels/entities/sales-channel-connection.entity';
import {
  SalesChannelCode,
  SalesChannelConnectionStatus,
} from '../../sales-channels/enums/sales-channel.enums';
import { MercadoLivreConnector } from './mercado-livre.connector';
import { MercadoLivreApiClient } from './mercado-livre-api.client';
import { TokenEncryptionService } from '../../sales-channels/token-encryption.service';
import { OAuthAuthorizationState } from './entities/oauth-authorization-state.entity';
type CallbackStage =
  | 'VALIDATE_STATE'
  | 'LOAD_CONNECTION'
  | 'TOKEN_EXCHANGE'
  | 'ACCOUNT_LOOKUP'
  | 'SAVE_CREDENTIALS'
  | 'SAVE_CONNECTION';
const callbackCodes: Record<CallbackStage, string> = {
  VALIDATE_STATE: 'MERCADO_LIVRE_INVALID_STATE',
  LOAD_CONNECTION: 'MERCADO_LIVRE_CONNECTION_LOOKUP_FAILED',
  TOKEN_EXCHANGE: 'MERCADO_LIVRE_TOKEN_EXCHANGE_FAILED',
  ACCOUNT_LOOKUP: 'MERCADO_LIVRE_ACCOUNT_LOOKUP_FAILED',
  SAVE_CREDENTIALS: 'MERCADO_LIVRE_CREDENTIAL_SAVE_FAILED',
  SAVE_CONNECTION: 'MERCADO_LIVRE_CONNECTION_SAVE_FAILED',
};
@Injectable()
export class MercadoLivreIntegrationService {
  private readonly frontendUrl: string;
  private readonly logger = new Logger(MercadoLivreIntegrationService.name);
  constructor(
    @InjectRepository(OAuthAuthorizationState)
    private readonly states: Repository<OAuthAuthorizationState>,
    @InjectRepository(SalesChannelConnection)
    private readonly connections: Repository<SalesChannelConnection>,
    private readonly dataSource: DataSource,
    private readonly connector: MercadoLivreConnector,
    private readonly api: MercadoLivreApiClient,
    private readonly credentialProvider: MarketplaceCredentialProvider,
    config: ConfigService,
    private readonly encryption: TokenEncryptionService,
  ) {
    this.frontendUrl = config.getOrThrow<string>('FRONTEND_URL');
  }
  async authorize(companyId: string, connectionId: string, userId: string) {
    await this.connection(companyId, connectionId);
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    const state = randomBytes(32).toString('base64url'),
      expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.states.save(
      this.states.create({
        stateHash: this.hash(state),
        encryptedCodeVerifier: this.encryption.encrypt(codeVerifier),
        companyId,
        connectionId,
        userId,
        channelCode: SalesChannelCode.MERCADO_LIVRE,
        returnPath: '/integrations/mercado-livre/callback',
        expiresAt,
        consumedAt: null,
      }),
    );
    const result = await this.connector.getAuthorizationUrl({
      companyId,
      connectionId,
      redirectUri: '',
      state,
      codeChallenge,
    });
    return { authorizationUrl: result.url, expiresAt };
  }
  async callback(
    code: string | undefined,
    state: string | undefined,
    error: string | undefined,
  ) {
    const diagnosticId = randomUUID();
    if (error)
      return this.callbackFailure(
        'MERCADO_LIVRE_AUTHORIZATION_DENIED',
        'VALIDATE_STATE',
        diagnosticId,
      );
    if (!code || !state)
      return this.callbackFailure(
        callbackCodes.VALIDATE_STATE,
        'VALIDATE_STATE',
        diagnosticId,
      );
    let oauth: OAuthAuthorizationState & { codeVerifier: string };
    try {
      oauth = await this.consumeState(state);
    } catch (error: unknown) {
      return this.callbackFailure(
        error instanceof MarketplaceConnectorError &&
          error.code === 'VALIDATION_ERROR'
          ? callbackCodes.VALIDATE_STATE
          : 'MERCADO_LIVRE_STATE_VALIDATION_FAILED',
        'VALIDATE_STATE',
        diagnosticId,
        error,
      );
    }
    let stage: CallbackStage = 'LOAD_CONNECTION';
    try {
      const connection = await this.connection(
        oauth.companyId,
        oauth.connectionId,
      );
      const context = {
        companyId: oauth.companyId,
        connectionId: oauth.connectionId,
        channelCode: SalesChannelCode.MERCADO_LIVRE,
        externalAccountId: connection.externalAccountId,
        correlationId: diagnosticId,
        operationId: randomUUID(),
        locale: 'pt-BR',
        metadata: {},
      };
      stage = 'TOKEN_EXCHANGE';
      const authorization = await this.connector.exchangeAuthorizationCode({
        context,
        code,
        codeVerifier: oauth.codeVerifier,
        redirectUri: '',
      });
      stage = 'ACCOUNT_LOOKUP';
      const account = await this.api.getCurrentUser(authorization.accessToken);
      stage = 'SAVE_CREDENTIALS';
      await this.credentialProvider.save(oauth.companyId, oauth.connectionId, {
        accessToken: authorization.accessToken,
        refreshToken: authorization.refreshToken ?? undefined,
      });
      stage = 'SAVE_CONNECTION';
      connection.externalAccountId = String(account.id);
      connection.externalAccountName = account.nickname;
      connection.status = SalesChannelConnectionStatus.CONNECTED;
      connection.connectedAt = new Date();
      connection.disconnectedAt = null;
      connection.tokenExpiresAt = authorization.tokenExpiresAt;
      connection.grantedScopes = authorization.grantedScopes;
      connection.lastErrorAt = null;
      connection.lastErrorCode = null;
      connection.lastErrorMessage = null;
      connection.updatedByUserId = oauth.userId;
      connection.metadata = {
        siteId: account.site_id,
        countryId: account.country_id,
      };
      await this.connections.save(connection);
      return `${this.frontendUrl}${oauth.returnPath}?status=success&connectionId=${connection.id}`;
    } catch (error: unknown) {
      const failureCode = callbackCodes[stage];
      const redirect = this.callbackFailure(
        failureCode,
        stage,
        diagnosticId,
        error,
      );
      try {
        await this.connections.update(
          { id: oauth.connectionId, companyId: oauth.companyId },
          {
            lastErrorAt: new Date(),
            lastErrorCode: failureCode,
            lastErrorMessage: `${connectionUnavailableMessage} Código de atendimento: ${diagnosticId}.`,
          },
        );
      } catch {
        this.logger.warn({
          event: 'mercado_livre.oauth.diagnostic_save_failed',
          diagnosticId,
        });
      }
      return redirect;
    }
  }
  async account(companyId: string, connectionId: string) {
    const connection = await this.connection(companyId, connectionId),
      tokens = await this.validTokens(connection);
    const user = await this.api.getCurrentUser(tokens.accessToken!);
    if (String(user.id) !== connection.externalAccountId)
      throw new MarketplaceConnectorError(
        'CONFLICT',
        'A conta retornada não corresponde à conexão.',
      );
    return {
      externalAccountId: String(user.id),
      nickname: user.nickname,
      siteId: user.site_id,
      countryId: user.country_id,
      status: user.status?.site_status ?? null,
    };
  }
  async validTokens(connection: SalesChannelConnection) {
    if (
      !connection.tokenExpiresAt ||
      connection.tokenExpiresAt.getTime() > Date.now() + 5 * 60 * 1000
    )
      return this.credentialProvider.get(connection.companyId, connection.id);
    return this.credentialProvider.withRefreshLock(connection.id, async () => {
      const fresh = await this.connections.findOneByOrFail({
        id: connection.id,
        companyId: connection.companyId,
      });
      const current = await this.credentialProvider.get(
        connection.companyId,
        connection.id,
      );
      if (
        fresh.tokenExpiresAt &&
        fresh.tokenExpiresAt.getTime() > Date.now() + 5 * 60 * 1000
      )
        return current;
      if (!current.refreshToken)
        throw new MarketplaceConnectorError(
          'REAUTH_REQUIRED',
          'A conta precisa ser reconectada.',
        );
      try {
        const result = await this.connector.refreshToken({
          context: {
            companyId: fresh.companyId,
            connectionId: fresh.id,
            channelCode: SalesChannelCode.MERCADO_LIVRE,
            externalAccountId: fresh.externalAccountId,
            correlationId: randomUUID(),
            operationId: randomUUID(),
            locale: 'pt-BR',
            metadata: {},
            credentials: current,
          },
          refreshToken: current.refreshToken,
        });
        await this.credentialProvider.save(fresh.companyId, fresh.id, {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken ?? current.refreshToken,
        });
        fresh.tokenExpiresAt = result.tokenExpiresAt;
        await this.connections.save(fresh);
        return {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken ?? current.refreshToken,
        };
      } catch (error) {
        fresh.status = SalesChannelConnectionStatus.REAUTH_REQUIRED;
        await this.connections.save(fresh);
        throw error;
      }
    });
  }
  private async consumeState(state: string) {
    return this.dataSource.transaction(async (manager) => {
      const value = await manager
        .getRepository(OAuthAuthorizationState)
        .createQueryBuilder('state')
        .setLock('pessimistic_write')
        .where('state.stateHash = :hash', { hash: this.hash(state) })
        .getOne();
      if (!value || value.consumedAt || value.expiresAt.getTime() <= Date.now())
        throw new MarketplaceConnectorError(
          'VALIDATION_ERROR',
          'State OAuth inválido.',
        );
      // Pre-PKCE attempts cannot be completed safely: require a new authorization.
      if (!value.encryptedCodeVerifier)
        throw new MarketplaceConnectorError(
          'VALIDATION_ERROR',
          'PKCE verifier unavailable',
        );
      const codeVerifier = this.encryption.decrypt(value.encryptedCodeVerifier);
      if (!/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier))
        throw new MarketplaceConnectorError(
          'VALIDATION_ERROR',
          'Invalid PKCE verifier',
        );
      value.consumedAt = new Date();
      value.encryptedCodeVerifier = null;
      await manager.save(value);
      return { ...value, codeVerifier };
    });
  }
  private async connection(companyId: string, id: string) {
    const connection = await this.connections.findOne({
      where: { id, companyId },
      relations: { channel: true },
    });
    if (
      !connection ||
      connection.channel.code !== SalesChannelCode.MERCADO_LIVRE
    )
      throw new MarketplaceConnectorError(
        'CONNECTOR_NOT_FOUND',
        'Conexão do Mercado Livre não encontrada.',
      );
    return connection;
  }
  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
  private callbackFailure(
    code: string,
    stage: CallbackStage,
    diagnosticId: string,
    error?: unknown,
  ) {
    // Deliberately exclude exception messages, stacks, causes, provider bodies and URLs.
    this.logger.warn({
      event: 'mercado_livre.oauth.failed',
      diagnosticId,
      stage,
      code,
      providerStatus:
        error instanceof MarketplaceConnectorError
          ? error.providerStatus
          : null,
      connectorCode:
        error instanceof MarketplaceConnectorError ? error.code : null,
    });
    return this.errorRedirect(publicConnectionError(code).code, diagnosticId);
  }
  private errorRedirect(code: string, diagnosticId: string) {
    return `${this.frontendUrl}/integrations/mercado-livre/callback?status=error&code=${encodeURIComponent(code)}&diagnosticId=${diagnosticId}`;
  }
}
