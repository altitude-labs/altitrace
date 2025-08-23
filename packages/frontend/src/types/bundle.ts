/**
 * @fileoverview Bundle simulation types and interfaces
 */

import type {
  Address,
  BlockTag,
  HexString as Hex,
  SimulationParams,
  SimulationRequest,
  TransactionCall,
} from '@altitrace/sdk/types'
import type { ExtendedTracerResponse } from '@altitrace/sdk/types'

/**
 * Individual transaction within a bundle
 */
export interface BundleTransaction {
  /** Unique ID for form management */
  id: string
  /** Transaction call details */
  transaction: TransactionCall
  /** Whether this transaction is enabled for execution */
  enabled: boolean
  /** Whether to continue bundle execution if this transaction fails */
  continueOnFailure: boolean
  /** Optional label for the transaction */
  label?: string
}

/**
 * Bundle simulation request data structure
 */
export interface BundleSimulationRequest {
  /** Array of transactions to execute sequentially */
  transactions: BundleTransaction[]
  /** Shared block parameters */
  blockNumber?: string
  blockTag?: BlockTag
  /** Whether to validate all transactions */
  validation: boolean
  /** Account for asset tracking (optional) */
  account?: Address
  /** Enable asset change tracking */
  traceAssetChanges: boolean
  /** Enable transfer tracking */
  traceTransfers: boolean
}

/**
 * Bundle simulation result with per-transaction results
 */
export interface BundleSimulationResult {
  /** Bundle execution ID */
  bundleId: string
  /** Overall bundle status */
  bundleStatus: 'success' | 'partial_success' | 'failed'
  /** Block number where bundle was executed */
  blockNumber: string
  /** Total gas used across all transactions */
  totalGasUsed: string
  /** Individual transaction results */
  transactionResults: BundleTransactionResult[]
  /** Bundle-level errors */
  bundleErrors?: string[]
  /** Asset changes across the entire bundle */
  bundleAssetChanges?: any[]
  /** Total execution time */
  executionTimeMs: number
}

/**
 * Result for individual transaction within bundle
 */
export interface BundleTransactionResult {
  /** Transaction ID matching the bundle transaction */
  transactionId: string
  /** Transaction execution status */
  status: 'success' | 'failed' | 'skipped'
  /** Gas used by this transaction */
  gasUsed: string
  /** Return data from the transaction */
  returnData?: string
  /** Error details if transaction failed */
  error?: {
    type: string
    reason: string
    message: string
  }
  /** Logs/events emitted by this transaction */
  logs: any[]
  /** Asset changes from this specific transaction */
  assetChanges?: any[]
  /** Full trace data for this transaction (for trace/access list tabs) */
  traceData?: ExtendedTracerResponse
  /** Original transaction details */
  originalTransaction?: {
    to?: string
    from?: string
    data?: string
    value?: string
    gas?: string
  }
}

/**
 * Form data structure for bundle building
 */
export interface BundleFormData {
  /** Transaction bundle */
  transactions: BundleTransaction[]
  /** Block parameters */
  blockTag: SimulationParams['blockTag']
  blockNumber: string
  /** Validation settings */
  validation: boolean
  /** Account for tracking */
  account?: string
}

/**
 * Default bundle transaction data
 */
export const createDefaultBundleTransaction = (
  id?: string,
): BundleTransaction => ({
  id: id || crypto.randomUUID(),
  transaction: {
    to: '',
    from: '',
    data: '',
    value: '0x0',
    gas: '', // Empty string - will be filtered out during API call to avoid parsing errors
  },
  enabled: true,
  continueOnFailure: false,
  label: '',
})

/**
 * Default bundle form data
 */
export const createDefaultBundleFormData = (): BundleFormData => ({
  transactions: [createDefaultBundleTransaction()],
  blockTag: 'latest',
  blockNumber: '',
  validation: true,
})
