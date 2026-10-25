import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';

export function configureHttpSecurity(
  app: NestExpressApplication,
  config: ConfigService,
) {
  // Only safe while API is reachable exclusively through the configured proxy chain.
  app.set('trust proxy', config.get<number>('TRUST_PROXY_HOPS') || false);
  app.disable('x-powered-by');
  const frontendOrigin = new URL(config.getOrThrow<string>('FRONTEND_URL'))
    .origin;
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.path.startsWith('/api/auth')) {
      res.setHeader('Cache-Control', 'no-store');
      if (
        !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
        ((req.headers.origin && req.headers.origin !== frontendOrigin) ||
          (!req.headers.origin &&
            req.headers['sec-fetch-site'] === 'cross-site'))
      ) {
        res
          .status(403)
          .json(new ForbiddenException('Origem não autorizada.').getResponse());
        return;
      }
    }
    next();
  });
}
