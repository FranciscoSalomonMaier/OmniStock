import { Injectable } from '@nestjs/common';
import { SalesChannelCode } from '../../sales-channels/enums/sales-channel.enums';
import { AmazonConnector } from '../amazon/amazon.connector';
import { MagaluConnector } from '../magalu/magalu.connector';
import { MercadoLivreConnector } from '../mercado-livre/mercado-livre.connector';
import { ShopeeConnector } from '../shopee/shopee.connector';
import type { MarketplaceConnector } from './marketplace-connector.interface';
import { MarketplaceConnectorError } from './marketplace-errors';
@Injectable()
export class MarketplaceConnectorRegistry {
  private readonly connectors = new Map<
    SalesChannelCode,
    MarketplaceConnector
  >();
  constructor(
    mercadoLivre: MercadoLivreConnector,
    shopee: ShopeeConnector,
    amazon: AmazonConnector,
    magalu: MagaluConnector,
  ) {
    [mercadoLivre, shopee, amazon, magalu].forEach((x) => this.register(x));
  }
  register(connector: MarketplaceConnector) {
    if (this.connectors.has(connector.channelCode))
      throw new MarketplaceConnectorError(
        'CONFLICT',
        `Conector duplicado: ${connector.channelCode}`,
      );
    this.connectors.set(connector.channelCode, connector);
  }
  get(code: SalesChannelCode) {
    const connector = this.connectors.get(code);
    if (!connector)
      throw new MarketplaceConnectorError(
        'CONNECTOR_NOT_FOUND',
        'Não existe conector para este canal.',
      );
    if (!connector.enabled)
      throw new MarketplaceConnectorError(
        'CONNECTOR_DISABLED',
        'O conector deste canal não está configurado.',
      );
    return connector;
  }
  has(code: SalesChannelCode) {
    return this.connectors.has(code);
  }
  getDescriptor(code: SalesChannelCode) {
    const connector = this.connectors.get(code);
    if (!connector)
      throw new MarketplaceConnectorError(
        'CONNECTOR_NOT_FOUND',
        'Não existe conector para este canal.',
      );
    return {
      channelCode: connector.channelCode,
      enabled: connector.enabled,
      capabilities: connector.getCapabilities(),
    };
  }
  listAvailable() {
    return [...this.connectors.values()]
      .filter((x) => x.enabled)
      .map((x) => this.getDescriptor(x.channelCode));
  }
}
