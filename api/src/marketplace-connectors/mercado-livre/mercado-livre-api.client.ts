import {
  remainingProviderTime,
  providerDeadline,
} from '../core/provider-request-budget';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketplaceConnectorError } from '../core/marketplace-errors';
import type {
  MercadoLivreItem,
  MercadoLivreItemSearchResponse,
  MercadoLivreOrder,
  MercadoLivreOrderSearchResponse,
  MercadoLivreShipment,
  MercadoLivreTokenResponse,
  MercadoLivreUserResponse,
} from './mercado-livre.types';
@Injectable()
export class MercadoLivreApiClient {
  private readonly apiBase: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly timeout: number;
  constructor(config: ConfigService) {
    this.apiBase =
      config.get<string>('MERCADO_LIVRE_API_BASE_URL') ??
      'https://api.mercadolibre.com';
    this.clientId = config.get<string>('MERCADO_LIVRE_CLIENT_ID') ?? '';
    this.clientSecret = config.get<string>('MERCADO_LIVRE_CLIENT_SECRET') ?? '';
    this.redirectUri = config.get<string>('MERCADO_LIVRE_REDIRECT_URI') ?? '';
    this.timeout = config.get<number>('MERCADO_LIVRE_HTTP_TIMEOUT_MS') ?? 10000;
  }
  exchangeAuthorizationCode(code: string) {
    return this.token({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: this.redirectUri,
    });
  }
  refreshAccessToken(refreshToken: string) {
    return this.token({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
    });
  }
  getCurrentUser(token: string) {
    return this.request<MercadoLivreUserResponse>('/users/me', { token });
  }
  listSellerItems(
    token: string,
    sellerId: string,
    cursor: string | null,
    pageSize: number,
  ) {
    const query = cursor
      ? `search_type=scan&scroll_id=${encodeURIComponent(cursor)}`
      : `search_type=scan&limit=${Math.min(pageSize, 100)}`;
    return this.request<MercadoLivreItemSearchResponse>(
      `/users/${encodeURIComponent(sellerId)}/items/search?${query}`,
      { token },
    );
  }
  getItem(token: string, itemId: string) {
    return this.request<MercadoLivreItem>(
      `/items/${encodeURIComponent(itemId)}`,
      { token },
    );
  }
  searchOrders(
    token: string,
    sellerId: string,
    offset: number,
    pageSize: number,
    updatedSince: Date | null,
  ) {
    const q = new URLSearchParams({
      seller: sellerId,
      offset: String(offset),
      limit: String(Math.min(pageSize, 50)),
      sort: 'date_asc',
    });
    if (updatedSince)
      q.set('order.date_last_updated.from', updatedSince.toISOString());
    return this.request<MercadoLivreOrderSearchResponse>(
      `/orders/search?${q}`,
      { token },
    );
  }
  getOrder(token: string, id: string) {
    return this.request<MercadoLivreOrder>(
      `/orders/${encodeURIComponent(id)}`,
      { token },
    );
  }
  getUserProductStock(token: string, id: string) {
    return this.request<{
      id: string;
      user_id: number;
      locations: Array<{ type: string; quantity: number }>;
    }>(`/user-products/${encodeURIComponent(id)}/stock`, { token });
  }
  searchUserProductItems(
    token: string,
    seller: string,
    id: string,
    offset: number,
  ) {
    return this.request<{
      results: string[];
      paging: { total: number; limit: number; offset: number };
    }>(
      `/users/${encodeURIComponent(seller)}/items/search?user_product_id=${encodeURIComponent(id)}&limit=50&offset=${offset}`,
      { token },
    );
  }
  getShipmentItems(token: string, id: string) {
    return this.request<
      Array<{ order_id: number; sender_id?: number; seller_id?: number }>
    >(`/shipments/${encodeURIComponent(id)}/items`, {
      token,
      headers: { 'x-format-new': 'true' },
    });
  }
  getCollection(token: string, id: string) {
    return this.request<{
      id: number;
      collector_id?: number;
      order_id?: number;
      status: string;
    }>(`/collections/${encodeURIComponent(id)}`, { token });
  }
  getShipment(token: string, id: string) {
    return this.request<MercadoLivreShipment>(
      `/shipments/${encodeURIComponent(id)}`,
      { token, headers: { 'x-format-new': 'true' } },
    );
  }
  updateItem(
    token: string,
    id: string,
    body: Readonly<Record<string, unknown>>,
  ) {
    return this.request<MercadoLivreItem>(`/items/${encodeURIComponent(id)}`, {
      token,
      method: 'PUT',
      body,
    });
  }
  private async token(values: Record<string, string>) {
    const response = await this.raw(
      '/oauth/token',
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(values).toString(),
      },
      false,
    );
    return this.parse<MercadoLivreTokenResponse>(response);
  }
  private async request<T>(
    path: string,
    options: {
      token: string;
      method?: string;
      body?: Readonly<Record<string, unknown>>;
      headers?: Record<string, string>;
    },
  ): Promise<T> {
    const response = await this.raw(
      path,
      {
        method: options.method ?? 'GET',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${options.token}`,
          ...(options.body ? { 'content-type': 'application/json' } : {}),
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      },
      (options.method ?? 'GET') === 'GET',
    );
    return this.parse<T>(response);
  }
  private async raw(path: string, init: RequestInit, retryable: boolean) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const deadline = providerDeadline();
      if (deadline !== undefined && Date.now() >= deadline)
        throw new MarketplaceConnectorError(
          'PROVIDER_TIMEOUT',
          'Tempo de processamento excedido.',
          true,
        );
      const controller = new AbortController(),
        timer = setTimeout(
          () => controller.abort(),
          remainingProviderTime(this.timeout),
        );
      try {
        const response = await fetch(`${this.apiBase}${path}`, {
          ...init,
          signal: controller.signal,
        });
        if (response.ok || response.status === 206) return response;
        if (
          deadline !== undefined &&
          [429, 502, 503, 504].includes(response.status)
        )
          throw await this.detailedHttpError(response, init);
        if (
          retryable &&
          [429, 502, 503, 504].includes(response.status) &&
          attempt < 2
        ) {
          const retryAfter = Number(response.headers.get('retry-after') ?? 0);
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              retryAfter > 0
                ? retryAfter * 1000
                : 250 * 2 ** attempt + Math.random() * 100,
            ),
          );
          continue;
        }
        throw await this.detailedHttpError(response, init);
      } catch (error) {
        if (error instanceof MarketplaceConnectorError) throw error;
        if (retryable && attempt < 2) {
          await new Promise((resolve) =>
            setTimeout(resolve, 250 * 2 ** attempt + Math.random() * 100),
          );
          continue;
        }
        throw new MarketplaceConnectorError(
          'PROVIDER_TIMEOUT',
          'O Mercado Livre não respondeu no tempo esperado.',
          true,
          null,
          null,
          null,
          error,
        );
      } finally {
        clearTimeout(timer);
      }
    }
    throw new MarketplaceConnectorError(
      'PROVIDER_UNAVAILABLE',
      'O Mercado Livre está temporariamente indisponível.',
      true,
    );
  }
  private async detailedHttpError(response: Response, init: RequestInit) {
    const fallback = this.httpError(response);
    const secrets = [
      this.clientSecret,
      new Headers(init.headers)
        .get('authorization')
        ?.replace(/^Bearer\s+/i, ''),
      ...Array.from(
        new URLSearchParams(
          typeof init.body === 'string' ? init.body : '',
        ).entries(),
      )
        .filter(([key]) =>
          ['client_secret', 'refresh_token', 'code'].includes(key),
        )
        .map(([, value]) => value),
    ].filter((value): value is string => Boolean(value));
    const clean = (value: unknown) => {
      if (typeof value !== 'string' && typeof value !== 'number') return '';
      let text = String(value);
      for (const secret of secrets) text = text.split(secret).join('[oculto]');
      return text
        .replace(/APP_USR-[\w-]+/g, '[oculto]')
        .replace(/[\r\n\t]+/g, ' ')
        .slice(0, 300);
    };
    let details = '';
    try {
      const body: unknown = await response.json();
      if (body && typeof body === 'object') {
        const data = body as Record<string, unknown>;
        const causes = Array.isArray(data.cause)
          ? data.cause.slice(0, 3).flatMap((cause: unknown) => {
              if (!cause || typeof cause !== 'object') return [];
              const entry = cause as Record<string, unknown>;
              return [
                [clean(entry.code), clean(entry.message)]
                  .filter(Boolean)
                  .join(': '),
              ];
            })
          : [];
        details = [clean(data.error), clean(data.message), ...causes]
          .filter(Boolean)
          .join(' — ');
      }
    } catch {
      // HTML or an empty error body must preserve the HTTP classification.
    }
    return new MarketplaceConnectorError(
      fallback.code,
      `Mercado Livre (HTTP ${response.status}): ${details || fallback.message}`.slice(
        0,
        500,
      ),
      fallback.retryable,
      response.status,
      response.headers.get('x-request-id'),
      fallback.retryAfterSeconds,
    );
  }
  private httpError(response: Response) {
    const retryAfter = Number(response.headers.get('retry-after') ?? 0) || null;
    if (response.status === 429)
      return new MarketplaceConnectorError(
        'RATE_LIMITED',
        'Limite temporário de requisições do Mercado Livre atingido.',
        true,
        429,
        response.headers.get('x-request-id'),
        retryAfter,
      );
    if (response.status === 401)
      return new MarketplaceConnectorError(
        'REAUTH_REQUIRED',
        'A conta do Mercado Livre precisa ser reconectada.',
        false,
        401,
      );
    if (response.status === 404)
      return new MarketplaceConnectorError(
        'RESOURCE_NOT_FOUND',
        'O recurso solicitado não foi encontrado no Mercado Livre.',
        false,
        404,
      );
    return new MarketplaceConnectorError(
      response.status >= 500
        ? 'PROVIDER_UNAVAILABLE'
        : 'UNKNOWN_PROVIDER_ERROR',
      'O Mercado Livre recusou a operação.',
      response.status >= 500,
      response.status,
      response.headers.get('x-request-id'),
    );
  }
  private async parse<T>(response: Response): Promise<T> {
    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new MarketplaceConnectorError(
        'INVALID_PROVIDER_RESPONSE',
        'O Mercado Livre retornou uma resposta inválida.',
        false,
        response.status,
        response.headers.get('x-request-id'),
        null,
        error,
      );
    }
  }
}
