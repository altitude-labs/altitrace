/**
 * @fileoverview Block override helpers for simulation and tracing
 */

import type { BlockOverrides } from '@sdk/types'

/**
 * Utility functions for creating common block overrides.
 */
export const BlockOverrideHelpers = {
  /**
   * Create block overrides for a specific timestamp.
   */
  setTimestamp(timestamp: number): BlockOverrides {
    return { time: timestamp }
  },

  /**
   * Create block overrides for a specific block number.
   */
  setBlockNumber(blockNumber: string | number): BlockOverrides {
    const numberHex =
      typeof blockNumber === 'number'
        ? `0x${blockNumber.toString(16)}`
        : blockNumber
    return { number: numberHex }
  },

  /**
   * Create block overrides for gas parameters.
   */
  setGasParams(config: {
    gasLimit?: number
    baseFee?: string
  }): BlockOverrides {
    const override: BlockOverrides = {}

    if (config.gasLimit !== undefined) {
      override.gasLimit = config.gasLimit
    }

    if (config.baseFee !== undefined) {
      override.baseFee = config.baseFee
    }

    return override
  },

  /**
   * Create block overrides for coinbase (fee recipient).
   */
  setCoinbase(coinbase: string): BlockOverrides {
    return { coinbase }
  },
}
