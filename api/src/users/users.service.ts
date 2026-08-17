import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum';
import { User } from './entities/user.entity';

export type PublicUser = Pick<
  User,
  'id' | 'name' | 'email' | 'role' | 'isActive' | 'createdAt'
>;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async create(
    name: string,
    email: string,
    passwordHash: string,
    role = UserRole.VIEWER,
  ): Promise<User> {
    try {
      return await this.users.save(
        this.users.create({
          name: name.trim(),
          email: this.normalizeEmail(email),
          passwordHash,
          role,
        }),
      );
    } catch (error: unknown) {
      if (this.isUniqueViolation(error))
        throw new ConflictException('E-mail já cadastrado');
      throw error;
    }
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  findByEmailWithSecrets(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect([
        'user.passwordHash',
        'user.refreshTokenHash',
        'user.emailVerificationTokenHash',
      ])
      .where('user.email = :email', { email: this.normalizeEmail(email) })
      .getOne();
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: this.normalizeEmail(email) } });
  }

  findByVerificationHash(tokenHash: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.emailVerificationTokenHash')
      .where('user.emailVerificationTokenHash = :tokenHash', { tokenHash })
      .getOne();
  }

  findByResetHash(tokenHash: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect(['user.passwordResetTokenHash', 'user.passwordHash'])
      .where('user.passwordResetTokenHash = :tokenHash', { tokenHash })
      .getOne();
  }
  async savePasswordReset(
    id: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.users.update(id, {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: expiresAt,
    });
  }
  async updateName(id: string, name: string): Promise<User> {
    await this.users.update(id, { name: name.trim() });
    return (await this.findById(id))!;
  }
  async changePassword(id: string, passwordHash: string): Promise<void> {
    await this.users.update(id, {
      passwordHash,
      passwordChangedAt: new Date(),
      refreshTokenHash: null,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    });
  }

  async saveVerificationToken(
    id: string,
    tokenHash: string,
    expiresAt: Date,
    sentAt: Date,
  ): Promise<void> {
    await this.users.update(id, {
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: expiresAt,
      emailVerificationSentAt: sentAt,
    });
  }

  async confirmEmail(id: string): Promise<void> {
    await this.users.update(id, {
      emailVerifiedAt: new Date(),
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
    });
  }

  findByIdWithRefreshToken(id: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.refreshTokenHash')
      .where('user.id = :id', { id })
      .getOne();
  }

  async setRefreshTokenHash(id: string, hash: string | null): Promise<void> {
    await this.users.update(id, { refreshTokenHash: hash });
  }

  toPublic(user: User): PublicUser {
    const { id, name, email, role, isActive, createdAt } = user;
    return { id, name, email, role, isActive, createdAt };
  }

  toProfile(user: User) {
    const { id, name, email, emailVerifiedAt, isActive, createdAt, updatedAt } =
      user;
    return { id, name, email, emailVerifiedAt, isActive, createdAt, updatedAt };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }
}
