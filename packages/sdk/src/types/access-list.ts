/**
 * @fileoverview Access list types for the Altitrace SDK
 */

import type { components } from '@sdk/generated/api-types'
import type { ExtendedSimulationResult } from './simulation'
import type { TransactionCall } from './transaction'

// Type aliases for OpenAPI generated types
export type AccessList = components['schemas']['AccessList']
export type AccessListItem = components['schemas']['AccessListItem']
export type AccessListRequest = components['schemas']['AccessListRequest']
export type AccessListResponse = components['schemas']['AccessListResponse']

/**
 * Extended access list response with helper methods.
 */
export interface ExtendedAccessListResponse extends AccessListResponse {
  /**
   * Check if the access list generation was successful.
   */
  isSuccess(): boolean

  /**
   * Check if the access list generation failed.
   */
  isFailed(): boolean

  /**
   * Get the total gas used as a BigInt.
   */
  getTotalGasUsed(): bigint

  /**
   * Get the number of accounts in the access list.
   */
  getAccountCount(): number

  /**
   * Get the total number of storage slots across all accounts.
   */
  getStorageSlotCount(): number

  /**
   * Get access list summary grouped by account.
   */
  getAccessListSummary(): AccessListSummary[]

  /**
   * Check if an account is in the access list.
   */
  hasAccount(address: string): boolean

  /**
   * Get storage slots for a specific account.
   */
  getAccountStorageSlots(address: string): string[]
}

/**
 * Summary of access list entries for an account.
 */
export interface AccessListSummary {
  address: string
  storageSlotCount: number
  storageSlots: string[]
}

/**
 * Access list request builder interface.
 */
export interface AccessListRequestBuilder {
  /**
   * Set the transaction call parameters.
   */
  withTransaction(call: TransactionCall): AccessListRequestBuilder

  /**
   * Set the block to generate the access list against.
   */
  atBlock(blockNumberOrTag: string | number | bigint): AccessListRequestBuilder

  /**
   * Set execution options for the access list request.
   */
  withExecutionOptions(
    options: AccessListExecutionOptions,
  ): AccessListRequestBuilder

  /**
   * Set custom timeout for the request.
   */
  withTimeout(timeout: number): AccessListRequestBuilder

  /**
   * Set custom headers for the request.
   */
  withHeaders(headers: Record<string, string>): AccessListRequestBuilder

  /**
   * Enable or disable request retries.
   */
  withRetry(enabled: boolean): AccessListRequestBuilder

  /**
   * Execute the access list request.
   */
  execute(): Promise<ExtendedAccessListResponse>

  /**
   * Build the access list request without executing.
   */
  build(): AccessListRequest
}

/**
 * Access list execution options.
 */
export interface AccessListExecutionOptions {
  /**
   * Request timeout in milliseconds.
   */
  timeout?: number

  /**
   * Custom headers to include with the request.
   */
  headers?: Record<string, string>

  /**
   * Whether to retry failed requests.
   */
  retry?: boolean
}

/**
 * Result of comparing gas usage with and without access list.
 */
export interface AccessListComparisonResult {
  /** Baseline simulation without access list */
  baseline?: ExtendedSimulationResult
  /** Optimized simulation with access list */
  optimized?: ExtendedSimulationResult
  /** Access list data used for optimization */
  accessListData?: ExtendedAccessListResponse
  /** Comparison metrics */
  comparison: {
    /** Baseline gas usage */
    gasBaseline?: bigint
    /** Optimized gas usage */
    gasOptimized?: bigint
    /** Gas difference (negative = savings, positive = overhead) */
    gasDifference?: bigint
    /** Percentage change */
    gasPercentageChange?: number
    /** Whether access list is effective */
    accessListEffective?: boolean
    /** Whether access list is recommended */
    recommended: boolean
  }
  /** Success flags for each operation */
  success: {
    /** Baseline simulation succeeded */
    baseline: boolean
    /** Access list generation succeeded */
    accessList: boolean
    /** Optimized simulation succeeded */
    optimized: boolean
  }
  /** Error messages for failed operations */
  errors: {
    /** Baseline simulation error */
    baseline?: string
    /** Access list generation error */
    accessList?: string
    /** Optimized simulation error */
    optimized?: string
  }
}

/**
 * Access list comparison builder interface.
 */
export interface AccessListComparisonBuilder {
  /**
   * Set the transaction call to analyze.
   */
  call(call: TransactionCall): AccessListComparisonBuilder

  /**
   * Set the block to simulate against.
   */
  atBlock(
    blockNumberOrTag: string | number | bigint,
  ): AccessListComparisonBuilder

  /**
   * Enable asset changes tracking.
   */
  withAssetChanges(enabled: boolean): AccessListComparisonBuilder

  /**
   * Enable transfers tracking.
   */
  withTransfers(enabled: boolean): AccessListComparisonBuilder

  /**
   * Enable validation.
   */
  withValidation(enabled: boolean): AccessListComparisonBuilder

  /**
   * Execute the comparison.
   */
  execute(): Promise<AccessListComparisonResult>

  /**
   * Build the comparison request without executing.
   */
  build(): {
    call: TransactionCall
    block: string
    options: {
      traceAssetChanges: boolean
      traceTransfers: boolean
      validation: boolean
    }
  }
}
