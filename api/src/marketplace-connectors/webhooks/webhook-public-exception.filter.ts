import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request, Response } from 'express';
@Catch()
export class WebhookPublicExceptionFilter extends BaseExceptionFilter {
  private log = new Logger(WebhookPublicExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const request = host.switchToHttp().getRequest<Request>();
    if (!request.originalUrl.startsWith('/api/webhooks'))
      return super.catch(exception, host);
    const candidate =
      exception instanceof HttpException
        ? exception.getStatus()
        : exception &&
            typeof exception === 'object' &&
            'statusCode' in exception
          ? Number(exception.statusCode)
          : 500;
    const status = [400, 401, 403, 404, 405, 413, 429, 501, 503].includes(
      candidate,
    )
      ? candidate
      : 503;
    const messages: Record<number, string> = {
      400: 'Notificação inválida.',
      401: 'Notificação não autorizada.',
      403: 'Notificação não autorizada.',
      404: 'Endpoint não encontrado.',
      405: 'Método não permitido.',
      413: 'Notificação excede o tamanho permitido.',
      429: 'Limite de notificações excedido.',
      501: 'Marketplace não suportado.',
      503: 'Notificações temporariamente indisponíveis.',
    };
    this.log.warn({ event: 'webhook.rejected', status });
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message: messages[status] });
  }
}
