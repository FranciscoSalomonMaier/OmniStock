import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import {
  FiscalStatus,
  OrderSource,
  OrderStatus,
  PaymentStatus,
  ShippingStatus,
} from '../enums/order.enums';
export class ListOrdersDto {
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page =
    1;
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() internalNumber?: string;
  @IsOptional() @IsString() externalOrderId?: string;
  @IsOptional() @IsEnum(OrderSource) source?: OrderSource;
  @IsOptional() @IsString() channelCode?: string;
  @IsOptional() @IsUUID() connectionId?: string;
  @IsOptional() @IsEnum(OrderStatus) orderStatus?: OrderStatus;
  @IsOptional() @IsEnum(PaymentStatus) paymentStatus?: PaymentStatus;
  @IsOptional() @IsEnum(ShippingStatus) shippingStatus?: ShippingStatus;
  @IsOptional() @IsEnum(FiscalStatus) fiscalStatus?: FiscalStatus;
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() productSku?: string;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  withIssues?: boolean;
  @IsOptional()
  @IsIn([
    'internalNumber',
    'purchasedAt',
    'totalAmount',
    'status',
    'createdAt',
    'updatedAt',
  ])
  sortBy = 'purchasedAt';
  @IsOptional() @IsIn(['asc', 'desc']) sortDirection: 'asc' | 'desc' = 'desc';
}
export class CancelOrderDto {
  @IsString() @Length(3, 500) reason: string;
}
export class ResolveOrderIssueDto {
  @IsString() @Length(3, 500) justification: string;
}
