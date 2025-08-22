/**
 * @fileoverview Bundle helpers for call-many tracing
 */

import type { BlockOverrides, TransactionCall } from '@sdk/types'
import type { Bundle } from '@sdk/types/trace'

/**
 * Utility functions for creating bundles for call-many tracing.
 */
export const BundleHelpers = {
  /**
   * Create a simple bundle with transactions.
   */
  createBundle(transactions: TransactionCall[]): Bundle {
    return {
      transactions,
    }
  },

  /**
   * Create a bundle with transactions and block overrides.
   */
  createBundleWithOverrides(
    transactions: TransactionCall[],
    blockOverrides: BlockOverrides,
  ): Bundle {
    return {
      transactions,
      blockOverrides,
    }
  },

  /**
   * Create multiple bundles from transaction arrays.
   */
  createBundles(transactionArrays: TransactionCall[][]): Bundle[] {
    return transactionArrays.map((transactions) => ({ transactions }))
  },

  /**
   * Create a bundle for a single transaction.
   */
  singleTransaction(transaction: TransactionCall): Bundle {
    return {
      transactions: [transaction],
    }
  },
}
