import { HttpException, HttpStatus } from '@nestjs/common';
export type MarketplaceErrorCode =
  | 'CONNECTOR_NOT_FOUND'
  | 'CONNECTOR_DISABLED'
  | 'CONNECTOR_NOT_IMPLEMENTED'
  | 'OPERATION_NOT_SUPPORTED'
  | 'CONNECTION_NOT_READY'
  | 'CONNECTION_DISABLED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_REFRESH_FAILED'
  | 'REAUTH_REQUIRED'
  | 'INVALID_CREDENTIALS'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_TIMEOUT'
  | 'INVALID_PROVIDER_RESPONSE'
  | 'RESOURCE_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'UNKNOWN_PROVIDER_ERROR';
export class MarketplaceConnectorError extends HttpException {
  constructor(
    public readonly code: MarketplaceErrorCode,
    message: string,
    public readonly retryable = false,
    public readonly providerStatus: number | null = null,
    public readonly providerRequestId: string | null = null,
    public readonly retryAfterSeconds: number | null = null,
    cause?: unknown,
  ) {
    super(
      {
        code,
        message,
        retryable,
        providerStatus,
        providerRequestId,
        retryAfterSeconds,
      },
      code === 'CONNECTOR_NOT_FOUND'
        ? HttpStatus.NOT_FOUND
        : code === 'RATE_LIMITED'
          ? HttpStatus.TOO_MANY_REQUESTS
          : HttpStatus.BAD_REQUEST,
      { cause },
    );
    this.name = 'MarketplaceConnectorError';
  }
  toSafeResponse() {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      providerStatus: this.providerStatus,
      providerRequestId: this.providerRequestId,
      retryAfterSeconds: this.retryAfterSeconds,
    };
  }
}
export const connectorNotImplemented = () =>
  new MarketplaceConnectorError(
    'CONNECTOR_NOT_IMPLEMENTED',
    'A integração com este canal ainda não está disponível.',
  );
