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
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().required(),
});
