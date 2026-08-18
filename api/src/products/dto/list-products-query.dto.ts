import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ProductStatus, UnitOfMeasure } from '../enums/product.enums';
export class ListProductsQueryDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsEnum(UnitOfMeasure) unitOfMeasure?: UnitOfMeasure;
  @IsOptional() @IsString() minSalePrice?: string;
  @IsOptional() @IsString() maxSalePrice?: string;
  @IsIn(['createdAt', 'updatedAt', 'name', 'sku', 'salePrice']) sortBy =
    'createdAt';
  @IsIn(['asc', 'desc']) sortDirection: 'asc' | 'desc' = 'desc';
}
