/**
 * @fileoverview Access list comparison types for the Altitrace SDK
 */

import type {
  ExtendedAccessListResponse,
  ExtendedSimulationResult,
  TransactionCall,
} from '@sdk/types'

/**
 * Result of comparing simulation with and without access list.
 */
export interface AccessListComparisonResult {
  /** Simulation result without access list (baseline) */
  baseline: ExtendedSimulationResult | null

  /** Generated access list data */
  accessListData: ExtendedAccessListResponse | null

  /** Simulation result with access list (optimized) */
  optimized: ExtendedSimulationResult | null

  /** Detailed comparison metrics */
  comparison: AccessListComparisonMetrics

  /** Success status for each operation */
  success: AccessListComparisonSuccess

  /** Any errors that occurred during the process */
  errors: AccessListComparisonErrors

  /** Execution timing information */
  timing: AccessListComparisonTiming
}

/**
 * Gas and performance comparison metrics.
 */
export interface AccessListComparisonMetrics {
  /** Gas used in baseline simulation */
  gasBaseline: bigint | null

  /** Gas used in optimized simulation */
  gasOptimized: bigint | null

  /** Gas difference (positive = savings, negative = overhead) */
  gasDifference: bigint | null

  /** Percentage change in gas usage */
  gasPercentageChange: number | null

  /** Whether access list provided gas savings */
  accessListEffective: boolean

  /** Access list generation cost */
  accessListGasCost: bigint | null

  /** Net savings accounting for access list generation cost */
  netGasSavings: bigint | null

  /** Recommended to use access list based on analysis */
  recommended: boolean
}

/**
 * Success status for each comparison operation.
 */
export interface AccessListComparisonSuccess {
  /** Baseline simulation succeeded */
  baseline: boolean

  /** Access list generation succeeded */
  accessList: boolean

  /** Optimized simulation succeeded */
  optimized: boolean

  /** Overall comparison was successful (at least baseline succeeded) */
  overall: boolean
}

/**
 * Errors that occurred during comparison operations.
 */
export interface AccessListComparisonErrors {
  /** Error from baseline simulation */
  baseline: string | null

  /** Error from access list generation */
  accessList: string | null

  /** Error from optimized simulation */
  optimized: string | null
}

/**
 * Timing information for comparison operations.
 */
export interface AccessListComparisonTiming {
  /** Time taken for baseline simulation (ms) */
  baselineTime: number | null

  /** Time taken for access list generation (ms) */
  accessListTime: number | null

  /** Time taken for optimized simulation (ms) */
  optimizedTime: number | null

  /** Total comparison time (ms) */
  totalTime: number
}

/**
 * Access list comparison builder interface.
 */
export interface AccessListComparisonBuilder {
  /**
   * Set the transaction call to compare.
   */
  call(call: TransactionCall): AccessListComparisonBuilder

  /**
   * Set the account for asset tracking.
   */
  forAccount(account: string): AccessListComparisonBuilder

  /**
   * Set block number for simulation.
   */
  atBlockNumber(blockNumber: string): AccessListComparisonBuilder

  /**
   * Set block tag for simulation.
   */
  atBlockTag(blockTag: string): AccessListComparisonBuilder

  /**
   * Set block number or tag (convenience method).
   */
  atBlock(
    blockNumberOrTag: string | number | bigint,
  ): AccessListComparisonBuilder

  /**
   * Enable asset change tracking.
   */
  withAssetChanges(enabled?: boolean): AccessListComparisonBuilder

  /**
   * Enable transfer tracking.
   */
  withTransfers(enabled?: boolean): AccessListComparisonBuilder

  /**
   * Set validation mode.
   */
  withValidation(enabled?: boolean): AccessListComparisonBuilder

  /**
   * Set custom timeout for operations.
   */
  withTimeout(timeout: number): AccessListComparisonBuilder

  /**
   * Execute the comparison and return results.
   */
  execute(): Promise<AccessListComparisonResult>

  /**
   * Build the comparison request without executing.
   */
  build(): AccessListComparisonRequest
}

/**
 * Internal comparison request structure.
 */
export interface AccessListComparisonRequest {
  call: TransactionCall
  options: {
    blockTag?: string
    validation?: boolean
    traceAssetChanges?: boolean
    traceTransfers?: boolean
    account?: string
    timeout?: number
  }
}

/**
 * Configuration for access list comparison execution.
 */
export interface AccessListComparisonConfig {
  /** Custom timeout for each operation (ms) */
  operationTimeout?: number

  /** Whether to continue with optimized simulation if access list generation fails */
  continueOnAccessListFailure?: boolean

  /** Whether to include detailed timing information */
  includeTimingDetails?: boolean

  /** Custom headers for requests */
  headers?: Record<string, string>
}

/**
 * Summary of access list comparison for easy interpretation.
 */
export interface AccessListComparisonSummary {
  /** Whether access list is recommended for this transaction */
  recommended: boolean

  /** Reason for recommendation */
  reason: string

  /** Gas savings amount and percentage */
  savings: {
    absolute: bigint | null
    percentage: number | null
  }

  /** Access list effectiveness rating (0-5 stars) */
  effectiveness: number

  /** Quick summary text */
  summary: string
}
