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
import { AltitraceClient } from './client/altitrace-client'
import type { AltitraceClientConfig } from './types/client'

// Builder functions
export { createSimulationBuilder } from './builders/simulation-builder'
export {
  BlockOverrideHelpers,
  createTraceBuilder,
  StateOverrideHelpers,
  TraceHelpers,
} from './builders/trace-builder'
// Main client export
export { AltitraceClient } from './client/altitrace-client'
export { SimulationClient } from './client/simulation-client'
export { TraceClient } from './client/trace-client'
// Error classes
export {
  AltitraceApiError,
  AltitraceError,
  AltitraceNetworkError,
  ConfigurationError,
  ErrorUtils,
  SimulationError,
  ValidationError,
} from './core/errors'
// Generated API types (for advanced usage)
export type { components, operations } from './generated/api-types'
// Response processor
export {
  type ErrorSummary,
  type EventSummary,
  type GasUsageBreakdown,
  ResponseProcessor,
  type SimulationComparison,
} from './processors/response-processor'
// Type definitions
export type {
  // Utility types
  Address,
  // Client types
  AltitraceClientConfig,
  ApiError,
  ApiResponse,
  AssetChange,
  AssetChangeSummary,
  BatchSimulationConfig,
  BatchSimulationResult,
  BlockOverrides,
  BlockTag,
  CallError,
  CallResult,
  CallStatus,
  DecodedEvent,
  EnhancedLog,
  // Extended types
  ExtendedSimulationResult,
  GasEstimate,
  Hash,
  HexNumber,
  HexString,
  NetworkError,
  Result,
  RetryConfig,
  SimulationExecutionOptions,
  SimulationOptions,
  SimulationParams,
  // Simulation types
  SimulationRequest,
  SimulationRequestBuilder,
  SimulationResult,
  SimulationStatus,
  StateOverride,
  TransactionCall,
  TransactionCallConfig,
} from './types'
export type { AccountState } from './types/state'
// Trace types
export type {
  CallFrame,
  CallTraceResponse,
  CallTracerConfig,
  // Extended types
  ExtendedTracerResponse,
  FourByteInfo,
  FourByteResponse,
  LogEntry,
  PrestateDefaultMode,
  PrestateDiffMode,
  PrestateTraceResponse,
  PrestateTracerConfig,
  StorageSlot,
  StructLog,
  StructLoggerConfig,
  StructLogResponse,
  TraceCallBuilder,
  TraceCallRequest,
  // Configuration types
  TraceConfig,
  TraceExecutionOptions,
  TraceRequestBuilder,
  // Response types
  TracerResponse,
  Tracers,
  TraceTransactionBuilder,
  // Request types
  TraceTransactionRequest,
  TransactionReceiptInfo,
} from './types/trace'
// Export trace type guards
export { TracerTypeGuards } from './types/trace'
// Validation utilities
export { TypeGuards, ValidationUtils } from './utils/validation'
// Viem integration utilities
export {
  addressToViemAddress,
  BlockUtils,
  bigintToHexNumber,
  blockNumberToHexNumber,
  blockNumberToNumber,
  GasUtils,
  hexNumberToBigint,
  hexNumberToNumber,
  hexStringToViemHex,
  isValidBlockNumber,
  numberToHexNumber,
  transactionCallToViem,
  viemAddressToAddress,
  viemBatchToTransactionCalls,
  viemHexToHexString,
  viemToTransactionCall,
  WeiUtils,
} from './utils/viem-integration'

/**
 * SDK version information.
 */
export const VERSION = '1.0.0'

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
} as const

/**
 * Common block tags for simulation contexts.
 */
export const BLOCK_TAGS = {
  LATEST: 'latest',
  EARLIEST: 'earliest',
  SAFE: 'safe',
  FINALIZED: 'finalized',
} as const

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
} as const

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
} as const

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
}

/**
 * Re-export the main client as default for convenience.
 */
export default AltitraceClient
