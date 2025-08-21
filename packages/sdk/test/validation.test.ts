/**
 * @fileoverview Test suite for validation utilities
 *
 * Comprehensive tests for validation functions and type guards
 * to ensure proper input validation throughout the SDK.
 */

import { describe, expect, it } from 'bun:test'
import { ValidationError } from '@sdk/core/errors'
import { TypeGuards, ValidationUtils } from '@sdk/utils/validation'

describe('ValidationUtils', () => {
  describe('validateAddress', () => {
    it('should validate correct EVM addresses', () => {
      const validAddresses = [
        '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        '0x0000000000000000000000000000000000000000',
        '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
      ]

      validAddresses.forEach((address) => {
        expect(() => ValidationUtils.isAddress(address)).not.toThrow()
      })
    })

    it('should reject invalid addresses', () => {
      const invalidAddresses = [
        '742d35Cc6634C0532925a3b844Bc9e7595f06e8c', // Missing 0x
        '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8', // Too short
        '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8cc', // Too long
        '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8G', // Invalid character
        '', // Empty
      ]

      invalidAddresses.forEach((address) => {
        expect(() => ValidationUtils.isAddress(address)).toThrow(
          ValidationError,
        )
      })
    })
  })

  describe('validateHexString', () => {
    it('should validate correct hex strings', () => {
      const validHexStrings = [
        '0x',
        '0x0',
        '0x00',
        '0xa9059cbb',
        '0xA9059CBB',
        '0x1234567890abcdef',
      ]

      validHexStrings.forEach((hex) => {
        expect(() => ValidationUtils.isHexString(hex)).not.toThrow()
      })
    })

    it('should reject invalid hex strings', () => {
      const invalidHexStrings = [
        'a9059cbb', // Missing 0x
        '0xa9059cbG', // Invalid character
        '0x ', // Space
        '', // Empty
      ]

      invalidHexStrings.forEach((hex) => {
        expect(() => ValidationUtils.isHexString(hex)).toThrow(ValidationError)
      })
    })
  })

  describe('validateBytes32', () => {
    it('should validate correct 32-byte hex strings', () => {
      const validBytes32 = [
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      ]

      validBytes32.forEach((bytes) => {
        expect(() => ValidationUtils.isValidBytes32(bytes)).not.toThrow()
      })
    })

    it('should reject invalid 32-byte hex strings', () => {
      const invalidBytes32 = [
        '0x123', // Too short
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef00', // Too long
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdeG', // Invalid character
        '', // Empty
      ]

      invalidBytes32.forEach((bytes) => {
        expect(() => ValidationUtils.isValidBytes32(bytes)).toThrow(
          ValidationError,
        )
      })
    })
  })

  describe('validateRequired', () => {
    it('should accept non-null/undefined values', () => {
      const validValues = ['string', 123, true, false, [], {}, 0, '']

      validValues.forEach((value) => {
        expect(() =>
          ValidationUtils.validateRequired(value, 'testField'),
        ).not.toThrow()
      })
    })

    it('should reject null/undefined values', () => {
      const invalidValues = [null, undefined]

      invalidValues.forEach((value) => {
        expect(() =>
          ValidationUtils.validateRequired(value, 'testField'),
        ).toThrow(ValidationError)
      })
    })
  })

  describe('validateNumberRange', () => {
    it('should accept numbers within range', () => {
      expect(() => ValidationUtils.validateNumberRange(5, 1, 10)).not.toThrow()
      expect(() => ValidationUtils.validateNumberRange(1, 1, 10)).not.toThrow()
      expect(() => ValidationUtils.validateNumberRange(10, 1, 10)).not.toThrow()
    })

    it('should reject numbers outside range', () => {
      expect(() => ValidationUtils.validateNumberRange(0, 1, 10)).toThrow(
        ValidationError,
      )
      expect(() => ValidationUtils.validateNumberRange(11, 1, 10)).toThrow(
        ValidationError,
      )
    })

    it('should reject non-numbers', () => {
      expect(() => ValidationUtils.validateNumberRange('5', 1, 10)).toThrow(
        ValidationError,
      )
      expect(() => ValidationUtils.validateNumberRange(null, 1, 10)).toThrow(
        ValidationError,
      )
    })

    it('should reject infinite numbers', () => {
      expect(() =>
        ValidationUtils.validateNumberRange(Number.POSITIVE_INFINITY, 1, 10),
      ).toThrow(ValidationError)
      expect(() =>
        ValidationUtils.validateNumberRange(Number.NaN, 1, 10),
      ).toThrow(ValidationError)
    })
  })

  describe('validatePositiveInteger', () => {
    it('should accept positive integers', () => {
      const validValues = [1, 2, 100, 1000000]

      validValues.forEach((value) => {
        expect(() =>
          ValidationUtils.validatePositiveInteger(value),
        ).not.toThrow()
      })
    })

    it('should reject non-positive integers', () => {
      const invalidValues = [0, -1, -100]

      invalidValues.forEach((value) => {
        expect(() => ValidationUtils.validatePositiveInteger(value)).toThrow(
          ValidationError,
        )
      })
    })

    it('should reject non-integers', () => {
      const invalidValues = [1.5, -1.5, 0.1]

      invalidValues.forEach((value) => {
        expect(() => ValidationUtils.validatePositiveInteger(value)).toThrow(
          ValidationError,
        )
      })
    })

    it('should reject non-numbers', () => {
      const invalidValues = ['1', null, undefined, true]

      invalidValues.forEach((value) => {
        expect(() => ValidationUtils.validatePositiveInteger(value)).toThrow(
          ValidationError,
        )
      })
    })
  })

  describe('validateNonNegativeInteger', () => {
    it('should accept non-negative integers', () => {
      const validValues = [0, 1, 2, 100]

      validValues.forEach((value) => {
        expect(() =>
          ValidationUtils.validateNonNegativeInteger(value),
        ).not.toThrow()
      })
    })

    it('should reject negative integers', () => {
      const invalidValues = [-1, -100]

      invalidValues.forEach((value) => {
        expect(() => ValidationUtils.validateNonNegativeInteger(value)).toThrow(
          ValidationError,
        )
      })
    })
  })

  describe('validateMinArrayLength', () => {
    it('should accept arrays with sufficient length', () => {
      expect(() =>
        ValidationUtils.validateMinArrayLength([1, 2, 3], 2),
      ).not.toThrow()
      expect(() =>
        ValidationUtils.validateMinArrayLength([1, 2], 2),
      ).not.toThrow()
    })

    it('should reject arrays that are too short', () => {
      expect(() => ValidationUtils.validateMinArrayLength([1], 2)).toThrow(
        ValidationError,
      )
      expect(() => ValidationUtils.validateMinArrayLength([], 1)).toThrow(
        ValidationError,
      )
    })

    it('should reject non-arrays', () => {
      expect(() =>
        ValidationUtils.validateMinArrayLength('not array', 1),
      ).toThrow(ValidationError)
    })
  })

  describe('validateGasAmount', () => {
    it('should validate reasonable gas amounts', () => {
      const validGasAmounts = [
        '0x5208', // 21,000
        '0xD6D8', // ~55,000
        '0x1C9C380', // 30,000,000
      ]

      validGasAmounts.forEach((gas) => {
        expect(() => ValidationUtils.validateGasAmount(gas)).not.toThrow()
      })
    })

    it('should reject zero or negative gas', () => {
      const invalidGasAmounts = ['0x0', '0x']

      invalidGasAmounts.forEach((gas) => {
        expect(() => ValidationUtils.validateGasAmount(gas)).toThrow(
          ValidationError,
        )
      })
    })

    it('should reject extremely high gas amounts', () => {
      expect(() => ValidationUtils.validateGasAmount('0x1C9C380000')) // Way too high
        .toThrow(ValidationError)
    })
  })

  describe('validateWeiAmount', () => {
    it('should validate wei amounts', () => {
      const validWeiAmounts = [
        '0x0',
        '0x1',
        '0xDE0B6B3A7640000', // 1 ETH in wei
      ]

      validWeiAmounts.forEach((wei) => {
        expect(() => ValidationUtils.validateWeiAmount(wei)).not.toThrow()
      })
    })

    it('should reject invalid wei amounts', () => {
      expect(() => ValidationUtils.validateWeiAmount('invalid')).toThrow(
        ValidationError,
      )
    })
  })

  describe('validateUrl', () => {
    it('should validate correct URLs', () => {
      const validUrls = [
        'https://api.altitrace.com/v1',
        'http://localhost:8080',
        'ws://example.com',
      ]

      validUrls.forEach((url) => {
        expect(() => ValidationUtils.validateUrl(url)).not.toThrow()
      })
    })

    it('should reject invalid URLs', () => {
      const invalidUrls = ['not-a-url', 'ftp://invalid-protocol', '', null]

      invalidUrls.forEach((url) => {
        expect(() => ValidationUtils.validateUrl(url)).toThrow(ValidationError)
      })
    })
  })

  describe('validateTimeout', () => {
    it('should validate reasonable timeout values', () => {
      const validTimeouts = [1000, 30000, 60000, 600000]

      validTimeouts.forEach((timeout) => {
        expect(() => ValidationUtils.validateTimeout(timeout)).not.toThrow()
      })
    })

    it('should reject invalid timeout values', () => {
      const invalidTimeouts = [0, -1000, 700000] // Too small, negative, too large

      invalidTimeouts.forEach((timeout) => {
        expect(() => ValidationUtils.validateTimeout(timeout)).toThrow(
          ValidationError,
        )
      })
    })
  })
})

