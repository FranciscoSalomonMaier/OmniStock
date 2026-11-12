import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsPositive,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './product.dto';

class KitComponentDto {
  @IsUUID() productId: string;
  @IsInt() @IsPositive() quantity: number;
}

export class CreateKitDto extends OmitType(CreateProductDto, [
  'unitOfMeasure',
] as const) {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => KitComponentDto)
  components: KitComponentDto[];
}

export class UpdateKitDto extends PartialType(
  OmitType(CreateProductDto, ['unitOfMeasure'] as const),
) {}
