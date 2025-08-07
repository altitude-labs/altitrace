import { randomBytes } from 'node:crypto';
import type { ApiResponse } from '@/types/api';
import { isAddress } from 'viem';

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Create a successful API response
 */
export function createSuccessResponse<T>(
  data: T,
  requestId: string
): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    requestId,
  };
}

/**
 * Normalize hex values (ensure 0x prefix)
 */
export function normalizeHex(value: string): string {
  if (!value.startsWith('0x')) {
    return `0x${value}`;
  }
  return value;
}

/**
 * Convert number to hex string
 */
export function numberToHex(value: number | bigint): string {
  return `0x${value.toString(16)}`;
}

/**
 * Convert hex string to number
 */
export function hexToNumber(value: string): number {
  return parseInt(value, 16);
}

/**
 * Convert hex string to bigint
 */
export function hexToBigInt(value: string): bigint {
  return BigInt(value);
}

/**
 * Validate EVM address
 */
export function isValidAddress(address: string): boolean {
  return isAddress(address);
}

/**
 * Validate hex string
 */
export function isValidHex(hex: string): boolean {
  return /^0x[a-fA-F0-9]*$/.test(hex);
}

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

/**
 * Chunk array into smaller arrays
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Format gas value for display
 */
export function formatGas(gasValue: string | number | bigint): string {
  const gas = typeof gasValue === 'string' ? hexToBigInt(gasValue) : BigInt(gasValue);
  return gas.toLocaleString();
}

/**
 * Calculate percentage
 */
export function calculatePercentage(used: bigint, total: bigint): number {
  if (total === 0n) return 0;
  return Number((used * 100n) / total);
}