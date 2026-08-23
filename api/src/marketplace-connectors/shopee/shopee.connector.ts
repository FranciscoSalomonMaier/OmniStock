import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SalesChannelCode } from '../../sales-channels/enums/sales-channel.enums';
import { unimplementedCapabilities } from '../core/capability.factory';
import { UnimplementedMarketplaceConnector } from '../core/unimplemented-marketplace.connector';
@Injectable()
export class ShopeeConnector extends UnimplementedMarketplaceConnector {
  readonly channelCode = SalesChannelCode.SHOPEE;
  readonly enabled: boolean;
  constructor(config: ConfigService) {
    super();
    this.enabled = config.get<boolean>('SHOPEE_CONNECTOR_ENABLED') ?? false;
  }
  getCapabilities() {
    return unimplementedCapabilities({ webhooks: true });
  }
}
