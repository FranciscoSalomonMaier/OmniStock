import { PartialType } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateSalesChannelConnectionDto {
  @IsUUID()
  salesChannelId: string;
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  displayName: string;
}
export class RenameSalesChannelConnectionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  displayName: string;
}
export class UpdateSalesChannelConnectionDto extends PartialType(RenameSalesChannelConnectionDto) {}
