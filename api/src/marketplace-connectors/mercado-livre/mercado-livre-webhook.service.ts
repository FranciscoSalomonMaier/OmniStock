import { Injectable } from '@nestjs/common';
import { MarketplaceWebhookService } from '../webhooks/marketplace-webhook.service';
@Injectable()
export class MercadoLivreWebhookService {
  constructor(private webhooks: MarketplaceWebhookService) {}
  receive(
    payload: unknown,
    headers?: Record<string, string | string[] | undefined>,
    rawBody?: Buffer,
  ) {
    return this.webhooks.receive({
      payload,
      ...(headers ? { headers } : {}),
      ...(rawBody ? { rawBody } : {}),
    });
  }
}
