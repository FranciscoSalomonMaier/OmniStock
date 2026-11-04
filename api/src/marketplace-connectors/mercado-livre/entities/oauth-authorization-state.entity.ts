import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { EncryptedValue } from '../../../sales-channels/token-encryption.service';
import { SalesChannelCode } from '../../../sales-channels/enums/sales-channel.enums';
@Entity('oauth_authorization_states')
export class OAuthAuthorizationState {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true })
  @Column({ name: 'state_hash', type: 'varchar', length: 64 })
  stateHash: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'connection_id', type: 'uuid' }) connectionId: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId: string;
  @Column({ name: 'channel_code', type: 'enum', enum: SalesChannelCode })
  channelCode: SalesChannelCode;
  @Column({ name: 'return_path', type: 'varchar', length: 240 })
  returnPath: string;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt: Date;
  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt: Date | null;
  @Column({ name: 'encrypted_code_verifier', type: 'jsonb', nullable: true })
  encryptedCodeVerifier: EncryptedValue | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
