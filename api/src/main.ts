import { configureHttpSecurity } from './config/http-security';
import 'dotenv/config';
import { WebhookPublicExceptionFilter } from './marketplace-connectors/webhooks/webhook-public-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    rawBody: true,
  });
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api');
  configureHttpSecurity(app, config);
  app.enableShutdownHooks();
  app.useGlobalFilters(new WebhookPublicExceptionFilter(app.getHttpAdapter()));
  const server = app.getHttpServer();
  server.requestTimeout = 30000;
  server.headersTimeout = 30000;
  app.use(
    '/api/webhooks',
    json({
      limit: config.get<string>('MARKETPLACE_WEBHOOK_MAX_BODY_SIZE', '256kb'),
      verify: (req, _res, buffer) => {
        (req as typeof req & { rawBody?: Buffer }).rawBody =
          Buffer.from(buffer);
      },
    }),
  );
  app.useBodyParser('json');
  app.useBodyParser('urlencoded', { extended: true });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (validationErrors: ValidationError[]) => {
        const errors: Record<string, string[]> = {};
        const collect = (items: ValidationError[], prefix = '') =>
          items.forEach((item) => {
            const key = prefix ? `${prefix}.${item.property}` : item.property;
            if (item.constraints) errors[key] = Object.values(item.constraints);
            if (item.children?.length) collect(item.children, key);
          });
        collect(validationErrors);
        return new BadRequestException({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Existem informações inválidas.',
          errors,
        });
      },
    }),
  );
  app.enableCors({
    origin: config.getOrThrow<string>('FRONTEND_URL'),
    credentials: true,
  });
  if (config.get<boolean>('SWAGGER_ENABLED')) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('OmniStock API')
      .setDescription('OmniStock API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }
  await app.listen(config.getOrThrow<number>('PORT'));
}
void bootstrap();
