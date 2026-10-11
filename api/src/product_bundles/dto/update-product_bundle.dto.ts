import { PartialType } from '@nestjs/mapped-types';
import { CreateProductBundleDto } from './create-product_bundle.dto';

export class UpdateProductBundleDto extends PartialType(
  CreateProductBundleDto,
) {}
