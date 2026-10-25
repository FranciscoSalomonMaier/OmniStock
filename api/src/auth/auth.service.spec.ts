import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'bcrypt';
import { createHash } from 'crypto';
import { UserRole } from '../common/enums/user-role.enum';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { MailService } from '../mail/mail.service';

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<
    Pick<
      UsersService,
      | 'create'
      | 'findByEmailWithSecrets'
      | 'findByIdWithRefreshToken'
      | 'setRefreshTokenHash'
      | 'startRefreshSession'
      | 'rotateRefreshToken'
      | 'toPublic'
      | 'saveVerificationToken'
      | 'findByVerificationHash'
      | 'confirmEmail'
      | 'normalizeEmail'
      | 'findByEmail'
    >
  >;
  let jwt: jest.Mocked<Pick<JwtService, 'signAsync' | 'verifyAsync'>>;
  const baseUser = {
    id: '72bdd298-e880-43aa-a504-f640513ac6bd',
    name: 'Francisco',
    email: 'francisco@example.com',
    role: UserRole.VIEWER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    passwordHash: '',
    refreshTokenHash: null,
    emailVerifiedAt: new Date(),
    emailVerificationTokenHash: null,
    emailVerificationExpiresAt: null,
    emailVerificationSentAt: null,
  } as User;

  beforeEach(() => {
    users = {
      create: jest.fn(),
      findByEmailWithSecrets: jest.fn(),
      findByIdWithRefreshToken: jest.fn(),
      setRefreshTokenHash: jest.fn(),
      startRefreshSession: jest.fn().mockResolvedValue(true),
      rotateRefreshToken: jest.fn().mockResolvedValue(true),
      saveVerificationToken: jest.fn(),
      findByVerificationHash: jest.fn(),
      confirmEmail: jest.fn(),
      normalizeEmail: jest.fn((email: string) => email.trim().toLowerCase()),
      findByEmail: jest.fn(),
      toPublic: jest.fn((user: User) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      })),
    };
    jwt = {
      signAsync: jest
        .fn()
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token'),
      verifyAsync: jest.fn(),
    };
    const config = {
      getOrThrow: jest.fn(
        (key: string) =>
          ({
            JWT_ACCESS_SECRET: 'a'.repeat(32),
            JWT_ACCESS_EXPIRES_IN: '15m',
            JWT_REFRESH_SECRET: 'b'.repeat(32),
            JWT_REFRESH_EXPIRES_IN: '7d',
            EMAIL_VERIFICATION_EXPIRES_IN_MINUTES: 30,
          })[key],
      ),
    } as unknown as ConfigService;
    const mail = { sendEmailVerification: jest.fn() } as unknown as MailService;
    service = new AuthService(
      users as unknown as UsersService,
      jwt as unknown as JwtService,
      config,
      mail,
    );
  });

  it('cadastra como VIEWER sem autenticar e armazena apenas o hash do token', async () => {
    users.create.mockResolvedValue({ ...baseUser, emailVerifiedAt: null });
    const result = await service.register({
      name: 'Francisco',
      email: 'FRANCISCO@example.com ',
      password: 'SenhaSegura123',
    });
    expect(users.create).toHaveBeenCalledWith(
      'Francisco',
      'FRANCISCO@example.com ',
      expect.any(String),
      UserRole.VIEWER,
    );
    expect(result).toMatchObject({
      requiresEmailVerification: true,
      email: baseUser.email,
    });
    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('refreshToken');
    expect(users.saveVerificationToken).toHaveBeenCalledWith(
      baseUser.id,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(Date),
      expect.any(Date),
    );
  });

  it('realiza login com credenciais válidas', async () => {
    users.findByEmailWithSecrets.mockResolvedValue({
      ...baseUser,
      passwordHash: await hash('SenhaSegura123', 4),
    });
    await expect(
      service.login({ email: baseUser.email, password: 'SenhaSegura123' }),
    ).resolves.toMatchObject({ accessToken: 'access-token' });
  });

  it('não distingue e-mail e senha inválidos', async () => {
    users.findByEmailWithSecrets.mockResolvedValue(null);
    await expect(
      service.login({ email: baseUser.email, password: 'SenhaIncorreta' }),
    ).rejects.toThrow(new UnauthorizedException('Credenciais inválidas'));
  });

  it('recusa usuário inativo', async () => {
    users.findByEmailWithSecrets.mockResolvedValue({
      ...baseUser,
      isActive: false,
      passwordHash: await hash('SenhaSegura123', 4),
    });
    await expect(
      service.login({ email: baseUser.email, password: 'SenhaSegura123' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('recusa refresh inválido', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('invalid'));
    await expect(service.refresh('invalid')).rejects.toThrow('Sessão expirada');
  });

  it('rotaciona refresh token válido', async () => {
    const oldToken = 'old-refresh';
    jwt.verifyAsync.mockResolvedValue({ sub: baseUser.id, type: 'refresh' });
    users.findByIdWithRefreshToken.mockResolvedValue({
      ...baseUser,
      refreshTokenHash: createHash('sha256').update(oldToken).digest('hex'),
    });
    const result = await service.refresh(oldToken);
    expect(result.refreshToken).toBe('refresh-token');
    expect(users.rotateRefreshToken).toHaveBeenCalledWith(
      baseUser.id,
      createHash('sha256').update(oldToken).digest('hex'),
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
  });

  it('invalida o refresh token no logout', async () => {
    const token = 'refresh';
    jwt.verifyAsync.mockResolvedValue({ sub: baseUser.id, type: 'refresh' });
    users.findByIdWithRefreshToken.mockResolvedValue({
      ...baseUser,
      refreshTokenHash: await hash(token, 4),
    });
    await service.logout(token);
    expect(users.rotateRefreshToken).toHaveBeenCalledWith(
      baseUser.id,
      createHash('sha256').update(token).digest('hex'),
      null,
    );
  });

  it('mantém logout sem cookie idempotente', async () => {
    await expect(service.logout(undefined)).resolves.toBeUndefined();
    expect(users.setRefreshTokenHash).not.toHaveBeenCalled();
  });
  it('rejects legacy bcrypt hashes even if the prefix matches', async () => {
    const a = 'x'.repeat(80) + 'a',
      b = 'x'.repeat(80) + 'b';
    jwt.verifyAsync.mockResolvedValue({ sub: baseUser.id, type: 'refresh' });
    users.findByIdWithRefreshToken.mockResolvedValue({
      ...baseUser,
      refreshTokenHash: await hash(b, 4),
    });
    await expect(service.refresh(a)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(users.rotateRefreshToken).not.toHaveBeenCalled();
  });
  it('rejects a lost compare-and-swap during refresh', async () => {
    const token = 'synthetic-refresh';
    jwt.verifyAsync.mockResolvedValue({ sub: baseUser.id, type: 'refresh' });
    users.findByIdWithRefreshToken.mockResolvedValue({
      ...baseUser,
      refreshTokenHash: createHash('sha256').update(token).digest('hex'),
    });
    users.rotateRefreshToken.mockResolvedValue(false);
    await expect(service.refresh(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
