import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { Response } from 'express';
@Catch(QueryFailedError)
export class FiscalExceptionFilter implements ExceptionFilter {
  private logger = new Logger('FiscalDatabase');
  catch(error: QueryFailedError, host: ArgumentsHost) {
    const code = (error.driverError as { code?: string }).code;
    this.logger.error(JSON.stringify({ event: 'fiscal_database_error', code }));
    host.switchToHttp().getResponse<Response>().status(500).json({
      statusCode: 500,
      message:
        'Não foi possível consultar o módulo fiscal. Verifique se as migrations estão aplicadas no ambiente.',
    });
  }
}
