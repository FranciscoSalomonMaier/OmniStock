import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { UserRole } from '../common/enums/user-role.enum';
import { MailService } from '../mail/mail.service';
import { PublicUser, UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

interface RefreshPayload {
  sub: string;
  type: 'refresh';
}
export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}
export interface RegistrationResult {
  message: string;
  requiresEmailVerification: true;
  email: string;
}
const RESEND_MESSAGE =
  'Se existir uma conta pendente para esse e-mail, enviaremos um novo link de confirmação.';

@Injectable()
export class AuthService {
  private readonly resendHistory = new Map<string, number[]>();
  private readonly resendLocks = new Map<string, Promise<void>>();

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto): Promise<RegistrationResult> {
    const user = await this.users.create(
      dto.name,
      dto.email,
      await hash(dto.password, 12),
      UserRole.VIEWER,
    );
    try {
      await this.createAndSendVerification(user);
    } catch {
      throw new ServiceUnavailableException(
        'Cadastro realizado, mas não foi possível enviar o e-mail. Solicite um novo link em instantes.',
      );
    }
    return {
      message:
        'Cadastro realizado. Enviamos um link de confirmação para o seu e-mail.',
      requiresEmailVerification: true,
      email: user.email,
    };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.users.findByEmailWithSecrets(dto.email);
    if (!user || !(await compare(dto.password, user.passwordHash)))
      throw new UnauthorizedException('Credenciais inválidas');
    if (!user.isActive) throw new ForbiddenException('Usuário inativo');
    if (!user.emailVerifiedAt)
      throw new ForbiddenException({
        statusCode: 403,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Confirme seu endereço de e-mail antes de entrar.',
      });
    return this.issueSession(user);
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const message =
      'Se existir uma conta para esse e-mail, enviaremos as instruções para redefinir a senha.';
    const user = await this.users.findByEmail(email);
    if (!user || !user.isActive) return { message };
    const token = randomBytes(32).toString('base64url');
    const expires = new Date(
      Date.now() +
        this.config.getOrThrow<number>('PASSWORD_RESET_EXPIRES_IN_MINUTES') *
          60000,
    );
    await this.users.savePasswordReset(user.id, this.hashToken(token), expires);
    await this.mail.sendPasswordReset(user.name, user.email, token);
    return { message };
  }

  async resetPassword(
    token: string,
    password: string,
  ): Promise<{ message: string }> {
    const user = await this.users.findByResetHash(this.hashToken(token));
    if (
      !user ||
      !user.passwordResetTokenHash ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() <= Date.now()
    )
      throw new UnauthorizedException(
        'O link de redefinição é inválido ou expirou.',
      );
    await this.users.changePassword(user.id, await hash(password, 12));
    return { message: 'Senha redefinida com sucesso. Você já pode entrar.' };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const tokenHash = this.hashToken(token);
    const user = await this.users.findByVerificationHash(tokenHash);
    const invalid =
      !user ||
      !user.emailVerificationTokenHash ||
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt.getTime() <= Date.now();
    if (invalid)
      throw new UnauthorizedException(
        'O link de confirmação é inválido ou expirou.',
      );
    const storedHash = user.emailVerificationTokenHash;
    if (
      !storedHash ||
      !timingSafeEqual(
        Buffer.from(tokenHash, 'hex'),
        Buffer.from(storedHash, 'hex'),
      )
    )
      throw new UnauthorizedException(
        'O link de confirmação é inválido ou expirou.',
      );
    await this.users.confirmEmail(user.id);
    return {
      message:
        'E-mail confirmado com sucesso. Você já pode entrar no OmniStock.',
    };
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const normalized = this.users.normalizeEmail(email);
    const existing = this.resendLocks.get(normalized);
    if (existing) {
      await existing;
      return { message: RESEND_MESSAGE };
    }
    const operation = this.performResend(normalized).finally(() =>
      this.resendLocks.delete(normalized),
    );
    this.resendLocks.set(normalized, operation);
    await operation;
    return { message: RESEND_MESSAGE };
  }

  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (!refreshToken) throw new UnauthorizedException('Sessão expirada');
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
      if (payload.type !== 'refresh') throw new Error('invalid token type');
      const user = await this.users.findByIdWithRefreshToken(payload.sub);
      if (
        !user ||
        !user.refreshTokenHash ||
        !(await compare(refreshToken, user.refreshTokenHash))
      )
        throw new Error('invalid session');
      if (!user.isActive) throw new ForbiddenException('Usuário inativo');
      return this.issueSession(user);
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new UnauthorizedException('Sessão expirada');
    }
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
      const user = await this.users.findByIdWithRefreshToken(payload.sub);
      if (
        user?.refreshTokenHash &&
        (await compare(refreshToken, user.refreshTokenHash))
      )
        await this.users.setRefreshTokenHash(user.id, null);
    } catch {
      return;
    }
  }

  private async performResend(email: string): Promise<void> {
    const now = Date.now();
    const recent = (this.resendHistory.get(email) ?? []).filter(
      (time) => time > now - 15 * 60_000,
    );
    if (recent.length >= 3) return;
    this.resendHistory.set(email, [...recent, now]);
    const user = await this.users.findByEmail(email);
    if (!user || !user.isActive || user.emailVerifiedAt) return;
    if (
      user.emailVerificationSentAt &&
      user.emailVerificationSentAt.getTime() > now - 60_000
    )
      return;
    try {
      await this.createAndSendVerification(user);
    } catch {
      return;
    }
  }

  private async createAndSendVerification(
    user: Parameters<UsersService['toPublic']>[0],
  ): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() +
        this.config.getOrThrow<number>(
          'EMAIL_VERIFICATION_EXPIRES_IN_MINUTES',
        ) *
          60_000,
    );
    await this.users.saveVerificationToken(
      user.id,
      this.hashToken(token),
      expiresAt,
      now,
    );
    await this.mail.sendEmailVerification(user.name, user.email, token);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueSession(
    user: Parameters<UsersService['toPublic']>[0],
  ): Promise<AuthResult> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
        expiresIn: this.config.getOrThrow('JWT_ACCESS_EXPIRES_IN'),
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, type: 'refresh' },
      {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
        expiresIn: this.config.getOrThrow('JWT_REFRESH_EXPIRES_IN'),
      },
    );
    await this.users.setRefreshTokenHash(user.id, await hash(refreshToken, 12));
    return { user: this.users.toPublic(user), accessToken, refreshToken };
  }
}
