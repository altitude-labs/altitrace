/**
 * @fileoverview Simulation types and extended interfaces
 */

import type { components } from '@sdk/generated/api-types'
import type { AccessList } from './access-list'
import type { BlockOverrides, BlockTag } from './block'
import type { StateOverride } from './state'
import type {
  AssetChange,
  CallError,
  DecodedEvent,
  TransactionCall,
} from './transaction'

// Re-export generated types for convenience
export type SimulationRequest = components['schemas']['SimulationRequest']
export type SimulationResult = components['schemas']['SimulationResult']
export type SimulationParams = components['schemas']['SimulationParams']
export type SimulationOptions = components['schemas']['SimulationOptions']
export type SimulationStatus = components['schemas']['SimulationStatus']

// Re-export client types
export type {
  AltitraceClientConfig,
  ApiError,
  ApiResponse,
  NetworkError,
  Result,
  RetryConfig,
} from './client'

/**
 * Extended simulation result with helper methods.
 */
export interface ExtendedSimulationResult
  extends Omit<SimulationResult, 'assetChanges'> {
  /** Asset changes (can be null or undefined) */
  assetChanges: AssetChange[] | null | undefined
  /** Check if simulation was successful */
  isSuccess(): boolean
  /** Check if simulation failed */
  isFailed(): boolean
  /** Get total gas used as a number */
  getTotalGasUsed(): bigint
  /** Get gas used by a specific call */
  getCallGasUsed(callIndex: number): bigint
  /** Get all errors from failed calls */
  getErrors(): CallError[]
  /** Get asset changes summary */
  getAssetChangesSummary(): AssetChangeSummary[]
  /** Get the total number of logs across all calls */
  getLogCount(): number
  /** Get decoded events from all calls */
  getDecodedEvents(): DecodedEvent[]
}

/**
 * Simplified asset change summary.
 */
export interface AssetChangeSummary {
  /** Token address */
  tokenAddress: string
  /** Token symbol (if known) */
  symbol?: string | null | undefined
  /** Number of decimals (if known) */
  decimals?: number | null | undefined
  /** Net change amount (formatted) */
  netChange: string
  /** Whether this was a gain or loss */
  type: 'gain' | 'loss'
}

/**
 * Batch simulation configuration.
 */
export interface BatchSimulationConfig {
  /** Array of simulation requests */
  simulations: SimulationRequest[]
  /** Whether to stop on first failure */
  stopOnFailure?: boolean
  /** Maximum concurrent simulations */
  maxConcurrency?: number
}

/**
 * Batch simulation result.
 */
export interface BatchSimulationResult {
  /** Individual simulation results */
  results: ExtendedSimulationResult[]
  /** Overall batch status */
  batchStatus: 'success' | 'partial' | 'failed'
  /** Total execution time */
  totalExecutionTime: number
  /** Number of successful simulations */
  successCount: number
  /** Number of failed simulations */
  failureCount: number
}

/**
 * Simulation request builder interface.
 */
export interface SimulationRequestBuilder {
  /** Add a transaction call */
  call(call: TransactionCall): SimulationRequestBuilder
  /** Add a transaction call with access list */
  callWithAccessList(
    call: Omit<TransactionCall, 'accessList'>,
    accessList: AccessList,
  ): SimulationRequestBuilder
  /** Set account for asset tracking */
  forAccount(account: string): SimulationRequestBuilder
  /** Set block number */
  atBlockNumber(blockNumber: string): SimulationRequestBuilder
  /** Set block tag */
  atBlockTag(blockTag: BlockTag): SimulationRequestBuilder
  /** Set block number or tag (convenience method) */
  atBlock(blockNumberOrTag: string | number | bigint): SimulationRequestBuilder
  /** Enable asset change tracking */
  withAssetChanges(enabled?: boolean): SimulationRequestBuilder
  /** Enable transfer tracking */
  withTransfers(enabled?: boolean): SimulationRequestBuilder
  /** Add state override */
  withStateOverride(override: StateOverride): SimulationRequestBuilder
  /** Add block overrides */
  withBlockOverrides(overrides: BlockOverrides): SimulationRequestBuilder
  /** Set validation mode */
  withValidation(enabled?: boolean): SimulationRequestBuilder
  /** Build the final request */
  build(): SimulationRequest
  /** Execute the simulation */
  execute(): Promise<ExtendedSimulationResult>
}

/**
 * Transaction call configuration helper.
 */
export interface TransactionCallConfig {
  /** Target contract address */
  to?: string | undefined
  /** Sender address */
  from?: string | undefined
  /** Call data */
  data?: string | undefined
  /** Value to send (in wei) */
  value?: string | bigint | undefined
  /** Gas limit */
  gas?: string | bigint | undefined
  /** Access list for gas optimization */
  accessList?: AccessList | undefined
}

/**
 * Gas estimation result.
 */
export interface GasEstimate {
  /** Estimated gas limit */
  gasLimit: bigint
  /** Gas limit as hex string */
  gasLimitHex: string
  /** Base fee (if available) */
  baseFee?: bigint
  /** Priority fee (if available) */
  priorityFee?: bigint
  /** Total estimated cost in wei */
  estimatedCost?: bigint
}

/**
 * Utility types for working with EVM data.
 */
export type Address = `0x${string}`
export type HexString = `0x${string}`
export type HexNumber = `0x${string}`
export type Hash = `0x${string}`

/**
 * Simulation execution options.
 */
export interface SimulationExecutionOptions {
  /** Timeout for simulation execution in milliseconds */
  timeout?: number

  /** Whether to retry on failure */
  retry?: boolean

  /** Maximum number of retry attempts */
  maxRetries?: number
}
