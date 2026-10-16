/* eslint-disable @typescript-eslint/require-await -- async adapter contract; this provider performs local validation only */
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MarketplaceWebhookAdapter,
  MarketplaceWebhookRequest,
  MarketplaceWebhookEventType as Type,
  NormalizedMarketplaceWebhook,
} from './webhook.contracts';
import { SalesChannelCode } from '../../sales-channels/enums/sales-channel.enums';
const allowed = new Set([
  '_id',
  'resource',
  'topic',
  'user_id',
  'application_id',
  'attempts',
  'sent',
  'received',
]);
function id(value: unknown): string {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value <= 0))
    throw new BadRequestException('Notificação inválida.');
  if (
    !['string', 'number'].includes(typeof value) ||
    !/^\d{1,30}$/.test(String(value))
  )
    throw new BadRequestException('Notificação inválida.');
  return String(value);
}
@Injectable()
export class MercadoLivreWebhookAdapter implements MarketplaceWebhookAdapter {
  constructor(private config: ConfigService) {}
  async validateRequest(request: MarketplaceWebhookRequest) {
    this.parse(request.payload);
    return {
      valid: true,
      mechanism: 'APPLICATION_AND_AUTHENTICATED_RESOURCE' as const,
    };
  }
  private parse(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new BadRequestException('Notificação inválida.');
    const p = value as Record<string, unknown>;
    if (
      Object.keys(p).some((k) => !allowed.has(k)) ||
      id(p.application_id) !==
        this.config.get<string>('MERCADO_LIVRE_CLIENT_ID')
    )
      throw new BadRequestException('Notificação inválida.');
    id(p.user_id);
    if (
      typeof p.topic !== 'string' ||
      !/^[a-zA-Z0-9_.-]{1,80}$/.test(p.topic) ||
      typeof p.resource !== 'string' ||
      !/^\/[a-zA-Z0-9_/-]{1,499}$/.test(p.resource)
    )
      throw new BadRequestException('Notificação inválida.');
    if (
      p._id !== undefined &&
      (typeof p._id !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(p._id))
    )
      throw new BadRequestException('Notificação inválida.');
    for (const k of ['sent', 'received'])
      if (
        p[k] !== undefined &&
        (typeof p[k] !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}T/.test(p[k]) ||
          !Number.isFinite(Date.parse(p[k])))
      )
        throw new BadRequestException('Notificação inválida.');
    if (
      p.attempts !== undefined &&
      (!Number.isSafeInteger(p.attempts) || Number(p.attempts) < 0)
    )
      throw new BadRequestException('Notificação inválida.');
    return p;
  }
  async normalize(
    request: MarketplaceWebhookRequest,
  ): Promise<NormalizedMarketplaceWebhook> {
    const p = this.parse(request.payload),
      topic = p.topic as string,
      resource = p.resource as string;
    let type = Type.UNKNOWN,
      order: string | null = null,
      product: string | null = null,
      shipment: string | null = null,
      resourceId: string | null = null;
    const routes: Record<string, { pattern: RegExp; type: Type }> = {
      orders_v2: { pattern: /^\/orders\/(\d+)$/, type: Type.ORDER_UPDATED },
      orders: { pattern: /^\/orders\/(\d+)$/, type: Type.ORDER_UPDATED },
      created_orders: {
        pattern: /^\/orders\/(\d+)$/,
        type: Type.ORDER_CREATED,
      },
      payments: {
        pattern: /^\/collections\/(\d+)$/,
        type: Type.PAYMENT_APPROVED,
      },
      shipments: {
        pattern: /^\/shipments\/(\d+)$/,
        type: Type.SHIPMENT_UPDATED,
      },
      'stock-location': {
        pattern: /^\/user-products\/(ML[A-Z]U\d+)\/stock$/,
        type: Type.STOCK_UPDATED,
      },
      items: { pattern: /^\/items\/(ML[A-Z]\d+)$/, type: Type.PRODUCT_UPDATED },
    };
    const route = routes[topic];
    if (route) {
      const match = route.pattern.exec(resource);
      if (!match) throw new BadRequestException('Notificação inválida.');
      resourceId = match[1];
      type = route.type;
      if (['orders', 'orders_v2', 'created_orders'].includes(topic))
        order = resourceId;
      if (topic === 'items') product = resourceId;
      if (topic === 'shipments') shipment = resourceId;
    }
    const payload: Record<string, unknown> = {
      resource,
      topic,
      user_id: id(p.user_id),
      application_id: id(p.application_id),
    };
    for (const k of ['_id', 'attempts', 'sent', 'received'])
      if (p[k] !== undefined) payload[k] = p[k];
    return {
      marketplace: SalesChannelCode.MERCADO_LIVRE,
      eventType: type,
      externalEventId: typeof p._id === 'string' ? p._id : null,
      externalAccountId: id(p.user_id),
      externalResourceId: resourceId,
      externalOrderId: order,
      externalProductId: product,
      externalShipmentId: shipment,
      resource,
      topic,
      occurredAt: p.received
        ? new Date(p.received as string)
        : p.sent
          ? new Date(p.sent as string)
          : null,
      receivedAt: new Date(),
      payload,
    };
  }
}
