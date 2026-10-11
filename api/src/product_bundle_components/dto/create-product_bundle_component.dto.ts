import { IsInt, IsPositive, IsUUID, IsOptional } from 'class-validator';

export class CreateProductBundleComponentDto {
  @IsOptional()
  @IsUUID()
  bundleProductId?: string;

  @IsUUID()
  componentProductId: string;

  @IsInt()
  @IsPositive()
  quantity: number;
}
