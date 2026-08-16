import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const createDatabaseConfig = (
  config: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: config.getOrThrow<string>('DB_HOST'),
  port: config.getOrThrow<number>('DB_PORT'),
  database: config.getOrThrow<string>('DB_NAME'),
  username: config.getOrThrow<string>('DB_USER'),
  password: config.getOrThrow<string>('DB_PASSWORD'),
  autoLoadEntities: true,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  migrationsRun: false,
  synchronize: false,
  logging: config.get<boolean>('DB_LOGGING', false),
});
