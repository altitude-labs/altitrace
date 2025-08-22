/**
 * @fileoverview State context helpers for call-many tracing
 */

import type { StateContext, TxIndex } from '@sdk/types/trace'

/**
 * Utility functions for creating state contexts for call-many tracing.
 */
export const StateContextHelpers = {
  /**
   * Create a state context for the latest block.
   */
  latest(): StateContext {
    return {
      block: 'latest',
      txIndex: '-1',
    }
  },

  /**
   * Create a state context for a specific block.
   */
  atBlock(block: string | number): StateContext {
    const blockStr =
      typeof block === 'number' ? `0x${block.toString(16)}` : block
    return {
      block: blockStr,
      txIndex: '-1',
    }
  },

  /**
   * Create a state context for a specific block and transaction index.
   */
  atBlockAndTx(block: string | number, txIndex: number): StateContext {
    const blockStr =
      typeof block === 'number' ? `0x${block.toString(16)}` : block
    return {
      block: blockStr,
      txIndex: { Index: txIndex },
    }
  },

  /**
   * Create a state context for the end of a specific block.
   */
  atBlockEnd(block: string | number): StateContext {
    const blockStr =
      typeof block === 'number' ? `0x${block.toString(16)}` : block
    return {
      block: blockStr,
      txIndex: '-1',
    }
  },
}

/**
 * Utility functions for creating transaction index values.
 */
export const TxIndexHelpers = {
  /**
   * Create a transaction index for the end of the block.
   */
  end(): TxIndex {
    return '-1'
  },

  /**
   * Create a transaction index for a specific position.
   */
  index(value: number): TxIndex {
    return { Index: value }
  },
}
