import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProductStatus } from '../../products/enums/product.enums';
import {
  ProductMarketplaceLinkSource,
  ProductMarketplaceLinkStatus,
  ProductMarketplaceMatchedByField,
} from '../enums/product-marketplace-link.enums';

export class CreateProductMarketplaceLinkDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() productId: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() marketplaceListingId: string;
}

export class AcceptMarketplaceLinkSuggestionDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() productId: string;
}

export class UnlinkProductMarketplaceLinkDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class BulkProductMarketplaceLinksDto {
  @ApiProperty({ type: [CreateProductMarketplaceLinkDto], maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateProductMarketplaceLinkDto)
  links: CreateProductMarketplaceLinkDto[];
}

export class PaginationDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

export class ListProductMarketplaceLinksDto extends PaginationDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsString() productSku?: string;
  @IsOptional() @IsUUID() marketplaceListingId?: string;
  @IsOptional() @IsUUID() connectionId?: string;
  @IsOptional() @IsUUID() salesChannelId?: string;
  @IsOptional() @IsString() channelCode?: string;
  @IsOptional()
  @IsEnum(ProductMarketplaceLinkStatus)
  status?: ProductMarketplaceLinkStatus;
  @IsOptional()
  @IsEnum(ProductMarketplaceLinkSource)
  linkSource?: ProductMarketplaceLinkSource;
  @IsOptional()
  @IsEnum(ProductMarketplaceMatchedByField)
  matchedByField?: ProductMarketplaceMatchedByField;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsIn(['linkedAt', 'updatedAt', 'productSku', 'listingTitle'])
  sortBy: 'linkedAt' | 'updatedAt' | 'productSku' | 'listingTitle' = 'linkedAt';
  @IsIn(['asc', 'desc']) sortDirection: 'asc' | 'desc' = 'desc';
}

export class ListUnlinkedMarketplaceListingsDto extends PaginationDto {
  @IsOptional() @IsUUID() connectionId?: string;
  @IsOptional() @IsString() channelCode?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() externalSku?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() withSuggestion?: boolean;
  @IsOptional() @Type(() => Boolean) @IsBoolean() withoutSku?: boolean;
}

export class ListUnlinkedProductsDto extends PaginationDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsUUID() connectionId?: string;
  @IsOptional() @IsUUID() salesChannelId?: string;
  @IsOptional() @IsString() channelCode?: string;
}

export class ProductMarketplaceLinkResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: ProductMarketplaceLinkStatus })
  status: ProductMarketplaceLinkStatus;
  @ApiProperty({ enum: ProductMarketplaceLinkSource })
  linkSource: ProductMarketplaceLinkSource;
  @ApiPropertyOptional({ enum: ProductMarketplaceMatchedByField })
  matchedByField: ProductMarketplaceMatchedByField | null;
  @ApiPropertyOptional() matchConfidence: string | null;
  @ApiProperty() linkedAt: Date;
  @ApiPropertyOptional() unlinkedAt: Date | null;
  @ApiProperty() product: Record<string, unknown>;
  @ApiProperty() listing: Record<string, unknown>;
  @ApiProperty() channel: Record<string, unknown>;
  @ApiProperty() connection: Record<string, unknown>;
  @ApiProperty() linkedBy: Record<string, unknown>;
  @ApiPropertyOptional() unlinkedBy: Record<string, unknown> | null;
}
