import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SalesChannelCode } from '../../sales-channels/enums/sales-channel.enums';
import { unimplementedCapabilities } from '../core/capability.factory';
import { UnimplementedMarketplaceConnector } from '../core/unimplemented-marketplace.connector';
@Injectable()
export class MagaluConnector extends UnimplementedMarketplaceConnector {
  readonly channelCode = SalesChannelCode.MAGALU;
  readonly enabled: boolean;
  constructor(config: ConfigService) {
    super();
    this.enabled = config.get<boolean>('MAGALU_CONNECTOR_ENABLED') ?? false;
  }
  getCapabilities() {
    return unimplementedCapabilities();
  }
}
