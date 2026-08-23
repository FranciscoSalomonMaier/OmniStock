import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesModule } from '../companies/companies.module';
import { SalesChannelConnectorRegistry } from './connectors/sales-channel-connector.registry';
import { SalesChannelConnection } from './entities/sales-channel-connection.entity';
import { SalesChannelCredential } from './entities/sales-channel-credential.entity';
import { SalesChannel } from './entities/sales-channel.entity';
import { SalesChannelConnectionsController, SalesChannelsCatalogController } from './sales-channels.controller';
import { SalesChannelCredentialsService } from './sales-channel-credentials.service';
import { SalesChannelsService } from './sales-channels.service';
import { TokenEncryptionService } from './token-encryption.service';

@Module({
  imports: [TypeOrmModule.forFeature([SalesChannel, SalesChannelConnection, SalesChannelCredential]), CompaniesModule],
  controllers: [SalesChannelsCatalogController, SalesChannelConnectionsController],
  providers: [SalesChannelsService, SalesChannelCredentialsService, TokenEncryptionService, SalesChannelConnectorRegistry],
  exports: [SalesChannelsService, SalesChannelCredentialsService, SalesChannelConnectorRegistry],
})
export class SalesChannelsModule {}
