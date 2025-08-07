import { z } from 'zod';

const EnvSchema = z.object({
  // Server
  PORT: z.string().transform(Number).default('3001'),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // HyperEVM
  RPC_URL: z.string().url(),
  
  // Rate Limiting
  RATE_LIMIT_MAX: z.string().transform(Number).default('1000'),
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('60000'),
  
  // Caching
  REDIS_URL: z.string().url().optional(),
  CACHE_TTL: z.string().transform(Number).default('300'),
  
  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_PRETTY: z.string().transform(val => val === 'true').default('true'),
  
  // API Security
  API_KEY_HEADER: z.string().default('x-api-key'),
  REQUIRE_API_KEY: z.string().transform(val => val === 'true').default('false'),
});

function validateEnv() {
  try {
    // Load .env file if exists
    try {
      require('dotenv').config();
    } catch {
      // dotenv not available or .env file doesn't exist
    }

    const env = EnvSchema.parse(process.env);
    return env;
  } catch (error) {
    console.error('❌ Invalid environment configuration:');
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
    }
    process.exit(1);
  }
}

export const env = validateEnv();
export type Env = z.infer<typeof EnvSchema>;