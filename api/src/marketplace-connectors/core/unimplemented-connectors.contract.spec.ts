import { ConfigService } from '@nestjs/config';
import { SalesChannelCode } from '../../sales-channels/enums/sales-channel.enums';
import { AmazonConnector } from '../amazon/amazon.connector';
import { MagaluConnector } from '../magalu/magalu.connector';
import { ShopeeConnector } from '../shopee/shopee.connector';
import type { ConnectorContext } from './marketplace-types';
describe('contrato dos conectores não implementados', () => {
  const config = new ConfigService({
    MERCADO_LIVRE_CONNECTOR_ENABLED: true,
    SHOPEE_CONNECTOR_ENABLED: true,
    AMAZON_CONNECTOR_ENABLED: true,
    MAGALU_CONNECTOR_ENABLED: true,
  });
  const connectors = [
    new ShopeeConnector(config),
    new AmazonConnector(config),
    new MagaluConnector(config),
  ];
  const context: ConnectorContext = {
    companyId: 'company',
    connectionId: 'connection',
    channelCode: SalesChannelCode.SHOPEE,
    externalAccountId: null,
    correlationId: 'correlation',
    operationId: 'operation',
    locale: 'pt-BR',
    metadata: {},
  };
  it.each(connectors)(
    '$channelCode declara capabilities sem sucesso falso',
    async (connector) => {
      expect(connector.channelCode).toBeTruthy();
      const capabilities = connector.getCapabilities();
      expect(
        Object.keys(capabilities).every(
          (key) => !capabilities[key as keyof typeof capabilities].implemented,
        ),
      ).toBe(true);
      await expect(
        connector.validateConnection({
          ...context,
          channelCode: connector.channelCode,
        }),
      ).rejects.toMatchObject({
        code: 'CONNECTOR_NOT_IMPLEMENTED',
        retryable: false,
      });
      await expect(
        connector.importProducts({
          context: { ...context, channelCode: connector.channelCode },
          cursor: null,
          updatedSince: null,
          pageSize: 50,
          filters: {},
        }),
      ).rejects.toMatchObject({ code: 'CONNECTOR_NOT_IMPLEMENTED' });
    },
  );
});
