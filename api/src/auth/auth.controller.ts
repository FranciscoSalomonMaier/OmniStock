import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthResult, AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

const REFRESH_COOKIE = 'omnistock_refresh_token';
type CookieRequest = { cookies?: Record<string, unknown> };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Cadastrar usuário' })
  @ApiCreatedResponse({ description: 'Usuário cadastrado' })
  @ApiConflictResponse({ description: 'E-mail já cadastrado' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.respondWithSession(await this.auth.register(dto), response);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Entrar' })
  @ApiOkResponse({ description: 'Login realizado' })
  @ApiUnauthorizedResponse({ description: 'Credenciais inválidas' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.respondWithSession(await this.auth.login(dto), response);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.respondWithSession(
      await this.auth.refresh(this.readRefreshCookie(request)),
      response,
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(this.readRefreshCookie(request));
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  me(@CurrentUser() user: User) {
    return this.users.toPublic(user);
  }

  private respondWithSession(result: AuthResult, response: Response) {
    response.cookie(REFRESH_COOKIE, result.refreshToken, this.cookieOptions());
    return { user: result.user, accessToken: result.accessToken };
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.config.get('NODE_ENV') === 'production',
      path: '/api/auth',
      maxAge: this.config.getOrThrow<number>('JWT_REFRESH_MAX_AGE_MS'),
    };
  }

  private readRefreshCookie(request: CookieRequest): string | undefined {
    const value = request.cookies?.[REFRESH_COOKIE];
    return typeof value === 'string' ? value : undefined;
  }
}
