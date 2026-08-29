import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
export class MercadoLivreNotificationDto {
  @IsOptional() @IsString() @MaxLength(120) _id?: string;
  @IsString() @MaxLength(500) resource: string;
  @IsString() @MaxLength(80) topic: string;
  @IsNotEmpty() user_id: string | number;
  @IsNotEmpty() application_id: string | number;
  @IsOptional() @IsInt() attempts?: number;
  @IsOptional() @IsDateString() sent?: string;
}
