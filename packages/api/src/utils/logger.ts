import pino from 'pino';
import { env } from '@/config/env';

const loggerConfig = {
  level: env.LOG_LEVEL,
  formatters: {
    level: (label: string) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
} as const;

const transportConfig = env.NODE_ENV === 'development' && env.LOG_PRETTY ? {
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'yyyy-mm-dd HH:MM:ss:l',
    ignore: 'pid,hostname',
  },
} : undefined;

export const logger = transportConfig 
  ? pino({ ...loggerConfig, transport: transportConfig })
  : pino(loggerConfig);

export type Logger = typeof logger;