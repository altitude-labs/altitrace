import type { Address, HexString as Hex } from '@altitrace/sdk/types'
import { isAddress, isHex } from 'viem'
import type { BlockNumber } from '@/types/api'

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

// Validate Ethereum address
export function validateAddress(value: string, fieldName = 'address'): Address {
  if (!value) {
    throw new ValidationError('Address is required', fieldName)
  }

  if (!isAddress(value)) {
    throw new ValidationError('Invalid address format', fieldName)
  }

  return value as Address
}

// Validate hex string
export function validateHex(value: string, fieldName = 'hex'): Hex {
  if (!value) {
    throw new ValidationError('Hex value is required', fieldName)
  }

  if (!isHex(value)) {
    throw new ValidationError(
      'Invalid hex format - must start with 0x',
      fieldName,
    )
  }

  return value as Hex
}

// Validate optional hex string (allows both hex and decimal for data field)
export function validateOptionalHex(
  value: string,
  fieldName = 'hex',
  allowDecimal = false,
): Hex | undefined {
  if (!value || value.trim() === '') {
    return undefined
  }

  // Special handling for data field - allow decimal conversion
  if (allowDecimal && fieldName === 'data' && !value.startsWith('0x')) {
    try {
      // Try to parse as decimal and convert to hex
      const num = BigInt(value)
      return `0x${num.toString(16)}` as Hex
    } catch {
      // If parsing fails, fall through to normal hex validation
    }
  }

  return validateHex(value, fieldName)
}

// Validate data field (hex or decimal)
export function validateOptionalData(
  value: string,
  fieldName = 'data',
): Hex | undefined {
  if (!value || value.trim() === '') {
    return undefined
  }

  try {
    // Handle hex format
    if (value.startsWith('0x')) {
      return validateHex(value, fieldName)
    }
    
    // Handle decimal format - convert to hex
    const num = BigInt(value)
    if (num < 0n) {
      throw new ValidationError('Data value cannot be negative', fieldName)
    }
    return `0x${num.toString(16)}` as Hex
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error
    }
    throw new ValidationError('Invalid data format - must be hex (0x...) or decimal', fieldName)
  }
}

// Validate optional block number (hex or decimal)
export function validateOptionalBlockNumber(
  value: string,
  fieldName = 'blockNumber',
): BlockNumber | undefined {
  if (!value || value.trim() === '') {
    return undefined
  }

  try {
    // Handle both hex format and decimal format
    if (value.startsWith('0x')) {
      // Hex format
      if (!isHex(value)) {
        throw new ValidationError(
          'Block number must be in valid hex format (e.g., 0x123)',
          fieldName,
        )
      }
      return value as BlockNumber
    }
    // Decimal format - convert to hex
    const blockNum = BigInt(value)
    if (blockNum < 0n) {
      throw new ValidationError('Block number cannot be negative', fieldName)
    }
    return `0x${blockNum.toString(16)}` as BlockNumber
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error
    }
    throw new ValidationError('Invalid block number format', fieldName)
  }
}

// Validate optional gas value (hex or decimal)
export function validateOptionalGas(
  value: string,
  fieldName = 'gas',
): Hex | undefined {
  if (!value || value.trim() === '') {
    return undefined
  }

  try {
    let gasHex: Hex

    // Handle both hex format and decimal format
    if (value.startsWith('0x')) {
      // Hex format
      gasHex = validateHex(value, fieldName)
    } else {
      // Decimal format - convert to hex
      const gasAmount = BigInt(value)
      if (gasAmount <= 0n) {
        throw new ValidationError('Gas must be greater than 0', fieldName)
      }
      gasHex = `0x${gasAmount.toString(16)}` as Hex
    }

    // Validate gas amount limits
    const gasAmount = BigInt(gasHex)
    if (gasAmount <= 0n) {
      throw new ValidationError('Gas must be greater than 0', fieldName)
    }
    if (gasAmount > 100_000_000n) {
      throw new ValidationError('Gas amount is too high (max 100M)', fieldName)
    }

    return gasHex
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error
    }
    throw new ValidationError('Invalid gas value format', fieldName)
  }
}

