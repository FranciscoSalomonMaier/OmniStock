import { Type } from 'class-transformer';
import {
  IsEnum,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InventoryMovementType,
  InventoryReferenceType,
  InventoryReservationStatus,
} from '../enums/inventory.enums';
const quantity = /^(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?$/;
export class StockOperationDto {
  @ApiProperty({ example: '00000000-0000-4000-8000-000000000000' })
  @IsUUID()
  productId: string;
  @ApiProperty({ example: '10.000' }) @Matches(quantity) quantity: string;
  @ApiProperty() @IsString() @MaxLength(240) reason: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
export class AdjustmentDto {
  @IsUUID() productId: string;
  @Matches(quantity) countedQuantity: string;
  @IsString() @MaxLength(240) reason: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
export class ReservationDto extends StockOperationDto {
  @IsEnum(InventoryReferenceType) referenceType: InventoryReferenceType;
  @IsString() @MaxLength(160) referenceId: string;
  @IsOptional() @Type(() => Date) expiresAt?: Date;
}
export class ListInventoryDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE', 'DISCONTINUED']) status?: string;
  @IsOptional() @IsIn(['true', 'false']) belowMinimum?: string;
  @IsOptional() @IsIn(['true', 'false']) withReservation?: string;
  @IsOptional()
  @IsIn(['NORMAL', 'LOW', 'OUT', 'RESERVED'])
  stockSituation?: string;
  @IsIn([
    'sku',
    'name',
    'currentQuantity',
    'reservedQuantity',
    'availableQuantity',
    'minimumStock',
    'updatedAt',
  ])
  sortBy = 'updatedAt';
  @IsIn(['asc', 'desc']) sortDirection: 'asc' | 'desc' = 'desc';
}
export class ListMovementsDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(InventoryMovementType) type?: InventoryMovementType;
  @IsOptional() @IsUUID() performedByUserId?: string;
  @IsOptional()
  @IsEnum(InventoryReferenceType)
  referenceType?: InventoryReferenceType;
  @IsOptional() @IsString() referenceId?: string;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsIn(['asc', 'desc']) sortDirection: 'asc' | 'desc' = 'desc';
}
export class ListReservationsDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional()
  @IsEnum(InventoryReservationStatus)
  status?: InventoryReservationStatus;
}
