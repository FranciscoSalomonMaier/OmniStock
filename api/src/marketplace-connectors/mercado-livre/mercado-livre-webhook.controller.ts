import type { Request } from 'express';
import {
  Body,
  Controller,
  HttpCode,
  Post,
  HttpException,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBody, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MercadoLivreWebhookService } from './mercado-livre-webhook.service';
@ApiTags('Mercado Livre webhook')
@Controller('webhooks')
export class MercadoLivreWebhookController {
  constructor(private readonly service: MercadoLivreWebhookService) {}
  @Post('mercado-livre')
  @HttpCode(200)
  @Throttle({
    default: {
      limit: Number(process.env.MARKETPLACE_WEBHOOK_RATE_LIMIT ?? 120),
      ttl:
        Number(process.env.MARKETPLACE_WEBHOOK_RATE_WINDOW_SECONDS ?? 60) *
        1000,
    },
  })
  @ApiOperation({
    summary: 'Recebe e enfileira notificações oficiais do Mercado Livre',
  })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['resource', 'topic', 'user_id', 'application_id'],
      properties: {
        _id: { type: 'string', maxLength: 120 },
        resource: { type: 'string', example: '/orders/123456789' },
        topic: { type: 'string', example: 'orders_v2' },
        user_id: { oneOf: [{ type: 'string' }, { type: 'integer' }] },
        application_id: { oneOf: [{ type: 'string' }, { type: 'integer' }] },
        attempts: { type: 'integer' },
        sent: { type: 'string', format: 'date-time' },
        received: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description:
      'Notificação registrada ou entrega duplicada; processamento assíncrono.',
  })
  @ApiResponse({ status: 400, description: 'Payload ou aplicação inválida.' })
  @ApiResponse({
    status: 413,
    description: 'Corpo excede o limite configurado.',
  })
  @ApiResponse({ status: 429, description: 'Limite de requisições excedido.' })
  @ApiResponse({
    status: 503,
    description: 'Recepção temporariamente indisponível.',
  })
  receive(
    @Body() dto: unknown,
    @Req() request: Request & { rawBody?: Buffer },
  ) {
    return this.service.receive(dto, request.headers, request.rawBody);
  }
  @Post(['shopee', 'amazon', 'magalu'])
  unsupported() {
    throw new HttpException('Marketplace não suportado.', 501);
  }
}
