import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
export class CreateCategoryDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsOptional() @IsString() description?: string;
}
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
