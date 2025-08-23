/**
 * Integration utilities for working with Viem types and the Altitrace SDK.
 *
 * This module provides utilities for converting between Viem types and Altitrace SDK types,
 * making it easy to use the SDK alongside Viem in Web3 applications.
 */

import { ValidationError } from '@sdk/core/errors'
import type {
  Address,
  HexNumber,
  HexString,
  StateOverride,
  TransactionCall,
} from '@sdk/types'
import type {
  Hex,
  Address as ViemAddress,
  StateOverride as ViemStateOverride,
  TransactionRequest as ViemTransactionRequest,
} from 'viem'

/**
 * Convert a Viem transaction request to an Altitrace transaction call.
 * @param viemTx - Viem transaction request
 * @returns Altitrace transaction call
 */
export function viemToTransactionCall(
  viemTx: ViemTransactionRequest,
): TransactionCall {
  const call: TransactionCall = {}

  if (viemTx.from) {
    call.from = viemTx.from as Address
  }

  if (viemTx.to) {
    call.to = viemTx.to as Address
  }

  if (viemTx.data) {
    call.data = viemTx.data as HexString
  }

  if (viemTx.value) {
    call.value =
      typeof viemTx.value === 'bigint'
        ? (`0x${viemTx.value.toString(16)}` as HexNumber)
        : (viemTx.value as HexNumber)
  }

  if (viemTx.gas) {
    call.gas =
      typeof viemTx.gas === 'bigint'
        ? (`0x${viemTx.gas.toString(16)}` as HexNumber)
        : (viemTx.gas as HexNumber)
  }

  return call
}

/**
 * Convert an Altitrace transaction call to a Viem transaction request.
 * @param call - Altitrace transaction call
 * @returns Viem transaction request
 */
export function transactionCallToViem(
  call: TransactionCall,
): ViemTransactionRequest {
  const viemTx: ViemTransactionRequest = {}

  if (call.from) {
    viemTx.from = call.from as ViemAddress
  }

  if (call.to) {
    viemTx.to = call.to as ViemAddress
  }

  if (call.data) {
    viemTx.data = call.data as Hex
  }

  if (call.value) {
    viemTx.value = BigInt(call.value)
  }

  if (call.gas) {
    viemTx.gas = BigInt(call.gas)
  }

  return viemTx
}

/**
 * Convert a Viem state override to an Altitrace state override.
 * @param viemStateOverride - Viem state override
 * @returns Altitrace state override
 */
export function viemToStateOverride(
  viemStateOverride: ViemStateOverride,
): StateOverride[] {
  return viemStateOverride.map((viemOverride) => {
    const stateOverride: StateOverride = {}

    if (viemOverride.address) {
      stateOverride.address = viemOverride.address as Address
    }

    if (viemOverride.balance !== undefined) {
      stateOverride.balance =
        typeof viemOverride.balance === 'bigint'
          ? (`0x${viemOverride.balance.toString(16)}` as HexString)
          : (viemOverride.balance as HexString)
    }

    if (viemOverride.nonce !== undefined) {
      stateOverride.nonce = viemOverride.nonce
    }

    if (viemOverride.code) {
      stateOverride.code = viemOverride.code as HexString
    }

    if (viemOverride.state) {
      stateOverride.state = viemOverride.state.map((slot) => ({
        slot: slot.slot as HexString,
        value: slot.value as HexString,
      }))
    }

    if (viemOverride.stateDiff) {
      const stateDiffMap: { [key: string]: string } = {}
      viemOverride.stateDiff.forEach((slot) => {
        stateDiffMap[slot.slot] = slot.value
      })
      stateOverride.stateDiff = stateDiffMap
    }

    return stateOverride
  })
}

/**
 * Convert an Altitrace StateOverride to Viem StateOverride.
 * @param stateOverride - Altitrace state override
 * @returns Viem state override
 */
export function stateOverrideToViem(
  stateOverride: StateOverride[],
): ViemStateOverride {
  return stateOverride.map((override) => {
    const viemOverride: ViemStateOverride[0] = {
      address: override.address as ViemAddress,
    }

    if (override.balance) {
      viemOverride.balance = BigInt(override.balance)
    }

    if (override.nonce !== undefined && override.nonce !== null) {
      viemOverride.nonce = override.nonce
    }

    if (override.code) {
      viemOverride.code = override.code as Hex
    }

    if (override.state) {
      viemOverride.state = override.state.map((slot) => ({
        slot: slot.slot as Hex,
        value: slot.value as Hex,
      }))
    }

    if (override.stateDiff) {
      const stateMapping: Array<{ slot: Hex; value: Hex }> = []
      Object.entries(override.stateDiff).forEach(([slot, value]) => {
        stateMapping.push({
          slot: slot as Hex,
          value: value as Hex,
        })
      })
      viemOverride.stateDiff = stateMapping
    }

    return viemOverride
  })
}

/**
 * Convert multiple Viem transaction requests to Altitrace transaction calls.
 * @param viemTxs - Array of Viem transaction requests
 * @returns Array of Altitrace transaction calls
 */
