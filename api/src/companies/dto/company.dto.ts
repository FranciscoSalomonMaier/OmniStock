import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
const digits = (value: unknown): unknown =>
  typeof value === 'string' ? value.replace(/\D/g, '') : value;
export class CreateCompanyDto {
  @IsString() @MinLength(2) @MaxLength(180) legalName: string;
  @IsString() @MinLength(2) @MaxLength(180) tradeName: string;
  @Transform(({ value }) => digits(value as unknown))
  @IsString()
  @Length(14, 14)
  document: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
}
export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {}
