import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CompanyMember } from './company-member.entity';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'legal_name', length: 180 }) legalName: string;
  @Column({ name: 'trade_name', length: 180 }) tradeName: string;
  @Index({ unique: true }) @Column({ length: 14 }) document: string;
  @Column({ type: 'varchar', nullable: true, length: 255 }) email:
    string | null;
  @Column({ type: 'varchar', nullable: true, length: 30 }) phone: string | null;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @OneToMany(() => CompanyMember, (member) => member.company)
  members: CompanyMember[];
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
