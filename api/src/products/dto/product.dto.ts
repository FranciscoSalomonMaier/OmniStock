import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { normalizeSku } from '../../common/utils/normalize-sku';
import {
  MerchandiseOrigin,
  ProductStatus,
  UnitOfMeasure,
} from '../enums/product.enums';
const trim = (v: unknown): unknown =>
  typeof v === 'string' ? v.trim() || null : v;
const digits = (v: unknown): unknown =>
  typeof v === 'string' ? v.replace(/\D/g, '') || null : v;
const normalizeBarcode = (value: unknown): unknown =>
  typeof value === 'string' ? value.replace(/\s/g, '') || null : value;
const transformSku = (value: unknown): unknown =>
  typeof value === 'string' ? normalizeSku(value) : value;
export class CreateProductDto {
  @Transform(({ value }) => transformSku(value as unknown))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(new RegExp('^[A-Z0-9._/-]+$'))
  sku: string;
  @IsString() @MinLength(2) @MaxLength(180) name: string;
  @IsOptional()
  @Transform(({ value }) => trim(value as unknown))
  @IsString()
  description?: string | null;
  @IsOptional()
  @Transform(({ value }) => normalizeBarcode(value as unknown))
  @Matches(/^\d{8}$|^\d{12,14}$/)
  barcode?: string | null;
  @IsEnum(UnitOfMeasure) unitOfMeasure: UnitOfMeasure;
  @IsOptional() @Matches(/^\d{1,13}(\.\d{1,2})?$/) costPrice?: string | null;
  @Matches(/^\d{1,13}(\.\d{1,2})?$/) salePrice: string;
  @IsOptional()
  @Transform(({ value }) => digits(value as unknown))
  @Length(8, 8)
  ncm?: string | null;
  @IsOptional()
  @Transform(({ value }) => digits(value as unknown))
  @Length(7, 7)
  cest?: string | null;
  @IsOptional()
  @Transform(({ value }) => digits(value as unknown))
  @Length(4, 4)
  defaultCfop?: string | null;
  @IsOptional()
  @IsEnum(MerchandiseOrigin)
  merchandiseOrigin?: MerchandiseOrigin | null;
  @IsOptional() @Matches(/^\d{1,9}(\.\d{1,3})?$/) weight?: string | null;
  @IsOptional() @Matches(/^\d{1,10}(\.\d{1,2})?$/) height?: string | null;
  @IsOptional() @Matches(/^\d{1,10}(\.\d{1,2})?$/) width?: string | null;
  @IsOptional() @Matches(/^\d{1,10}(\.\d{1,2})?$/) length?: string | null;
  @Matches(/^\d{1,12}(\.\d{1,3})?$/) minimumStock = '0';
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsUUID() categoryId?: string | null;
}
export class UpdateProductDto extends PartialType(CreateProductDto) {}
export class ChangeProductStatusDto {
  @IsEnum(ProductStatus) status: ProductStatus;
}
