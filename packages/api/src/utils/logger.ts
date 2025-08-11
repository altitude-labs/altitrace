import pino from 'pino';
import { homedir } from 'os';
import { resolve, join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { env } from '@/config/env';

/**
 * Resolve log directory path (handle ~ expansion)
 */
function resolveLogDir(logDir: string): string {
  if (logDir.startsWith('~')) {
    return resolve(homedir(), logDir.slice(2));
  }
  return resolve(logDir);
}

/**
 * Ensure log directory exists
 */
function ensureLogDir(logDir: string): void {
  const resolvedDir = resolveLogDir(logDir);
  if (!existsSync(resolvedDir)) {
    mkdirSync(resolvedDir, { recursive: true });
  }
}

/**
 * Create logger transport configuration
 */
function createLoggerConfig() {
  const isDevelopment = env.NODE_ENV === 'development';
  
  // Log levels
  const baseLevel = env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');
  const stdoutLevel = env.LOG_LEVEL_STDOUT || baseLevel;
  const fileLevel = env.LOG_LEVEL_FILE || 'debug';
  
  // Log formats
  const stdoutFormat = env.LOG_FORMAT_STDOUT || (isDevelopment ? 'pretty' : 'logfmt');
  const fileFormat = env.LOG_FORMAT_FILE || 'json';
  
  // File logging enabled?
  const enableFileLogging = env.LOG_ENABLE_FILE || (!isDevelopment && env.NODE_ENV === 'production');
  
  const targets: any[] = [];
  
  // Stdout transport
  if (stdoutFormat === 'pretty' || (isDevelopment && env.LOG_PRETTY)) {
    targets.push({
      level: stdoutLevel,
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    });
  } else if (stdoutFormat === 'logfmt') {
    targets.push({
      level: stdoutLevel,
      target: 'pino-logfmt',
      options: {
        ignore: 'pid,hostname',
      },
    });
  } else {
    // JSON format
    targets.push({
      level: stdoutLevel,
      target: 'pino/file',
      options: {
        destination: 1, // stdout
        sync: false,
      },
    });
  }
  
  // File transport
  if (enableFileLogging && env.LOG_DIR && env.LOG_FILENAME) {
    ensureLogDir(env.LOG_DIR);
    const logFilePath = join(resolveLogDir(env.LOG_DIR), env.LOG_FILENAME);
    
    if (fileFormat === 'logfmt') {
      targets.push({
        level: fileLevel,
        target: 'pino-logfmt',
        options: {
          destination: logFilePath,
          ignore: 'pid,hostname',
          mkdir: true,
        },
      });
    } else {
      // JSON format
      targets.push({
        level: fileLevel,
        target: 'pino/file',
        options: {
          destination: logFilePath,
          sync: false,
          mkdir: true,
        },
      });
    }
  }

  return {
    level: 'trace', // Set to lowest level, let targets filter
    transport: targets.length > 1 ? { targets } : targets[0],
    formatters: {
      bindings: () => ({}), // Remove pid, hostname from logs
    },
  };
}

// Export the logger configuration for use with Fastify
export const loggerConfig = createLoggerConfig();

// Create the logger instance
export const logger = pino(loggerConfig);

/**
 * Create a child logger with context
 */
export function createLogger(context: Record<string, any>) {
  return logger.child(context);
}

export type Logger = typeof logger;