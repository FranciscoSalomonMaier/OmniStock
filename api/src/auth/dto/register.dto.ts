import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const trim = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim() : value;
const normalizeEmail = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @ApiProperty({ example: 'Francisco Maier' })
  @IsString({ message: 'Nome inválido' })
  @MinLength(2, { message: 'O nome deve ter pelo menos 2 caracteres' })
  @MaxLength(120)
  @Transform(({ value }) => trim(value as unknown))
  name: string;

  @ApiProperty({ example: 'francisco@example.com' })
  @IsEmail({}, { message: 'E-mail inválido' })
  @Transform(({ value }) => normalizeEmail(value as unknown))
  email: string;

  @ApiProperty({ example: 'SenhaSegura123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres' })
  password: string;
}
