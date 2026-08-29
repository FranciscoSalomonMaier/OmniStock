import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { CompaniesModule } from '../companies/companies.module';
import { MarketplaceConnectorRegistry } from '../marketplace-connectors/core/marketplace-connector.registry';
import { MarketplaceCredentialProvider } from '../marketplace-connectors/core/marketplace-credential.provider';
import { MarketplaceIntegrationService } from '../marketplace-connectors/marketplace-integration.service';
import { MercadoLivreConnector } from '../marketplace-connectors/mercado-livre/mercado-livre.connector';
import { MercadoLivreApiClient } from '../marketplace-connectors/mercado-livre/mercado-livre-api.client';
import { MercadoLivreIntegrationService } from '../marketplace-connectors/mercado-livre/mercado-livre-integration.service';
import { MercadoLivreController } from '../marketplace-connectors/mercado-livre/mercado-livre.controller';
import { OAuthAuthorizationState } from '../marketplace-connectors/mercado-livre/entities/oauth-authorization-state.entity';
import { MarketplaceListing } from '../marketplace-connectors/mercado-livre/entities/marketplace-listing.entity';
import { MarketplaceOrderImport } from '../marketplace-connectors/mercado-livre/entities/marketplace-order-import.entity';
import { MarketplaceOrderImportItem } from '../marketplace-connectors/mercado-livre/entities/marketplace-order-import-item.entity';
import { MarketplaceSyncRun } from '../marketplace-connectors/mercado-livre/entities/marketplace-sync-run.entity';
import { MarketplaceNotification } from '../marketplace-connectors/mercado-livre/entities/marketplace-notification.entity';
import { MERCADO_LIVRE_QUEUE } from '../marketplace-connectors/mercado-livre/mercado-livre.jobs';
import { MercadoLivreSyncService } from '../marketplace-connectors/mercado-livre/mercado-livre-sync.service';
import { MercadoLivreProcessor } from '../marketplace-connectors/mercado-livre/mercado-livre.processor';
import { MercadoLivreWebhookService } from '../marketplace-connectors/mercado-livre/mercado-livre-webhook.service';
import { MercadoLivreWebhookController } from '../marketplace-connectors/mercado-livre/mercado-livre-webhook.controller';
import { MercadoLivreOperationsService } from '../marketplace-connectors/mercado-livre/mercado-livre-operations.service';
import { ShopeeConnector } from '../marketplace-connectors/shopee/shopee.connector';
import { AmazonConnector } from '../marketplace-connectors/amazon/amazon.connector';
import { MagaluConnector } from '../marketplace-connectors/magalu/magalu.connector';
import { SalesChannelConnection } from './entities/sales-channel-connection.entity';
import { SalesChannelCredential } from './entities/sales-channel-credential.entity';
import { SalesChannel } from './entities/sales-channel.entity';
import {
  SalesChannelConnectionsController,
  SalesChannelsCatalogController,
} from './sales-channels.controller';
import { SalesChannelCredentialsService } from './sales-channel-credentials.service';
import { SalesChannelsService } from './sales-channels.service';
import { TokenEncryptionService } from './token-encryption.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalesChannel,
      SalesChannelConnection,
      SalesChannelCredential,
      OAuthAuthorizationState,
      MarketplaceListing,
      MarketplaceOrderImport,
      MarketplaceOrderImportItem,
      MarketplaceSyncRun,
      MarketplaceNotification,
    ]),
    CompaniesModule,
    BullModule.registerQueue({ name: MERCADO_LIVRE_QUEUE }),
  ],
  controllers: [
    SalesChannelsCatalogController,
    SalesChannelConnectionsController,
    MercadoLivreController,
    MercadoLivreWebhookController,
  ],
  providers: [
    SalesChannelsService,
    SalesChannelCredentialsService,
    TokenEncryptionService,
    MarketplaceCredentialProvider,
    MarketplaceIntegrationService,
    MarketplaceConnectorRegistry,
    MercadoLivreConnector,
    MercadoLivreApiClient,
    MercadoLivreIntegrationService,
    MercadoLivreSyncService,
    MercadoLivreProcessor,
    MercadoLivreWebhookService,
    MercadoLivreOperationsService,
    ShopeeConnector,
    AmazonConnector,
    MagaluConnector,
  ],
  exports: [
    SalesChannelsService,
    SalesChannelCredentialsService,
    MarketplaceCredentialProvider,
    MarketplaceIntegrationService,
    MarketplaceConnectorRegistry,
  ],
})
export class SalesChannelsModule {}
