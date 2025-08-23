/**
 * @fileoverview State override helpers for simulation and tracing
 */

import type { StateOverride } from '@sdk/types'

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
    console.log(`🔧 [SDK StateOverride] Setting code override for ${address}`)
    console.log(`   📄 Code length: ${code.length} characters`)
    console.log(`   📄 Code preview: ${code.substring(0, 50)}...`)

    const override = {
      [address]: { code },
    }

    console.log(`   ✅ Code override created for address ${address}`)
    return override
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
