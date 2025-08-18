/**
 * @fileoverview Altitrace SDK - TypeScript SDK for HyperEVM transaction simulation
 *
 * The Altitrace SDK provides a comprehensive, type-safe interface for interacting
 * with the Altitrace HyperEVM transaction simulation platform. It offers:
 *
 * - Fluent API for building simulation requests
 * - Full TypeScript support with strict type checking
 * - Robust error handling and retry logic
 * - Comprehensive response processing and utilities
 * - Integration helpers for popular Web3 libraries like Viem
 * - Extensive validation and debugging capabilities
 *
 * @example Basic Usage
 * ```typescript
 * import { AltitraceClient } from '@altitrace/sdk';
 *
 * const client = new AltitraceClient({
 *   baseUrl: 'https://api.altitrace.com/v1'
 * });
 *
 * const result = await client.simulate()
 *   .call({
 *     to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
 *     data: '0xa9059cbb...',
 *   })
 *   .atBlockTag('latest')
 *   .execute();
 *
 * console.log(`Gas used: ${result.getTotalGasUsed()}`);
 * console.log(`Success: ${result.isSuccess()}`);
 * ```
 *
 * @example Advanced Usage with State Overrides
 * ```typescript
 * import { AltitraceClient, createSimulationBuilder } from '@altitrace/sdk';
 *
 * const client = new AltitraceClient();
 *
 * const result = await client.simulate()
 *   .call({
 *     from: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
 *     to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
 *     data: '0xa9059cbb...',
 *   })
 *   .forAccount('0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c')
 *   .withAssetChanges(true)
 *   .withStateOverride({
 *     address: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
 *     balance: '0x1000000000000000000' // 1 ETH
 *   })
 *   .execute();
 * ```
 *
 * @author Altitrace Team
 * @version 1.0.0
 * @license MIT
 */

// Import types for use in utility functions
import { AltitraceClient } from './client/altitrace-client';
import type { AltitraceClientConfig } from './types/client';

// Main client export
export { AltitraceClient } from './client/altitrace-client';

// Builder functions
export { createSimulationBuilder } from './builders/simulation-builder';

// Type definitions
export type {
  // Client types
  AltitraceClientConfig,
  ApiResponse,
  ApiError,
  NetworkError,
  RetryConfig,
  Result,

  // Simulation types
  SimulationRequest,
  SimulationResult,
  SimulationParams,
  SimulationOptions,
  TransactionCall,
  CallResult,
  CallStatus,
  SimulationStatus,
  StateOverride,
  BlockOverrides,
  BlockTag,
  EnhancedLog,
  DecodedEvent,
  AssetChange,
  PerformanceMetrics,
  AccessListEntry,
  CallError,

  // Extended types
  ExtendedSimulationResult,
  AssetChangeSummary,
  BatchSimulationConfig,
  BatchSimulationResult,
  SimulationRequestBuilder,
  TransactionCallConfig,
  GasEstimate,

  // Utility types
  Address,
  HexString,
  HexNumber,
  Hash,
} from './types/simulation';

// Error classes
export {
  AltitraceError,
  ValidationError,
  AltitraceNetworkError,
  AltitraceApiError,
  SimulationError,
  ConfigurationError,
  ErrorUtils,
} from './core/errors';

// Response processor
export {
  ResponseProcessor,
  type GasUsageBreakdown,
  type EventSummary,
  type ErrorSummary,
  type SimulationComparison,
} from './processors/response-processor';

// Validation utilities
export { ValidationUtils, TypeGuards } from './utils/validation';

// Viem integration utilities
export {
  viemToTransactionCall,
  transactionCallToViem,
  viemBatchToTransactionCalls,
  viemAddressToAddress,
  addressToViemAddress,
  viemHexToHexString,
  hexStringToViemHex,
  bigintToHexNumber,
  hexNumberToBigint,
  numberToHexNumber,
  hexNumberToNumber,
  GasUtils,
  WeiUtils,
  BlockUtils,
} from './utils/viem-integration';

// Generated API types (for advanced usage)
export type { components, operations } from './generated/api-types';

/**
 * SDK version information.
 */
export const VERSION = '1.0.0';

/**
 * Default configuration values for quick reference.
 */
export const DEFAULT_CONFIG = {
  /** Default API base URL */
  BASE_URL: 'http://localhost:8080/v1',
  /** Default request timeout in milliseconds */
  TIMEOUT: 30_000,
  /** Default number of retry attempts */
  RETRIES: 3,
  /** Default user agent header */
  USER_AGENT: '@altitrace/sdk/1.0.0',
} as const;

/**
 * Common block tags for simulation contexts.
 */
export const BLOCK_TAGS = {
  LATEST: 'latest',
  EARLIEST: 'earliest',
  SAFE: 'safe',
  FINALIZED: 'finalized',
} as const;

/**
 * Common gas limits for different types of transactions.
 */
export const GAS_LIMITS = {
  /** Basic ETH transfer */
  TRANSFER: '0x5208', // 21,000
  /** ERC-20 token transfer */
  ERC20_TRANSFER: '0x1D4C0', // ~100,000
  /** Uniswap V2 swap */
  UNISWAP_V2_SWAP: '0x3D090', // ~250,000
  /** Uniswap V3 swap */
  UNISWAP_V3_SWAP: '0x493E0', // ~300,000
} as const;

/**
 * Common addresses used in HyperEVM ecosystem.
 */
export const COMMON_ADDRESSES = {
  /** Zero address */
  ZERO: '0x0000000000000000000000000000000000000000',
  /** WHYPE placeholder address for transfers */
  HYPE: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  /** WHYPE address */
  WHYPE: '0x5555555555555555555555555555555555555555',
} as const;

/**
 * Utility function to create a client with common configurations.
 */
export const createClient = {
  /**
   * Create a client for local development.
   */
  local: (config: Partial<AltitraceClientConfig> = {}) =>
    new AltitraceClient({
      baseUrl: 'http://localhost:8080/v1',
      debug: true,
      ...config,
    }),

  /**
   * Create a client for production use.
   */
  production: (config: Partial<AltitraceClientConfig> = {}) =>
    new AltitraceClient({
      baseUrl: 'https://altitrace.reachaltitude.xyz/v1',
      debug: false,
      retryConfig: {
        maxAttempts: 5,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        retryableStatusCodes: new Set([408, 429, 500, 502, 503, 504]),
        shouldRetry: () => true,
      },
      timeout: 60_000,
      ...config,
    }),

  /**
   * Create a client for testing.
   */
  testing: (config: Partial<AltitraceClientConfig> = {}) =>
    new AltitraceClient({
      baseUrl: 'http://localhost:8080/v1',
      debug: true,
      retryConfig: {
        maxAttempts: 1,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        retryableStatusCodes: new Set([408, 429, 500, 502, 503, 504]),
        shouldRetry: () => true,
      },
      timeout: 10_000,
      ...config,
    }),
};

/**
 * Re-export the main client as default for convenience.
 */
export default AltitraceClient;