export function viemBatchToTransactionCalls(
  viemTxs: readonly ViemTransactionRequest[],
): TransactionCall[] {
  return viemTxs.map(viemToTransactionCall)
}

/**
 * Convert a bigint value to hex number format.
 * @param value - BigInt value
 * @returns Hex number string
 */
export function bigintToHexNumber(value: bigint): HexNumber {
  return `0x${value.toString(16)}` as HexNumber
}

/**
 * Convert a hex number string to bigint.
 * @param hexNumber - Hex number string
 * @returns BigInt value
 */
export function hexNumberToBigint(hexNumber: HexNumber): bigint {
  return BigInt(hexNumber)
}

/**
 * Convert a number to hex number format.
 * @param value - Number value
 * @returns Hex number string
 */
export function numberToHexNumber(value: number): HexNumber {
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError('Value must be a non-negative integer')
  }
  return `0x${value.toString(16)}` as HexNumber
}

/**
 * Convert a hex number string to number.
 * @param hexNumber - Hex number string
 * @returns Number value
 */
export function hexNumberToNumber(hexNumber: HexNumber): number {
  const value = Number.parseInt(hexNumber.replace('0x', ''), 16)
  if (value > Number.MAX_SAFE_INTEGER) {
    throw new ValidationError(
      'Hex number is too large to convert to safe integer',
    )
  }
  return value
}

/**
 * Utility functions for working with gas values in different formats.
 */
export const GasUtils = {
  /**
   * Convert gas value from various formats to hex number.
   * @param gas - Gas value (number, bigint, or hex string)
   * @returns Hex number string
   */
  toHexNumber(gas: number | bigint | string): HexNumber {
    if (typeof gas === 'number') {
      return numberToHexNumber(gas)
    }

    if (typeof gas === 'bigint') {
      return bigintToHexNumber(gas)
    }

    if (typeof gas === 'string') {
      // Validate it's already a hex string
      if (!/^0x[a-fA-F0-9]+$/.test(gas)) {
        throw new ValidationError('Gas string must be a valid hex number')
      }
      return gas as HexNumber
    }

    throw new ValidationError('Gas must be number, bigint, or hex string')
  },

  /**
   * Convert gas value to number format.
   * @param gas - Gas value in hex format
   * @returns Number value
   */
  toNumber(gas: HexNumber): number {
    return hexNumberToNumber(gas)
  },

  /**
   * Convert gas value to bigint format.
   * @param gas - Gas value in hex format
   * @returns BigInt value
   */
  toBigint(gas: HexNumber): bigint {
    return hexNumberToBigint(gas)
  },

  /**
   * Add two gas values.
   * @param gas1 - First gas value
   * @param gas2 - Second gas value
   * @returns Sum as hex number
   */
  add(gas1: HexNumber, gas2: HexNumber): HexNumber {
    const sum = hexNumberToBigint(gas1) + hexNumberToBigint(gas2)
    return bigintToHexNumber(sum)
  },

  /**
   * Subtract two gas values.
   * @param gas1 - First gas value (minuend)
   * @param gas2 - Second gas value (subtrahend)
   * @returns Difference as hex number
   */
  subtract(gas1: HexNumber, gas2: HexNumber): HexNumber {
    const difference = hexNumberToBigint(gas1) - hexNumberToBigint(gas2)
    if (difference < 0n) {
      throw new ValidationError('Gas subtraction resulted in negative value')
    }
    return bigintToHexNumber(difference)
  },

  /**
   * Calculate percentage of gas used.
   * @param gasUsed - Gas used
   * @param gasLimit - Gas limit
   * @returns Percentage (0-100)
   */
  calculatePercentage(gasUsed: HexNumber, gasLimit: HexNumber): number {
    const used = hexNumberToBigint(gasUsed)
    const limit = hexNumberToBigint(gasLimit)

    if (limit === 0n) {
      return 0
    }

    return Number((used * 100n) / limit)
  },
}

/**
 * Utility functions for working with Wei values in different formats.
 */
export const WeiUtils = {
  /**
   * Convert Wei value from various formats to hex number.
   * @param wei - Wei value (number, bigint, or hex string)
   * @returns Hex number string
   */
  toHexNumber(wei: number | bigint | string): HexNumber {
    if (typeof wei === 'number') {
      return numberToHexNumber(wei)
    }

    if (typeof wei === 'bigint') {
      return bigintToHexNumber(wei)
    }

    if (typeof wei === 'string') {
      if (!/^0x[a-fA-F0-9]+$/.test(wei)) {
        throw new ValidationError('Wei string must be a valid hex number')
      }
      return wei as HexNumber
    }

    throw new ValidationError('Wei must be number, bigint, or hex string')
  },

  /**
   * Convert Wei hex value to bigint.
   * @param wei - Wei value in hex format
   * @returns BigInt value
   */
  toBigint(wei: HexNumber): bigint {
    return hexNumberToBigint(wei)
  },

  /**
   * Convert ETH amount to Wei.
   * @param eth - ETH amount as string or number
   * @returns Wei as hex number
   */
  fromEth(eth: string | number): HexNumber {
    const ethBigint =
      typeof eth === 'string' ? BigInt(eth) : BigInt(Math.floor(eth))
    const weiBigint = ethBigint * 10n ** 18n
    return bigintToHexNumber(weiBigint)
  },

  /**
   * Convert Wei to ETH amount.
   * @param wei - Wei value in hex format
   * @returns ETH amount as string
   */
  toEth(wei: HexNumber): string {
    const weiBigint = hexNumberToBigint(wei)
    const ethBigint = weiBigint / 10n ** 18n
    return ethBigint.toString()
  },
}

