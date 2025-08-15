import { z } from 'zod';

const EnvSchema = z.object({
  // Server
  PORT: z.string().default('3001').transform(Number),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // HyperEVM
  RPC_URL: z.string().url(),
  
  // Rate Limiting
  RATE_LIMIT_MAX: z.string().default('1000').transform(Number),
  RATE_LIMIT_WINDOW: z.string().default('60000').transform(Number),
  
  // Caching
  REDIS_URL: z.string().url().optional(),
  CACHE_TTL: z.string().default('300').transform(Number),
  
  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_LEVEL_STDOUT: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional(),
  LOG_LEVEL_FILE: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional(),
  LOG_FORMAT_STDOUT: z.enum(['logfmt', 'json', 'pretty']).default('logfmt'),
  LOG_FORMAT_FILE: z.enum(['logfmt', 'json']).default('json'),
  LOG_DIR: z.string().default('~/.local/share/altitrace'),
  LOG_FILENAME: z.string().default('altitrace.log'),
  LOG_ENABLE_FILE: z.string().default('true').transform(val => val === 'true'),
  LOG_PRETTY: z.string().default('true').transform(val => val === 'true'), // Legacy support
  
  // API Security
  API_KEY_HEADER: z.string().default('x-api-key'),
  REQUIRE_API_KEY: z.string().default('false').transform(val => val === 'true'),
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
      error.issues.forEach((err: z.ZodIssue) => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
    }
    process.exit(1);
  }
}

export const env = validateEnv();
export type Env = z.infer<typeof EnvSchema>;