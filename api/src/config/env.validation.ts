import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').required(),
  PORT: Joi.number().port().required(),
  FRONTEND_URL: Joi.string().uri().required(),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().required(),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().min(1).required(),
  DB_LOGGING: Joi.boolean().default(false),
  DATABASE_URL: Joi.string().allow('').optional(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .required()
    .invalid(Joi.ref('JWT_ACCESS_SECRET')),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  JWT_REFRESH_MAX_AGE_MS: Joi.number().integer().positive().default(604800000),
  ADMIN_INITIAL_PASSWORD: Joi.string().min(8).allow('').optional(),
  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().port().required(),
  SMTP_SECURE: Joi.boolean().required(),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASSWORD: Joi.string().allow('').optional(),
  SMTP_FROM_NAME: Joi.string().required(),
  SMTP_FROM_EMAIL: Joi.string()
    .email({ tlds: { allow: false } })
    .required(),
  EMAIL_VERIFICATION_EXPIRES_IN_MINUTES: Joi.number()
    .integer()
    .positive()
    .required(),
  PASSWORD_RESET_EXPIRES_IN_MINUTES: Joi.number()
    .integer()
    .positive()
    .default(30),
  PRODUCT_IMAGE_MAX_SIZE_MB: Joi.number().integer().positive().default(5),
  PRODUCT_IMAGE_MAX_COUNT: Joi.number().integer().positive().default(10),
  UPLOAD_DIR: Joi.string().default('uploads'),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().required(),
  MARKETPLACE_TOKEN_ENCRYPTION_KEY: Joi.string().base64().optional(),
  MARKETPLACE_TOKEN_ENCRYPTION_KEY_VERSION: Joi.string().default('v1'),
  MERCADO_LIVRE_CONNECTOR_ENABLED: Joi.boolean().default(false),
  MERCADO_LIVRE_CLIENT_ID: Joi.when('MERCADO_LIVRE_CONNECTOR_ENABLED', {
    is: true,
    then: Joi.string().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  MERCADO_LIVRE_CLIENT_SECRET: Joi.when('MERCADO_LIVRE_CONNECTOR_ENABLED', {
    is: true,
    then: Joi.string().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  MERCADO_LIVRE_REDIRECT_URI: Joi.when('MERCADO_LIVRE_CONNECTOR_ENABLED', {
    is: true,
    then: Joi.string().uri().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  MERCADO_LIVRE_AUTH_BASE_URL: Joi.string()
    .uri()
    .default('https://auth.mercadolivre.com.br/authorization'),
  MERCADO_LIVRE_API_BASE_URL: Joi.string()
    .uri()
    .default('https://api.mercadolibre.com'),
  MERCADO_LIVRE_HTTP_TIMEOUT_MS: Joi.number()
    .integer()
    .positive()
    .default(10000),
  SHOPEE_CONNECTOR_ENABLED: Joi.boolean().default(false),
  AMAZON_CONNECTOR_ENABLED: Joi.boolean().default(false),
  MAGALU_CONNECTOR_ENABLED: Joi.boolean().default(false),
});
