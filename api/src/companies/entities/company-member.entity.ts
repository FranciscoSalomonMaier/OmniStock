import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CompanyRole } from '../../common/enums/company-role.enum';
import { User } from '../../users/entities/user.entity';
import { Company } from './company.entity';

@Entity('company_members')
@Index(['companyId', 'userId'], { unique: true })
@Index(['companyId'])
@Index(['userId'])
@Index(['companyId', 'role'])
export class CompanyMember {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId: string;
  @Column({ type: 'enum', enum: CompanyRole }) role: CompanyRole;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @Column({
    name: 'joined_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  joinedAt: Date;
  @ManyToOne(() => Company, (company) => company.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'company_id' })
  company: Company;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
