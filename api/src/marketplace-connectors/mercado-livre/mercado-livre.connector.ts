import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SalesChannelCode } from '../../sales-channels/enums/sales-channel.enums';
import { unimplementedCapabilities } from '../core/capability.factory';
import { UnimplementedMarketplaceConnector } from '../core/unimplemented-marketplace.connector';
@Injectable()
export class MercadoLivreConnector extends UnimplementedMarketplaceConnector {
  readonly channelCode = SalesChannelCode.MERCADO_LIVRE;
  readonly enabled: boolean;
  constructor(config: ConfigService) {
    super();
    this.enabled =
      config.get<boolean>('MERCADO_LIVRE_CONNECTOR_ENABLED') ?? false;
  }
  getCapabilities() {
    return unimplementedCapabilities({
      webhooks: true,
      disconnectRevocation: true,
    });
  }
}
