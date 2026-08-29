import { ConfigService } from '@nestjs/config';
import { SalesChannelCode } from '../../sales-channels/enums/sales-channel.enums';
import { AmazonConnector } from '../amazon/amazon.connector';
import { MagaluConnector } from '../magalu/magalu.connector';
import { MercadoLivreConnector } from '../mercado-livre/mercado-livre.connector';
import { MercadoLivreApiClient } from '../mercado-livre/mercado-livre-api.client';
import { ShopeeConnector } from '../shopee/shopee.connector';
import { MarketplaceConnectorRegistry } from './marketplace-connector.registry';
import {
  MarketplaceConnectorError,
  MarketplaceErrorCode,
} from './marketplace-errors';
describe('MarketplaceConnectorRegistry', () => {
  const expectCode = (action: () => unknown, code: MarketplaceErrorCode) => {
    try {
      action();
      throw new Error('Era esperado um erro');
    } catch (error) {
      expect(error).toBeInstanceOf(MarketplaceConnectorError);
      if (error instanceof MarketplaceConnectorError)
        expect(error.code).toBe(code);
    }
  };
  const build = (enabled: boolean) => {
    const config = new ConfigService({
      MERCADO_LIVRE_CONNECTOR_ENABLED: enabled,
      SHOPEE_CONNECTOR_ENABLED: enabled,
      AMAZON_CONNECTOR_ENABLED: enabled,
      MAGALU_CONNECTOR_ENABLED: enabled,
    });
    const ml = new MercadoLivreConnector(config, {} as MercadoLivreApiClient);
    return {
      registry: new MarketplaceConnectorRegistry(
        ml,
        new ShopeeConnector(config),
        new AmazonConnector(config),
        new MagaluConnector(config),
      ),
      ml,
    };
  };
  it('resolve por código', () =>
    expect(
      build(true).registry.get(SalesChannelCode.MERCADO_LIVRE).channelCode,
    ).toBe(SalesChannelCode.MERCADO_LIVRE));
  it('rejeita duplicidade', () => {
    const { registry, ml } = build(true);
    expectCode(() => registry.register(ml), 'CONFLICT');
  });
  it('rejeita canal sem conector', () =>
    expectCode(
      () => build(true).registry.get(SalesChannelCode.MANUAL),
      'CONNECTOR_NOT_FOUND',
    ));
  it('rejeita conector desabilitado', () =>
    expectCode(
      () => build(false).registry.get(SalesChannelCode.AMAZON),
      'CONNECTOR_DISABLED',
    ));
});
