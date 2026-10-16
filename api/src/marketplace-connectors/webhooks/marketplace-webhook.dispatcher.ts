import { Injectable } from '@nestjs/common';
import { MarketplaceWebhookEvent } from '../../orders/entities/marketplace-webhook-event.entity';
import { SalesChannelConnection } from '../../sales-channels/entities/sales-channel-connection.entity';
import { SalesChannelCode } from '../../sales-channels/enums/sales-channel.enums';
import { MercadoLivreWebhookDispatcher } from './mercado-livre-webhook.dispatcher';
import { MarketplaceConnectorError } from '../core/marketplace-errors';
@Injectable()
export class MarketplaceWebhookDispatcher {
  private handlers: Map<
    SalesChannelCode,
    {
      dispatch(
        event: MarketplaceWebhookEvent,
        connection: SalesChannelConnection,
        deadline: number,
      ): Promise<Record<string, unknown>>;
    }
  >;
  constructor(mercadoLivre: MercadoLivreWebhookDispatcher) {
    this.handlers = new Map([[SalesChannelCode.MERCADO_LIVRE, mercadoLivre]]);
  }
  dispatch(
    event: MarketplaceWebhookEvent,
    connection: SalesChannelConnection,
    deadline: number,
  ) {
    const handler = this.handlers.get(event.marketplace);
    if (!handler)
      throw new MarketplaceConnectorError(
        'CONNECTOR_NOT_IMPLEMENTED',
        'Marketplace não suporta notificações.',
      );
    return handler.dispatch(event, connection, deadline);
  }
}
