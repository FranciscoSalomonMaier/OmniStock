import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const normalizeEmail = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class ResendVerificationDto {
  @ApiProperty({ example: 'francisco@example.com' })
  @IsEmail({}, { message: 'E-mail inválido' })
  @Transform(({ value }) => normalizeEmail(value as unknown))
  email: string;
}
