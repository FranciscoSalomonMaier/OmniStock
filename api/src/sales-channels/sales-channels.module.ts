import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesModule } from '../companies/companies.module';
import { MarketplaceConnectorRegistry } from '../marketplace-connectors/core/marketplace-connector.registry';
import { MarketplaceCredentialProvider } from '../marketplace-connectors/core/marketplace-credential.provider';
import { MarketplaceIntegrationService } from '../marketplace-connectors/marketplace-integration.service';
import { MercadoLivreConnector } from '../marketplace-connectors/mercado-livre/mercado-livre.connector';
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
    ]),
    CompaniesModule,
  ],
  controllers: [
    SalesChannelsCatalogController,
    SalesChannelConnectionsController,
  ],
  providers: [
    SalesChannelsService,
    SalesChannelCredentialsService,
    TokenEncryptionService,
    MarketplaceCredentialProvider,
    MarketplaceIntegrationService,
    MarketplaceConnectorRegistry,
    MercadoLivreConnector,
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
