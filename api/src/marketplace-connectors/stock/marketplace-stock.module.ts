import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesModule } from '../../companies/companies.module';
import { InventoryBalance } from '../../inventory/entities/inventory-balance.entity';
import { InventoryOutboxEvent } from '../../inventory/entities/inventory-outbox-event.entity';
import { ProductMarketplaceLink } from '../../product-marketplace-links/entities/product-marketplace-link.entity';
import { SalesChannelConnection } from '../../sales-channels/entities/sales-channel-connection.entity';
import { SalesChannelsModule } from '../../sales-channels/sales-channels.module';
import { MARKETPLACE_STOCK_SYNC_QUEUE } from './marketplace-stock.jobs';
import { MarketplaceStockController } from './marketplace-stock.controller';
import {
  MarketplaceStockProcessor,
  StockOutboxSchedule,
} from './marketplace-stock.processor';
import {
  MarketplaceStockDivergence,
  MarketplaceStockSync,
} from './marketplace-stock-sync.entity';
import { MarketplaceStockSyncService } from './marketplace-stock-sync.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryBalance,
      InventoryOutboxEvent,
      ProductMarketplaceLink,
      SalesChannelConnection,
      MarketplaceStockSync,
      MarketplaceStockDivergence,
    ]),
    CompaniesModule,
    SalesChannelsModule,
    BullModule.registerQueue({ name: MARKETPLACE_STOCK_SYNC_QUEUE }),
  ],
  controllers: [MarketplaceStockController],
  providers: [
    MarketplaceStockSyncService,
    MarketplaceStockProcessor,
    StockOutboxSchedule,
  ],
  exports: [MarketplaceStockSyncService],
})
export class MarketplaceStockModule {}
