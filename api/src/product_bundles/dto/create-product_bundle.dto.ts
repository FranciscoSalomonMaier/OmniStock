import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class CreateProductBundleDto {
  @IsUUID()
  bundleProductId: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