// Validate block number (hex string)
export function validateBlockNumber(
  value: string,
  fieldName = 'blockNumber',
): BlockNumber {
  if (!value) {
    throw new ValidationError('Block number is required', fieldName)
  }

  if (!isHex(value)) {
    throw new ValidationError(
      'Block number must be in hex format (e.g., 0x123)',
      fieldName,
    )
  }

  return value as BlockNumber
}

// Validate gas value
export function validateGas(value: string, fieldName = 'gas'): Hex {
  const hex = validateHex(value, fieldName)

  try {
    const gasAmount = BigInt(hex)
    if (gasAmount <= 0n) {
      throw new ValidationError('Gas must be greater than 0', fieldName)
    }
    if (gasAmount > 30_000_000n) {
      throw new ValidationError('Gas amount is too high (max 30M)', fieldName)
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error
    }
    throw new ValidationError('Invalid gas value', fieldName)
  }

  return hex
}

// Validate ether value (converts to wei hex)
export function validateValue(value: string, fieldName = 'value'): Hex {
  if (!value || value.trim() === '') {
    return '0x0' as Hex
  }

  try {
    // Handle both hex format and decimal format
    if (value.startsWith('0x')) {
      // Already hex format
      const hex = validateHex(value, fieldName)
      BigInt(hex) // Validate it's a valid number
      return hex
    }
    // Decimal format - convert to hex
    const wei = BigInt(value)
    if (wei < 0n) {
      throw new ValidationError('Value cannot be negative', fieldName)
    }
    return `0x${wei.toString(16)}` as Hex
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error
    }
    throw new ValidationError('Invalid value format', fieldName)
  }
}

// Validate required field
export function validateRequired(value: string, fieldName: string): string {
  if (!value || value.trim() === '') {
    throw new ValidationError(`${fieldName} is required`, fieldName)
  }
  return value.trim()
}

// Validate JSON string
export function validateJson(value: string, fieldName = 'json'): unknown {
  if (!value || value.trim() === '') {
    throw new ValidationError('JSON is required', fieldName)
  }

  try {
    return JSON.parse(value)
  } catch {
    throw new ValidationError('Invalid JSON format', fieldName)
  }
}

// Validate number within range
export function validateNumber(
  value: string | number,
  min?: number,
  max?: number,
  fieldName = 'number',
): number {
  const num = typeof value === 'string' ? Number.parseFloat(value) : value

  if (Number.isNaN(num)) {
    throw new ValidationError('Must be a valid number', fieldName)
  }

  if (min !== undefined && num < min) {
    throw new ValidationError(`Must be at least ${min}`, fieldName)
  }

  if (max !== undefined && num > max) {
    throw new ValidationError(`Must be at most ${max}`, fieldName)
  }

  return num
}

// Format validation errors for display
export function formatValidationError(error: ValidationError): string {
  return `${error.field}: ${error.message}`
}

// Collect validation errors from multiple fields
export function collectValidationErrors(
  validators: Array<() => void>,
): ValidationError[] {
  const errors: ValidationError[] = []

  for (const validator of validators) {
    try {
      validator()
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(error)
      }
    }
  }

  return errors
}

// Convert hex to decimal string for display
export function hexToDecimal(hexValue: string): string {
  if (!hexValue || !hexValue.startsWith('0x')) {
    return '0'
  }
  try {
    return BigInt(hexValue).toString()
  } catch {
    return '0'
  }
}

// Convert decimal string to hex for internal use
export function decimalToHex(decimalValue: string): string {
  if (!decimalValue || decimalValue === '0') {
    return '0x0'
  }
  try {
    const num = BigInt(decimalValue)
    return `0x${num.toString(16)}`
  } catch {
    return '0x0'
  }
}

// Check if a value is in hex format
export function isHexFormat(value: string): boolean {
  return value.startsWith('0x')
}

// Convert wei hex to ETH decimal for display
export function weiToEth(weiHex: string): string {
  if (!weiHex || !weiHex.startsWith('0x')) {
    return '0'
  }
  try {
    const wei = BigInt(weiHex)
    const eth = Number(wei) / 1e18
    return eth.toString()
  } catch {
    return '0'
  }
}

// Convert ETH decimal to wei hex
export function ethToWei(ethValue: string): string {
  if (!ethValue || ethValue === '0') {
    return '0x0'
  }
  try {
    const wei = Math.floor(parseFloat(ethValue) * 1e18)
    return `0x${wei.toString(16)}`
  } catch {
    return '0x0'
  }
}
