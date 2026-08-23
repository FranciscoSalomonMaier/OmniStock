import { Injectable } from '@nestjs/common';
import {
  SalesChannelCredentialsService,
  SalesChannelTokens,
} from '../../sales-channels/sales-channel-credentials.service';
import { MarketplaceConnectorError } from './marketplace-errors';
@Injectable()
export class MarketplaceCredentialProvider {
  private readonly locks = new Map<string, Promise<unknown>>();
  constructor(private readonly credentials: SalesChannelCredentialsService) {}
  async get(companyId: string, connectionId: string) {
    try {
      return await this.credentials.get(companyId, connectionId);
    } catch {
      throw new MarketplaceConnectorError(
        'INVALID_CREDENTIALS',
        'As credenciais desta conexão não estão disponíveis.',
      );
    }
  }
  save(companyId: string, connectionId: string, tokens: SalesChannelTokens) {
    return this.credentials.save(companyId, connectionId, tokens);
  }
  async withRefreshLock<T>(
    connectionId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    while (this.locks.has(connectionId)) await this.locks.get(connectionId);
    const promise = work();
    this.locks.set(connectionId, promise);
    try {
      return await promise;
    } finally {
      if (this.locks.get(connectionId) === promise)
        this.locks.delete(connectionId);
    }
  }
}
