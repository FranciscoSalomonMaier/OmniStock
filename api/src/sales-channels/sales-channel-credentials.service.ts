import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesChannelCredential } from './entities/sales-channel-credential.entity';
import { TokenEncryptionService } from './token-encryption.service';

export interface SalesChannelTokens {
  accessToken?: string;
  refreshToken?: string;
}

@Injectable()
export class SalesChannelCredentialsService {
  constructor(
    @InjectRepository(SalesChannelCredential)
    private readonly repository: Repository<SalesChannelCredential>,
    private readonly encryption: TokenEncryptionService,
  ) {}

  async save(companyId: string, connectionId: string, tokens: SalesChannelTokens) {
    let credential = await this.repository.findOneBy({ companyId, connectionId });
    credential ??= this.repository.create({
      companyId,
      connectionId,
      encryptedAccessToken: null,
      accessTokenIv: null,
      accessTokenAuthTag: null,
      encryptedRefreshToken: null,
      refreshTokenIv: null,
      refreshTokenAuthTag: null,
      encryptionKeyVersion: this.encryption.getKeyVersion(),
    });
    if (tokens.accessToken !== undefined) {
      const value = this.encryption.encrypt(tokens.accessToken);
      credential.encryptedAccessToken = value.ciphertext;
      credential.accessTokenIv = value.iv;
      credential.accessTokenAuthTag = value.authTag;
      credential.encryptionKeyVersion = value.keyVersion;
    }
    if (tokens.refreshToken !== undefined) {
      const value = this.encryption.encrypt(tokens.refreshToken);
      credential.encryptedRefreshToken = value.ciphertext;
      credential.refreshTokenIv = value.iv;
      credential.refreshTokenAuthTag = value.authTag;
      credential.encryptionKeyVersion = value.keyVersion;
    }
    return this.repository.save(credential);
  }

  async get(companyId: string, connectionId: string): Promise<SalesChannelTokens> {
    const value = await this.repository.findOneBy({ companyId, connectionId });
    if (!value) throw new NotFoundException('Credencial não encontrada');
    return {
      accessToken: value.encryptedAccessToken && value.accessTokenIv && value.accessTokenAuthTag
        ? this.encryption.decrypt({ ciphertext: value.encryptedAccessToken, iv: value.accessTokenIv, authTag: value.accessTokenAuthTag, keyVersion: value.encryptionKeyVersion }) : undefined,
      refreshToken: value.encryptedRefreshToken && value.refreshTokenIv && value.refreshTokenAuthTag
        ? this.encryption.decrypt({ ciphertext: value.encryptedRefreshToken, iv: value.refreshTokenIv, authTag: value.refreshTokenAuthTag, keyVersion: value.encryptionKeyVersion }) : undefined,
    };
  }

  delete(companyId: string, connectionId: string) {
    return this.repository.delete({ companyId, connectionId });
  }
}
