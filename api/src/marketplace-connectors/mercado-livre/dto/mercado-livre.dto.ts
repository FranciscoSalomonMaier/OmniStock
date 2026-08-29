import { IsUUID } from 'class-validator';
export class MercadoLivreAuthorizeDto {
  @IsUUID() connectionId: string;
}
