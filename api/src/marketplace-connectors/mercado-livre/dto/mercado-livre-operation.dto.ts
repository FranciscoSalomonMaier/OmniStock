import { IsInt, IsNumber, IsString, IsUUID, Min } from 'class-validator';
export class UpdateMarketplaceStockDto {
  @IsUUID() listingId: string;
  @IsInt() @Min(0) availableQuantity: number;
  @IsUUID() idempotencyKey: string;
}
export class UpdateMarketplacePriceDto {
  @IsUUID() listingId: string;
  @IsNumber() @Min(0.01) price: number;
  @IsString() currency: string;
  @IsUUID() idempotencyKey: string;
}
