import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const normalizeEmail = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class LoginDto {
  @ApiProperty({ example: 'francisco@example.com' })
  @IsEmail({}, { message: 'E-mail inválido' })
  @Transform(({ value }) => normalizeEmail(value as unknown))
  email: string;

  @ApiProperty({ example: 'SenhaSegura123' })
  @IsString()
  @MinLength(8)
  password: string;
}
