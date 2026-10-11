import { PartialType, PickType } from '@nestjs/swagger';
import { CreateProductBundleComponentDto } from './create-product_bundle_component.dto';
export class UpdateProductBundleComponentDto extends PartialType(
  PickType(CreateProductBundleComponentDto, ['quantity'] as const),
) {}
