import { IsString, MaxLength, MinLength } from 'class-validator';
import { Match } from './validation.decorators';
export class UpdateProfileDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
}
export class ChangePasswordDto {
  @IsString() @MinLength(8) currentPassword: string;
  @IsString() @MinLength(8) newPassword: string;
  @IsString()
  @MinLength(8)
  @Match('newPassword', { message: 'A confirmação da senha não confere' })
  newPasswordConfirmation: string;
}