/**
 * Convert block number from various formats to hex number.
 * @param blockNumber - Block number (number, bigint, or hex string)
 * @returns Hex number string
 */
export function blockNumberToHexNumber(
  blockNumber: number | bigint | string,
): HexNumber {
  if (typeof blockNumber === 'number') {
    return numberToHexNumber(blockNumber)
  }

  if (typeof blockNumber === 'bigint') {
    return bigintToHexNumber(blockNumber)
  }

  if (typeof blockNumber === 'string') {
    if (!/^0x[a-fA-F0-9]+$/.test(blockNumber)) {
      throw new ValidationError(
        'Block number string must be a valid hex number',
      )
    }
    return blockNumber as HexNumber
  }

  throw new ValidationError(
    'Block number must be number, bigint, or hex string',
  )
}

/**
 * Convert hex block number to regular number.
 * @param hexBlockNumber - Block number in hex format
 * @returns Number value
 */
export function blockNumberToNumber(hexBlockNumber: HexNumber): number {
  return hexNumberToNumber(hexBlockNumber)
}

/**
 * Check if a block number is valid (non-negative).
 * @param blockNumber - Block number to validate
 * @returns True if valid
 */
export function isValidBlockNumber(blockNumber: HexNumber): boolean {
  try {
    const num = hexNumberToNumber(blockNumber)
    return num >= 0
  } catch {
    return false
  }
}

/**
 * Utility functions for working with block numbers and tags.
 * @deprecated Use individual functions instead
 */
export const BlockUtils = {
  toHexNumber: blockNumberToHexNumber,
  toNumber: blockNumberToNumber,
  isValid: isValidBlockNumber,
} as const

/**
 * Utility functions for working with StateOverride conversions.
 */
export const StateOverrideUtils = {
  /**
   * Validate if a StateOverride array is valid.
   * @param stateOverride - State override to validate
   * @returns True if valid
   */
  isValid(stateOverride: StateOverride[]): boolean {
    return stateOverride.every((override) => {
      if (!override.address) return false
      if (override.balance && !/^0x[a-fA-F0-9]+$/.test(override.balance))
        return false
      if (override.code && !/^0x[a-fA-F0-9]+$/.test(override.code)) return false
      if (
        override.nonce !== undefined &&
        override.nonce !== null &&
        override.nonce < 0
      )
        return false
      return true
    })
  },

  /**
   * Create a simple state override for a single account.
   * @param address - Account address
   * @param options - Override options
   * @returns StateOverride array
   */
  createSingle(
    address: Address,
    options: {
      balance?: HexString
      nonce?: number
      code?: HexString
      state?: Array<{ slot: HexString; value: HexString }>
      stateDiff?: { [key: string]: string }
    } = {},
  ): StateOverride[] {
    return [
      {
        address,
        ...options,
      },
    ]
  },

  /**
   * Merge multiple state overrides into one.
   * @param overrides - Array of state override arrays
   * @returns Merged state override array
   */
  merge(...overrides: StateOverride[][]): StateOverride[] {
    const merged = new Map<string, StateOverride>()

    overrides.flat().forEach((override) => {
      if (override.address) {
        const existing = merged.get(override.address)
        if (existing) {
          // Merge with existing override
          const mergedOverride: StateOverride = {
            address: override.address,
          }

          if (override.balance !== undefined)
            mergedOverride.balance = override.balance
          if (override.nonce !== undefined)
            mergedOverride.nonce = override.nonce
          if (override.code !== undefined) mergedOverride.code = override.code
          if (override.movePrecompileToAddress !== undefined)
            mergedOverride.movePrecompileToAddress =
              override.movePrecompileToAddress
          if (override.storage !== undefined)
            mergedOverride.storage = override.storage

          // Prefer new state overrides over existing ones
          if (override.state !== undefined) {
            mergedOverride.state = override.state
          } else if (existing.state !== undefined) {
            mergedOverride.state = existing.state
          }

          if (override.stateDiff !== undefined) {
            mergedOverride.stateDiff = override.stateDiff
          } else if (existing.stateDiff !== undefined) {
            mergedOverride.stateDiff = existing.stateDiff
          }

          merged.set(override.address, mergedOverride)
        } else {
          merged.set(override.address, override)
        }
      }
    })

    return Array.from(merged.values())
  },
}
