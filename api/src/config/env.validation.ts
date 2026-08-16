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
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().required(),
});
