import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface HealthResponse {
  status: 'ok';
  database: 'connected';
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly dataSource: DataSource) {}

  async check(): Promise<HealthResponse> {
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'unavailable',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
