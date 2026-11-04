import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'crypto';
import type { ExceptionFilter } from '@nestjs/common';
import { MarketplaceConnectorError } from './marketplace-errors';
import { publicConnectionError } from './connection-public-error';

@Catch()
export class ConnectionPublicExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger(ConnectionPublicExceptionFilter.name);
  catch(error: unknown, host: ArgumentsHost) {
    // Keep application authentication, authorization and input validation errors.
    if (
      error instanceof HttpException &&
      !(error instanceof MarketplaceConnectorError) &&
      error.getStatus() < 500
    ) {
      const body = error.getResponse();
      return host
        .switchToHttp()
        .getResponse<Response>()
        .status(error.getStatus())
        .json(
          typeof body === 'string'
            ? { statusCode: error.getStatus(), message: body }
            : body,
        );
    }
    const diagnosticId = randomUUID();
    const connector = error instanceof MarketplaceConnectorError ? error : null;
    this.log.warn({
      event: 'marketplace.connection.failed',
      diagnosticId,
      connectorCode: connector?.code ?? null,
      providerStatus: connector?.providerStatus ?? null,
    });
    const publicError = publicConnectionError(connector?.code ?? null);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(publicError.code === 'RECONNECT_REQUIRED' ? 409 : 503)
      .json({
        ...publicError,
        message: `${publicError.message} Código de atendimento: ${diagnosticId}.`,
        diagnosticId,
      });
  }
}