describe('TypeGuards', () => {
  describe('isAddress', () => {
    it('should return true for valid addresses', () => {
      const validAddresses = [
        '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      ]

      validAddresses.forEach((address) => {
        expect(TypeGuards.isAddress(address)).toBe(true)
      })
    })

    it('should return false for invalid addresses', () => {
      const invalidAddresses = [
        '742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
        '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8',
        null,
        123,
      ]

      invalidAddresses.forEach((address) => {
        expect(TypeGuards.isAddress(address)).toBe(false)
      })
    })
  })

  describe('isHexString', () => {
    it('should return true for valid hex strings', () => {
      const validHexStrings = ['0x', '0x0', '0xa9059cbb', '0xA9059CBB']

      validHexStrings.forEach((hex) => {
        expect(TypeGuards.isHexString(hex)).toBe(true)
      })
    })

    it('should return false for invalid hex strings', () => {
      const invalidHexStrings = ['a9059cbb', '0xa9059cbG', null, 123]

      invalidHexStrings.forEach((hex) => {
        expect(TypeGuards.isHexString(hex)).toBe(false)
      })
    })
  })

  describe('isHexNumber', () => {
    it('should return true for valid hex numbers', () => {
      const validHexNumbers = ['0x0', '0x1', '0x123abc', '0xFFFF']

      validHexNumbers.forEach((hex) => {
        expect(TypeGuards.isHexNumber(hex)).toBe(true)
      })
    })

    it('should return false for invalid hex numbers', () => {
      const invalidHexNumbers = ['0x', '123abc', '0x123G', null, 123]

      invalidHexNumbers.forEach((hex) => {
        expect(TypeGuards.isHexNumber(hex)).toBe(false)
      })
    })
  })

  describe('isPositiveInteger', () => {
    it('should return true for positive integers', () => {
      const validValues = [1, 2, 100]

      validValues.forEach((value) => {
        expect(TypeGuards.isPositiveInteger(value)).toBe(true)
      })
    })

    it('should return false for non-positive integers', () => {
      const invalidValues = [0, -1, 1.5, '1', null]

      invalidValues.forEach((value) => {
        expect(TypeGuards.isPositiveInteger(value)).toBe(false)
      })
    })
  })

  describe('isNonNegativeInteger', () => {
    it('should return true for non-negative integers', () => {
      const validValues = [0, 1, 2, 100]

      validValues.forEach((value) => {
        expect(TypeGuards.isNonNegativeInteger(value)).toBe(true)
      })
    })

    it('should return false for negative numbers or non-integers', () => {
      const invalidValues = [-1, 1.5, '1', null]

      invalidValues.forEach((value) => {
        expect(TypeGuards.isNonNegativeInteger(value)).toBe(false)
      })
    })
  })

  describe('isNonEmptyString', () => {
    it('should return true for non-empty strings', () => {
      const validValues = ['hello', ' ', 'test string']

      validValues.forEach((value) => {
        expect(TypeGuards.isNonEmptyString(value)).toBe(true)
      })
    })

    it('should return false for empty strings or non-strings', () => {
      const invalidValues = ['', null, undefined, 123]

      invalidValues.forEach((value) => {
        expect(TypeGuards.isNonEmptyString(value)).toBe(false)
      })
    })
  })

  describe('isNonEmptyArray', () => {
    it('should return true for non-empty arrays', () => {
      const validValues = [[1], ['hello'], [1, 2, 3]]

      validValues.forEach((value) => {
        expect(TypeGuards.isNonEmptyArray(value)).toBe(true)
      })
    })

    it('should return false for empty arrays or non-arrays', () => {
      const invalidValues = [[], null, undefined, 'not array']

      invalidValues.forEach((value) => {
        expect(TypeGuards.isNonEmptyArray(value)).toBe(false)
      })
    })
  })
})
