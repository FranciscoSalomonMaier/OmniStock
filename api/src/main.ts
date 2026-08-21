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
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api');
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
  await app.listen(config.getOrThrow<number>('PORT'));
}
void bootstrap();
