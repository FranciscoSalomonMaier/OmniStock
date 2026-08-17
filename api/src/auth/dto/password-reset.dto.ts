import { IsEmail, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { Match } from '../../users/dto/validation.decorators';
const email = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
export class ForgotPasswordDto {
  @Transform(({ value }) => email(value as unknown)) @IsEmail() email: string;
}
export class ResetPasswordDto {
  @IsString() @MinLength(32) token: string;
  @IsString() @MinLength(8) password: string;
  @IsString()
  @MinLength(8)
  @Match('password', { message: 'A confirmação da senha não confere' })
  passwordConfirmation: string;
}
