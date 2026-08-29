import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MercadoLivreNotificationDto } from './dto/mercado-livre-notification.dto';
import { MercadoLivreWebhookService } from './mercado-livre-webhook.service';
@ApiTags('Mercado Livre webhook')
@Controller('webhooks/mercado-livre')
export class MercadoLivreWebhookController {
  constructor(private readonly service: MercadoLivreWebhookService) {}
  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Recebe e enfileira notificações oficiais do Mercado Livre',
  })
  receive(@Body() dto: MercadoLivreNotificationDto) {
    return this.service.receive(dto);
  }
}
