import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import { configureHttpSecurity } from './http-security';
import { envValidationSchema } from './env.validation';
const base = {
  NODE_ENV: 'production',
  PORT: 3000,
  FRONTEND_URL: 'https://shop.example.test',
  DB_HOST: 'postgres',
  DB_PORT: 5432,
  DB_NAME: 'test',
  DB_USER: 'test',
  DB_PASSWORD: 'synthetic',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: 587,
  SMTP_SECURE: false,
  SMTP_FROM_NAME: 'Test',
  SMTP_FROM_EMAIL: 'test@example.test',
  EMAIL_VERIFICATION_EXPIRES_IN_MINUTES: 30,
  REDIS_HOST: 'redis',
  REDIS_PORT: 6379,
  MARKETPLACE_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
};
describe('production HTTP settings', () => {
  it('disables documentation and requires encrypted SMTP by default', () => {
    const r = envValidationSchema.validate(base);
    expect(r.error).toBeUndefined();
    const value = r.value as {
      SWAGGER_ENABLED: boolean;
      SMTP_REQUIRE_TLS: boolean;
    };
    expect(value.SWAGGER_ENABLED).toBe(false);
    expect(value.SMTP_REQUIRE_TLS).toBe(true);
  });
  it.each([
    { FRONTEND_URL: 'http://shop.example.test' },
    { SWAGGER_ENABLED: true },
    { SMTP_REQUIRE_TLS: false },
    { MARKETPLACE_TOKEN_ENCRYPTION_KEY: Buffer.alloc(16).toString('base64') },
    {
      MERCADO_LIVRE_CONNECTOR_ENABLED: true,
      MERCADO_LIVRE_CLIENT_ID: 'test',
      MERCADO_LIVRE_CLIENT_SECRET: 'synthetic',
      MERCADO_LIVRE_REDIRECT_URI: 'http://shop.example.test/callback',
    },
  ])('rejects unsafe production config', (patch) => {
    expect(
      envValidationSchema.validate({ ...base, ...patch }).error,
    ).toBeDefined();
  });
  it('rejects foreign cookie-auth origins but permits same-origin and CLI requests', () => {
    let middleware: (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => void = () => undefined;
    const app = {
      set: jest.fn(),
      disable: jest.fn(),
      use: jest.fn((fn: typeof middleware) => {
        middleware = fn;
      }),
    };
    configureHttpSecurity(
      app as unknown as NestExpressApplication,
      new ConfigService({ ...base, TRUST_PROXY_HOPS: 1 }),
    );
    for (const [origin, allowed] of [
      ['https://evil.example.test', false],
      ['https://shop.example.test', true],
      [undefined, true],
    ] as const) {
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();
      middleware(
        {
          method: 'POST',
          path: '/api/auth/refresh',
          headers: { origin },
        } as Request,
        res as unknown as Response,
        next,
      );
      expect(next).toHaveBeenCalledTimes(allowed ? 1 : 0);
      if (!allowed) expect(res.status).toHaveBeenCalledWith(403);
    }
    expect(app.set).toHaveBeenCalledWith('trust proxy', 1);
  });
});
