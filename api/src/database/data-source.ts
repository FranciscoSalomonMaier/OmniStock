import 'dotenv/config';
import { DataSource } from 'typeorm';

const requiredVariables = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
] as const;
for (const variable of requiredVariables) {
  if (!process.env[variable])
    throw new Error(`Missing required environment variable: ${variable}`);
}

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
});
