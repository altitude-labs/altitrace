import type { StateOverride } from '@altitrace/sdk/types'

/**
 * Convert ETH amount to wei in hex format
 */
export function ethToWeiHex(ethAmount: number | string): string {
  const ethValue = typeof ethAmount === 'string' ? parseFloat(ethAmount) : ethAmount
  const weiValue = Math.floor(ethValue * 1e18)
  return `0x${weiValue.toString(16)}`
}

/**
 * Convert wei hex to ETH for display
 */
export function weiHexToEth(weiHex: string): string {
  try {
    const weiValue = BigInt(weiHex)
    const ethValue = Number(weiValue) / 1e18
    return ethValue.toFixed(4)
  } catch {
    return '0'
  }
}

/**
 * Validate a storage slot (32 bytes hex)
 */
export function isValidStorageSlot(slot: string): boolean {
  if (!slot.startsWith('0x')) return false
  const hex = slot.slice(2)
  return hex.length <= 64 && /^[0-9a-fA-F]*$/.test(hex)
}

/**
 * Normalize storage slot to 32 bytes (64 hex chars)
 */
export function normalizeStorageSlot(slot: string): string {
  if (!slot.startsWith('0x')) slot = `0x${slot}`
  const hex = slot.slice(2)
  return `0x${hex.padStart(64, '0')}`
}

/**
 * Common state override presets
 */
export const STATE_OVERRIDE_PRESETS = {
  richAccount: (address?: string): StateOverride => ({
    address: address || '',
    balance: '0x3635c9adc5dea00000', // 1000 ETH
  }),

  emptyContract: (address?: string): StateOverride => ({
    address: address || '',
    code: '0x',
  }),

  highNonce: (address?: string, nonce = 100): StateOverride => ({
    address: address || '',
    nonce,
  }),

  customBalance: (address: string, ethAmount: number): StateOverride => ({
    address,
    balance: ethToWeiHex(ethAmount),
  }),

  storageOverride: (
    address: string,
    slots: Array<{ slot: string; value: string }>,
  ): StateOverride => ({
    address,
    state: slots.map(({ slot, value }) => ({
      slot: normalizeStorageSlot(slot),
      value: normalizeStorageSlot(value),
    })),
  }),
} as const

/**
 * Validate a complete state override
 */
export function validateStateOverride(override: StateOverride): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!override.address) {
    errors.push('Address is required')
  } else if (!/^0x[0-9a-fA-F]{40}$/i.test(override.address)) {
    errors.push('Invalid address format')
  }

  if (override.balance) {
    try {
      if (override.balance.startsWith('0x')) {
        // Hex format
        if (!/^0x[0-9a-fA-F]+$/i.test(override.balance)) {
          errors.push('Invalid balance format (invalid hex)')
        }
      } else {
        // Decimal format - validate it can be parsed
        const num = BigInt(override.balance)
        if (num < 0n) {
          errors.push('Balance cannot be negative')
        }
      }
    } catch {
      errors.push('Invalid balance format (must be hex 0x... or decimal)')
    }
  }

  if (override.code && !/^0x[0-9a-fA-F]*$/i.test(override.code)) {
    errors.push('Invalid code format (must be hex)')
  }

  if (override.nonce && (override.nonce < 0 || !Number.isInteger(override.nonce))) {
    errors.push('Invalid nonce (must be non-negative integer)')
  }

  if (override.state) {
    override.state.forEach((slot, index) => {
      if (!isValidStorageSlot(slot.slot)) {
        errors.push(`Invalid storage slot format at index ${index}`)
      }
      if (!isValidStorageSlot(slot.value)) {
        errors.push(`Invalid storage value format at index ${index}`)
      }
    })
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Convert balance to hex format if needed
 */
export function normalizeBalance(balance: string): string {
  if (balance.startsWith('0x')) {
    return balance
  }
  // Convert decimal to hex
  const num = BigInt(balance)
  return `0x${num.toString(16)}`
}

/**
 * Clean up empty fields from state override
 */
export function cleanStateOverride(override: StateOverride): StateOverride {
  const cleaned: StateOverride = { address: override.address }

  if (override.balance && override.balance !== '0x0') {
    cleaned.balance = normalizeBalance(override.balance)
  }

  if (override.nonce !== null && override.nonce !== undefined && override.nonce > 0) {
    cleaned.nonce = override.nonce
  }

  if (override.code && override.code !== '0x') {
    cleaned.code = override.code
  }

  if (override.state && override.state.length > 0) {
    const validSlots = override.state.filter(
      (slot) => slot.slot && slot.value && isValidStorageSlot(slot.slot) && isValidStorageSlot(slot.value)
    )
    if (validSlots.length > 0) {
      cleaned.state = validSlots.map((slot) => ({
        slot: normalizeStorageSlot(slot.slot),
        value: normalizeStorageSlot(slot.value),
      }))
    }
  }

  return cleaned
}

/**
 * Get human-readable summary of state override
 */
export function getStateOverrideSummary(override: StateOverride): string[] {
  const summary: string[] = []

  if (override.balance) {
    const ethAmount = weiHexToEth(override.balance)
    summary.push(`Balance: ${ethAmount} ETH`)
  }

  if (override.nonce !== null && override.nonce !== undefined) {
    summary.push(`Nonce: ${override.nonce}`)
  }

  if (override.code) {
    const codeLength = override.code.length - 2 // Remove '0x'
    if (codeLength === 0) {
      summary.push('Code: Empty contract')
    } else {
      summary.push(`Code: ${codeLength / 2} bytes`)
    }
  }

  if (override.state && override.state.length > 0) {
    summary.push(`Storage: ${override.state.length} slot(s)`)
  }

  return summary
}

/**
 * Export state overrides to JSON
 */
export function exportStateOverrides(overrides: StateOverride[]): string {
  const cleaned = overrides
    .filter((override) => override.address)
    .map(cleanStateOverride)

  return JSON.stringify(cleaned, null, 2)
}

/**
 * Import state overrides from JSON
 */
export function importStateOverrides(json: string): StateOverride[] {
  try {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) {
      throw new Error('JSON must be an array of state overrides')
    }

    return parsed.filter((override) => {
      const validation = validateStateOverride(override)
      return validation.isValid
    })
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}