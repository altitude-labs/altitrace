/**
 * @fileoverview Simulation request builder
 */

import type { AltitraceClient } from '@sdk/client/altitrace-client'
import { ValidationError } from '@sdk/core/errors'
import type {
  Address,
  HexString,
  SimulationRequestBuilder,
  TransactionCall,
  TransactionCallConfig,
} from '@sdk/types'
import { ValidationUtils } from '@sdk/utils/validation'

/**
 * Normalize a transaction call configuration to a standard TransactionCall.
 */
function normalizeTransactionCall(
  call: TransactionCall | TransactionCallConfig,
): TransactionCall {
  const normalized: TransactionCall = {}

  // Handle addresses
  if (call.from) {
    if (!ValidationUtils.isAddress(call.from)) {
      throw new ValidationError('Invalid "from" address')
    }
    normalized.from = call.from
  }

  if (call.to) {
    if (!ValidationUtils.isAddress(call.to)) {
      throw new ValidationError('Invalid "to" address')
    }
    normalized.to = call.to
  }

  // Handle data
  if (call.data) {
    if (!ValidationUtils.isHexString(call.data)) {
      throw new ValidationError('Invalid data - must be a hex string')
    }
    normalized.data = call.data
  }

  // Handle value
  if (call.value !== undefined) {
    if (typeof call.value === 'bigint') {
      normalized.value = `0x${call.value.toString(16)}`
    } else if (typeof call.value === 'string') {
      if (!ValidationUtils.isHexString(call.value)) {
        throw new ValidationError('Invalid value - must be a hex string')
      }
      normalized.value = call.value
    } else {
      throw new ValidationError('Value must be a hex string or bigint')
    }
  }

  // Handle gas
  if (call.gas !== undefined) {
    if (typeof call.gas === 'bigint') {
      normalized.gas = `0x${call.gas.toString(16)}`
    } else if (typeof call.gas === 'string') {
      if (!ValidationUtils.isHexString(call.gas)) {
        throw new ValidationError('Invalid gas - must be a hex string')
      }
      normalized.gas = call.gas
    } else {
      throw new ValidationError('Gas must be a hex string or bigint')
    }
  }

  return normalized
}

/**
 * Create a new simulation request builder.
 *
 * @param client - The Altitrace client instance
 * @returns A new simulation request builder
 *
 * @example
 * ```typescript
 * const client = new AltitraceClient();
 * const builder = createSimulationBuilder(client);
 *
 * // Simulate a single call
 * const result = await builder
 *   .call({
 *     to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
 *     data: '0x70a08231...',
 *   })
 *   .withValidation(true)
 *   .execute();
 *
 * // Simulate multiple calls with state overrides
 * const batchResult = await builder
 *   .call({ to: '0x...', data: '0x...' })
 *   .call({ to: '0x...', data: '0x...' })
 *   .forAccount('0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c')
 *   .withAssetChanges(true)
 *   .withStateOverrides([{
 *     address: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
 *     balance: '0x1000000000000000000'
 *   }])
 *   .execute();
 * ```
 */
export function createSimulationBuilder(
  client: AltitraceClient,
): SimulationRequestBuilder {
  return client.simulate()
}

/**
 * Helper function to create a transaction call configuration.
 */
export function createTransactionCall(
  config: TransactionCallConfig,
): TransactionCall {
  return normalizeTransactionCall(config)
}

/**
 * Helper functions for common transaction patterns.
 */
export const TransactionHelpers = {
  /**
   * Create an ETH transfer call.
   */
  ethTransfer(
    to: Address,
    value: bigint | string,
    from?: Address,
  ): TransactionCall {
    return createTransactionCall({
      to,
      from,
      value: typeof value === 'bigint' ? value : value,
      data: '0x',
    })
  },

  /**
   * Create a contract call.
   */
  contractCall(
    to: Address,
    data: HexString,
    from?: Address,
    value?: bigint | string,
    gas?: bigint | string,
  ): TransactionCall {
    return createTransactionCall({
      to,
      from,
      data,
      value,
      gas,
    })
  },

  /**
   * Create a contract deployment call.
   */
  contractDeploy(
    bytecode: HexString,
    from?: Address,
    value?: bigint | string,
    gas?: bigint | string,
  ): TransactionCall {
    return createTransactionCall({
      from,
      data: bytecode,
      value,
      gas,
      // to is undefined for contract creation
    })
  },
}
