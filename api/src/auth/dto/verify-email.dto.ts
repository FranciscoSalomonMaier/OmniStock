import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: 'token-recebido-no-email' })
  @IsString()
  @MinLength(32, { message: 'Token de confirmação inválido' })
  token: string;
}
