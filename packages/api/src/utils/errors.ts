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
    super(message, 'RPC_ERROR', 200, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
  }
}

/**
 * HyperEVM-specific insufficient funds error
 * Extends viem's pattern with additional balance information
 */
export class InsufficientFundsError extends AppError {
  public readonly have: string;
  public readonly want: string;
  public readonly account?: string;

  constructor(message: string, have: string, want: string, details?: any) {
    super(message, 'INSUFFICIENT_FUNDS', 422, {
      ...details,
      currentBalance: have,
      requiredAmount: want,
      shortfall: (BigInt(want) - BigInt(have)).toString(),
    });
    this.have = have;
    this.want = want;
    this.account = details?.account;
  }
}

/**
 * HyperEVM-specific contract execution error
 * Based on viem's ContractFunctionExecutionError
 */
export class ContractExecutionError extends AppError {
  public readonly contractAddress?: string;
  public readonly functionName?: string;
  public readonly revertReason?: string;
  public readonly gasUsed?: bigint;

  constructor(
    message: string,
    details: {
      contractAddress?: string;
      functionName?: string;
      revertReason?: string;
      gasUsed?: bigint;
      callIndex?: number;
    } = {}
  ) {
    super(message, 'CONTRACT_EXECUTION_ERROR', 422, details);
    this.contractAddress = details.contractAddress;
    this.functionName = details.functionName;
    this.revertReason = details.revertReason;
    this.gasUsed = details.gasUsed;
  }
}

/**
 * HyperEVM-specific gas estimation error
 * Provides detailed gas-related failure information
 */
export class GasEstimationError extends AppError {
  public readonly estimatedGas?: bigint;
  public readonly gasLimit?: bigint;

  constructor(
    message: string,
    details: {
      estimatedGas?: bigint;
      gasLimit?: bigint;
      account?: string;
      originalError?: Error;
    } = {}
  ) {
    super(message, 'GAS_ESTIMATION_ERROR', 422, details);
    this.estimatedGas = details.estimatedGas;
    this.gasLimit = details.gasLimit;
  }
}
/**
 * Parse Viem error and return appropriate HyperEVM-specific AppError
 * Enhanced to handle HyperEVM-specific simulation scenarios
 */
export function parseViemError(error: any): AppError {
  // Check if it's an InsufficientFundsError
  if (error.name === 'CallExecutionError' || error.name === 'InsufficientFundsError') {
    const details = error.details || '';
    
    // Parse "have X want Y" pattern
    const match = details.match(/have (\d+) want (\d+)/);
    if (match) {
      const [, have, want] = match;
      return new InsufficientFundsError(
        'Insufficient funds for transaction',
        have,
        want,
        {
          rawError: error.shortMessage || error.message,
          account: extractAccountFromError(error),
          currentBalanceEth: formatWei(have),
          requiredAmountEth: formatWei(want),
          shortfallEth: formatWei(BigInt(want) - BigInt(have)),
        }
      );
    }
  }

  // Check for contract function revert errors
  if (error.name === 'ContractFunctionRevertedError') {
    const revertReason = extractRevertReason(error);
    return new SimulationError(`Contract execution reverted: ${revertReason}`, {
      revertReason,
      contractAddress: error.contractAddress,
      functionName: error.functionName !== '<unknown>' ? error.functionName : undefined,
      rawData: error.data,
    });
  }

  // Check for contract function execution errors
  if (error.name === 'ContractFunctionExecutionError') {
    const revertReason = extractRevertReason(error.cause || error);
    return new ContractExecutionError(`Contract execution failed: ${revertReason}`, {
      revertReason,
      contractAddress: error.contractAddress,
      functionName: error.functionName !== '<unknown>' ? error.functionName : undefined,
    });
  }

  // Check for gas-related errors
  if (error.name === 'EstimateGasExecutionError' || error.message?.includes('gas')) {
    return new GasEstimationError('Gas estimation failed', {
      originalError: error,
      account: extractAccountFromError(error),
    });
  }

  // Check for other execution errors
  if (error.name === 'CallExecutionError') {
    return new SimulationError('Transaction simulation failed', {
      reason: error.shortMessage || error.message,
      details: error.details,
    });
  }

  // Handle HyperEVM-specific errors
  if (error.message?.includes('HyperEVM') || error.name?.includes('Hyper')) {
    return new RpcError('HyperEVM RPC error', {
      originalError: error.message,
      errorName: error.name,
      hyperevmSpecific: true,
    });
  }

  // Generic RPC error
  return new RpcError('RPC call failed', {
    originalError: error.message,
    errorName: error.name,
  });
}

/**
 * Extract account address from error message
 */
function extractAccountFromError(error: any): string | undefined {
  const errorStr = error.message || error.details || '';
  const accountMatch = errorStr.match(/from:\s+(0x[a-fA-F0-9]{40})/);
  return accountMatch ? accountMatch[1] : undefined;
}

/**
 * Extract revert reason from error
 */
function extractRevertReason(error: any): string {
  // First try the reason field (most direct)
  if (error.reason) {
    // Extract just the revert reason (remove "execution reverted: " prefix)
    const reasonMatch = error.reason.match(/(?:execution reverted: )?(.+)/);
    return reasonMatch ? reasonMatch[1] : error.reason;
  }

  // Try shortMessage
  if (error.shortMessage) {
    const shortMatch = error.shortMessage.match(/execution reverted: (.+)/);
    if (shortMatch) {
      return shortMatch[1];
    }
  }

  // Try message field
  if (error.message) {
    const msgMatch = error.message.match(/execution reverted: (.+)/);
    if (msgMatch) {
      return msgMatch[1];
    }
  }

  // Fallback to a generic message
  return 'Unknown revert reason';
}

/**
 * Format Wei amount to ETH string with reasonable precision
 */
function formatWei(wei: string | bigint): string {
  const weiAmount = typeof wei === 'string' ? BigInt(wei) : wei;
  const eth = Number(weiAmount) / 1e18;
  
  if (eth >= 1) {
    return `${eth.toFixed(4)} ETH`;
  } else if (eth >= 0.001) {
    return `${eth.toFixed(6)} ETH`;
  } else {
    return `${weiAmount.toString()} wei`;
  }
}

export function handleValidationError(error: ZodError<unknown>): ValidationError {
  const details = error.issues.map((err) => ({
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