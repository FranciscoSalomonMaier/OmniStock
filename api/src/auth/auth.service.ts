import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { UserRole } from '../common/enums/user-role.enum';
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

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const user = await this.users.create(
      dto.name,
      dto.email,
      await hash(dto.password, 12),
      UserRole.VIEWER,
    );
    return this.issueSession(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.users.findByEmailWithSecrets(dto.email);
    if (!user || !(await compare(dto.password, user.passwordHash)))
      throw new UnauthorizedException('Credenciais inválidas');
    if (!user.isActive) throw new ForbiddenException('Usuário inativo');
    return this.issueSession(user);
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
