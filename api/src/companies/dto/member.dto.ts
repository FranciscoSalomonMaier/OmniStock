import { IsBoolean, IsEmail, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { CompanyRole } from '../../common/enums/company-role.enum';
const email = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
export class AddMemberDto {
  @Transform(({ value }) => email(value as unknown)) @IsEmail() email: string;
  @IsEnum(CompanyRole) role: CompanyRole;
}
export class UpdateMemberDto {
  @IsOptional() @IsEnum(CompanyRole) role?: CompanyRole;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
