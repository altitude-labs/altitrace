/**
 * @fileoverview Trace request builder for fluent API
 *
 * This module provides builder functions for creating trace requests
 * with a clean, chainable API. It supports multiple tracer types and
 * comprehensive configuration options.
 */

import type { AltitraceClient } from '@sdk/client/altitrace-client'
import type {
  BlockOverrides,
  StateOverride,
  TraceConfig,
  TraceRequestBuilder,
} from '@sdk/types'

/**
 * Create a new trace request builder.
 *
 * @param client - The Altitrace client instance
 * @returns A new trace request builder
 *
 * @example Basic Usage
 * ```typescript
 * const client = new AltitraceClient();
 * const builder = createTraceBuilder(client);
 *
 * // Trace a transaction with call tracer
 * const txTrace = await builder
 *   .transaction('0x123...')
 *   .withCallTracer({ onlyTopCall: false, withLogs: true })
 *   .execute();
 *
 * // Trace a call with multiple tracers
 * const callTrace = await builder
 *   .call({
 *     to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
 *     data: '0x70a08231...',
 *   })
 *   .atBlock('latest')
 *   .withCallTracer()
 *   .withPrestateTracer({ diffMode: true })
 *   .with4ByteTracer()
 *   .execute();
 * ```
 *
 * @example Advanced Usage with Overrides
 * ```typescript
 * // Trace with state and block overrides
 * const advancedTrace = await builder
 *   .call({
 *     from: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
 *     to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
 *     data: '0xa9059cbb...',
 *   })
 *   .atBlock(18500000)
 *   .withCallTracer({ withLogs: true })
 *   .withStateOverrides({
 *     '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c': {
 *       balance: '0x1000000000000000000', // 1 ETH
 *     }
 *   })
 *   .withBlockOverrides({
 *     baseFee: '0x3b9aca00', // 1 gwei
 *     gasLimit: 30000000,
 *   })
 *   .execute();
 * ```
 *
 * @example Struct Logger with Custom Configuration
 * ```typescript
 * // Detailed execution trace with struct logger
 * const detailedTrace = await builder
 *   .call({
 *     to: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
 *     data: '0x18160ddd', // totalSupply()
 *   })
 *   .withStructLogger({
 *     disableMemory: false,    // Include memory
 *     disableStack: false,     // Include stack
 *     disableStorage: false,   // Include storage
 *     disableReturnData: false,
 *     cleanStructLogs: false,  // Keep detailed logs
 *   })
 *   .execute();
 *
 * // Analyze the execution
 * console.log(`Total opcodes: ${detailedTrace.structLogger.totalOpcodes}`);
 * console.log(`Gas used: ${detailedTrace.getTotalGasUsed()}`);
 * ```
 */
export function createTraceBuilder(
  client: AltitraceClient,
): TraceRequestBuilder {
  return client.trace()
}

/**
 * Utility functions for creating common trace configurations.
 */
export const TraceHelpers = {
  /**
   * Create a comprehensive trace configuration with all tracers enabled.
   */
  allTracers(): TraceConfig {
    return {
      callTracer: { onlyTopCall: false, withLogs: true },
      prestateTracer: {
        diffMode: true,
        disableCode: false,
        disableStorage: false,
      },
      structLogger: {
        disableMemory: true,
        disableStack: false,
        disableStorage: false,
        disableReturnData: false,
        cleanStructLogs: true,
      },
      '4byteTracer': true,
    }
  },

  /**
   * Create a minimal trace configuration for basic call tracking.
   */
  basicCallTrace(): TraceConfig {
    return {
      callTracer: { onlyTopCall: false, withLogs: true },
    }
  },

  /**
   * Create a configuration optimized for state analysis.
   */
  stateAnalysis(): TraceConfig {
    return {
      prestateTracer: {
        diffMode: true,
        disableCode: false,
        disableStorage: false,
      },
      callTracer: { onlyTopCall: false, withLogs: false },
    }
  },

  /**
   * Create a configuration for detailed EVM execution analysis.
   */
  detailedExecution(): TraceConfig {
    return {
      structLogger: {
        disableMemory: false,
        disableStack: false,
        disableStorage: false,
        disableReturnData: false,
        cleanStructLogs: false,
      },
      callTracer: { onlyTopCall: false, withLogs: true },
    }
  },

  /**
   * Create a configuration for function call analysis.
   */
  functionAnalysis(): TraceConfig {
    return {
      '4byteTracer': true,
      callTracer: { onlyTopCall: false, withLogs: false },
    }
  },
}

/**
 * Utility functions for creating common state overrides.
 */
export const StateOverrideHelpers = {
  /**
   * Create a state override to set account balance.
   */
  setBalance(
    address: string,
    balance: bigint | string,
  ): Record<string, StateOverride> {
    const balanceHex =
      typeof balance === 'bigint' ? `0x${balance.toString(16)}` : balance
    return {
      [address]: { balance: balanceHex },
    }
  },

  /**
   * Create a state override to set account nonce.
   */
  setNonce(address: string, nonce: number): Record<string, StateOverride> {
    return {
      [address]: { nonce },
    }
  },

  /**
   * Create a state override to replace contract code.
   */
  setCode(address: string, code: string): Record<string, StateOverride> {
    return {
      [address]: { code },
    }
  },

  /**
   * Create a state override to modify storage slots.
   */
  setStorage(
    address: string,
    storage: Record<string, string>,
  ): Record<string, StateOverride> {
    return {
      [address]: { storage },
    }
  },

  /**
   * Create a state override for complete account state.
   */
  setAccount(
    address: string,
    config: {
      balance?: bigint | string
      nonce?: number
      code?: string
      storage?: Record<string, string>
    },
  ): Record<string, StateOverride> {
    const override: StateOverride = {}

    if (config.balance !== undefined) {
      override.balance =
        typeof config.balance === 'bigint'
          ? `0x${config.balance.toString(16)}`
          : config.balance
    }

    if (config.nonce !== undefined) {
      override.nonce = config.nonce
    }

    if (config.code !== undefined) {
      override.code = config.code
    }

    if (config.storage !== undefined) {
      override.storage = config.storage
    }

    return { [address]: override }
  },
}

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
