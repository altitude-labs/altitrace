import { FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import type { ApiResponse } from '@/types/api';

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        break;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  throw lastError!;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(
    message: string,
    code: string = 'INTERNAL_ERROR',
    statusCode: number = 500,
    details?: any
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class SimulationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'SIMULATION_ERROR', 422, details);
  }
}

export class RpcError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'RPC_ERROR', 502, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
  }
}

export function handleValidationError(error: ZodError): ValidationError {
  const details = error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));

  return new ValidationError('Request validation failed', details);
}

export function formatErrorResponse(
  error: Error,
  requestId: string
): ApiResponse<never> {
  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      timestamp: new Date().toISOString(),
      requestId,
    };
  }

  if (error instanceof ZodError) {
    const validationError = handleValidationError(error);
    return formatErrorResponse(validationError, requestId);
  }

  // Unknown error - don't expose internal details in production
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An internal error occurred' 
        : error.message,
    },
    timestamp: new Date().toISOString(),
    requestId,
  };
}

export function sendErrorResponse(
  reply: FastifyReply,
  error: Error,
  requestId: string
): void {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const response = formatErrorResponse(error, requestId);

  reply.code(statusCode).send(response);
}