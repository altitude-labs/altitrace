/**
 * @fileoverview Validation utilities
 */

import { ValidationError } from '@sdk/core/errors'

/**
 * Validation utilities for SDK inputs.
 */
export const ValidationUtils = {
  /**
   * Validate an EVM address.
   */
  isAddress(address: string): boolean {
    if (!this.isValidAddress(address)) {
      throw new ValidationError(`Invalid EVM address: ${address}`)
    }
    return true
  },

  /**
   * Validate a hex string.
   */
  isHexString(value: string): boolean {
    if (!this.isValidHexString(value)) {
      throw new ValidationError(`Invalid hex string: ${value}`)
    }
    return true
  },

  /**
   * Validate a 32-byte hex string.
   */
  isValidBytes32(value: string): boolean {
    if (!this.isValidBytes32String(value)) {
      throw new ValidationError(`Invalid 32-byte hex string: ${value}`)
    }
    return true
  },

  /**
   * Validate a transaction hash.
   */
  isTransactionHash(hash: string): boolean {
    if (!this.isValidTransactionHash(hash)) {
      throw new ValidationError(`Invalid transaction hash: ${hash}`)
    }
    return true
  },

  /**
   * Validate that a value is not null or undefined.
   */
  validateRequired(value: unknown, fieldName: string): void {
    if (value === null || value === undefined) {
      throw new ValidationError(`${fieldName} is required`)
    }
  },

  /**
   * Validate that a number is within a specified range.
   */
  validateNumberRange(value: unknown, min: number, max: number): void {
    if (typeof value !== 'number') {
      throw new ValidationError(`Value must be a number, got ${typeof value}`)
    }

    if (!Number.isFinite(value)) {
      throw new ValidationError('Value must be a finite number')
    }

    if (value < min || value > max) {
      throw new ValidationError(
        `Value must be between ${min} and ${max}, got ${value}`,
      )
    }
  },

  /**
   * Validate a positive integer.
   */
  validatePositiveInteger(value: unknown): void {
    if (typeof value !== 'number') {
      throw new ValidationError(`Value must be a number, got ${typeof value}`)
    }

    if (!Number.isInteger(value)) {
      throw new ValidationError(`Value must be an integer, got ${value}`)
    }

    if (value <= 0) {
      throw new ValidationError(`Value must be positive, got ${value}`)
    }
  },

  /**
   * Validate a non-negative integer.
   */
  validateNonNegativeInteger(value: unknown): void {
    if (typeof value !== 'number') {
      throw new ValidationError(`Value must be a number, got ${typeof value}`)
    }

    if (!Number.isInteger(value)) {
      throw new ValidationError(`Value must be an integer, got ${value}`)
    }

    if (value < 0) {
      throw new ValidationError(`Value must be non-negative, got ${value}`)
    }
  },

  /**
   * Validate minimum array length.
   */
  validateMinArrayLength(value: unknown, minLength: number): void {
    if (!Array.isArray(value)) {
      throw new ValidationError(`Value must be an array, got ${typeof value}`)
    }

    if (value.length < minLength) {
      throw new ValidationError(
        `Array must have at least ${minLength} items, got ${value.length}`,
      )
    }
  },

  /**
   * Validate a gas amount.
   */
  validateGasAmount(value: string): void {
    if (!this.isValidHexString(value)) {
      throw new ValidationError(`Invalid hex string for gas: ${value}`)
    }

    if (value === '0x' || value === '0x0') {
      throw new ValidationError('Gas amount must be greater than 0')
    }

    const gasNum = Number.parseInt(value, 16)
    if (gasNum > 30_000_000) {
      // Block gas limit
      throw new ValidationError(`Gas amount too high: ${value}`)
    }
  },

  /**
   * Validate a wei amount.
   */
  validateWeiAmount(value: string): void {
    if (!this.isValidHexString(value)) {
      throw new ValidationError(`Invalid hex string for wei: ${value}`)
    }
  },

  /**
   * Validate a URL.
   */
  validateUrl(value: unknown): void {
    if (typeof value !== 'string' || !value) {
      throw new ValidationError('URL must be a non-empty string')
    }

    try {
      const url = new URL(value)
      if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) {
        throw new ValidationError(
          'URL must use http, https, ws, or wss protocol',
        )
      }
    } catch {
      throw new ValidationError(`Invalid URL: ${value}`)
    }
  },

  /**
   * Validate a timeout value.
   */
  validateTimeout(value: unknown): void {
    if (typeof value !== 'number') {
      throw new ValidationError(`Timeout must be a number, got ${typeof value}`)
    }

    if (value <= 0) {
      throw new ValidationError(`Timeout must be positive, got ${value}`)
    }

    if (value > 600_000) {
      // 10 minutes
      throw new ValidationError(`Timeout too large, got ${value}ms`)
    }
  },

  // Helper methods that don't throw
  isValidAddress(address: string): boolean {
    return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address)
  },

  isValidHexString(value: string): boolean {
    return typeof value === 'string' && /^0x[a-fA-F0-9]*$/.test(value)
  },

  isValidBytes32String(value: string): boolean {
    return typeof value === 'string' && /^0x[a-fA-F0-9]{64}$/.test(value)
  },

  isValidTransactionHash(hash: string): boolean {
    return typeof hash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(hash)
  },
}

/**
 * Type guard utilities.
 */
export const TypeGuards = {
  isString(value: unknown): value is string {
    return typeof value === 'string'
  },

  isNumber(value: unknown): value is number {
    return typeof value === 'number'
  },

  /**
   * Check if a value is a valid EVM address.
   */
  isAddress(value: unknown): value is string {
    return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value)
  },

  /**
   * Check if a value is a valid hex string.
   */
  isHexString(value: unknown): value is string {
    return typeof value === 'string' && /^0x[a-fA-F0-9]*$/.test(value)
  },

  /**
   * Check if a value is a valid hex number (non-empty hex).
   */
  isHexNumber(value: unknown): value is string {
    return typeof value === 'string' && /^0x[a-fA-F0-9]+$/.test(value)
  },

  /**
   * Check if a value is a positive integer.
   */
  isPositiveInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0
  },

  /**
   * Check if a value is a non-negative integer.
   */
  isNonNegativeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0
  },

  /**
   * Check if a value is a non-empty string.
   */
  isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0
  },

  /**
   * Check if a value is a non-empty array.
   */
  isNonEmptyArray<T>(value: unknown): value is T[] {
    return Array.isArray(value) && value.length > 0
  },

  /**
   * Check if a value is a valid transaction hash.
   */
  isTransactionHash(value: unknown): value is string {
    return typeof value === 'string' && /^0x[a-fA-F0-9]{64}$/.test(value)
  },
}
