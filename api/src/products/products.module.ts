import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesModule } from '../companies/companies.module';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { ProductCategory } from './entities/product-category.entity';
import { ProductImage } from './entities/product-image.entity';
import { Product } from './entities/product.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { LocalStorageService } from './storage/local-storage.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductCategory, ProductImage]),
    CompaniesModule,
  ],
  controllers: [ProductsController, CategoriesController],
  providers: [ProductsService, CategoriesService, LocalStorageService],
})
export class ProductsModule {}
