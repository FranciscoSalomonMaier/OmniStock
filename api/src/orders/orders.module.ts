import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesModule } from '../companies/companies.module';
import { MarketplaceListing } from '../marketplace-connectors/mercado-livre/entities/marketplace-listing.entity';
import { MarketplaceOrderImportItem } from '../marketplace-connectors/mercado-livre/entities/marketplace-order-import-item.entity';
import { MarketplaceOrderImport } from '../marketplace-connectors/mercado-livre/entities/marketplace-order-import.entity';
import { ProductMarketplaceLink } from '../product-marketplace-links/entities/product-marketplace-link.entity';
import { Product } from '../products/entities/product.entity';
import { SalesChannelConnection } from '../sales-channels/entities/sales-channel-connection.entity';
import {
  CompanyOrderSequence,
  Order,
  OrderAddress,
  OrderCustomer,
  OrderFiscalData,
  OrderIssue,
  OrderItem,
  OrderPayment,
  OrderShipment,
  OrderStatusHistory,
} from './entities/order.entity';
import { MercadoLivreOrderStatusMapper } from './mappers/mercado-livre-order-status.mapper';
import { OrderImportService } from './order-import.service';
import { OrderStatusTransitionService } from './order-status-transition.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
const entities = [
  Order,
  CompanyOrderSequence,
  OrderItem,
  OrderCustomer,
  OrderAddress,
  OrderPayment,
  OrderShipment,
  OrderFiscalData,
  OrderIssue,
  OrderStatusHistory,
  MarketplaceOrderImport,
  MarketplaceOrderImportItem,
  MarketplaceListing,
  ProductMarketplaceLink,
  Product,
  SalesChannelConnection,
];
@Module({
  imports: [TypeOrmModule.forFeature(entities), CompaniesModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderImportService,
    OrderStatusTransitionService,
    MercadoLivreOrderStatusMapper,
  ],
  exports: [OrderImportService],
})
export class OrdersModule {}
