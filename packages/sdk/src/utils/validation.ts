/**
 * @fileoverview Validation utilities
 */

import { ValidationError } from '@sdk/core/errors';

/**
 * Validation utilities for SDK inputs.
 */
export class ValidationUtils {
  /**
   * Validate an Ethereum address.
   */
  static isAddress(address: string): boolean {
    if (!this.isValidAddress(address)) {
      throw new ValidationError(`Invalid Ethereum address: ${address}`);
    }
    return true;
  }

  /**
   * Validate a hex string.
   */
  static isHexString(value: string): boolean {
    if (!this.isValidHexString(value)) {
      throw new ValidationError(`Invalid hex string: ${value}`);
    }
    return true;
  }

  /**
   * Validate a 32-byte hex string.
   */
  static isValidBytes32(value: string): boolean {
    if (!this.isValidBytes32String(value)) {
      throw new ValidationError(`Invalid 32-byte hex string: ${value}`);
    }
    return true;
  }

  /**
   * Validate that a value is not null or undefined.
   */
  static validateRequired(value: unknown, fieldName: string): void {
    if (value === null || value === undefined) {
      throw new ValidationError(`${fieldName} is required`);
    }
  }

  /**
   * Validate that a number is within a specified range.
   */
  static validateNumberRange(value: unknown, min: number, max: number): void {
    if (typeof value !== 'number') {
      throw new ValidationError(`Value must be a number, got ${typeof value}`);
    }

    if (!Number.isFinite(value)) {
      throw new ValidationError(`Value must be a finite number`);
    }

    if (value < min || value > max) {
      throw new ValidationError(`Value must be between ${min} and ${max}, got ${value}`);
    }
  }

  /**
   * Validate a positive integer.
   */
  static validatePositiveInteger(value: unknown): void {
    if (typeof value !== 'number') {
      throw new ValidationError(`Value must be a number, got ${typeof value}`);
    }

    if (!Number.isInteger(value)) {
      throw new ValidationError(`Value must be an integer, got ${value}`);
    }

    if (value <= 0) {
      throw new ValidationError(`Value must be positive, got ${value}`);
    }
  }

  /**
   * Validate a non-negative integer.
   */
  static validateNonNegativeInteger(value: unknown): void {
    if (typeof value !== 'number') {
      throw new ValidationError(`Value must be a number, got ${typeof value}`);
    }

    if (!Number.isInteger(value)) {
      throw new ValidationError(`Value must be an integer, got ${value}`);
    }

    if (value < 0) {
      throw new ValidationError(`Value must be non-negative, got ${value}`);
    }
  }

  /**
   * Validate minimum array length.
   */
  static validateMinArrayLength(value: unknown, minLength: number): void {
    if (!Array.isArray(value)) {
      throw new ValidationError(`Value must be an array, got ${typeof value}`);
    }

    if (value.length < minLength) {
      throw new ValidationError(`Array must have at least ${minLength} items, got ${value.length}`);
    }
  }

  /**
   * Validate a gas amount.
   */
  static validateGasAmount(value: string): void {
    if (!this.isValidHexString(value)) {
      throw new ValidationError(`Invalid hex string for gas: ${value}`);
    }

    if (value === '0x' || value === '0x0') {
      throw new ValidationError(`Gas amount must be greater than 0`);
    }

    const gasNum = parseInt(value, 16);
    if (gasNum > 30_000_000) {
      // Block gas limit
      throw new ValidationError(`Gas amount too high: ${value}`);
    }
  }

  /**
   * Validate a wei amount.
   */
  static validateWeiAmount(value: string): void {
    if (!this.isValidHexString(value)) {
      throw new ValidationError(`Invalid hex string for wei: ${value}`);
    }
  }

  /**
   * Validate a URL.
   */
  static validateUrl(value: unknown): void {
    if (typeof value !== 'string' || !value) {
      throw new ValidationError(`URL must be a non-empty string`);
    }

    try {
      const url = new URL(value);
      if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) {
        throw new ValidationError(`URL must use http, https, ws, or wss protocol`);
      }
    } catch {
      throw new ValidationError(`Invalid URL: ${value}`);
    }
  }

  /**
   * Validate a timeout value.
   */
  static validateTimeout(value: unknown): void {
    if (typeof value !== 'number') {
      throw new ValidationError(`Timeout must be a number, got ${typeof value}`);
    }

    if (value <= 0) {
      throw new ValidationError(`Timeout must be positive, got ${value}`);
    }

    if (value > 600_000) {
      // 10 minutes
      throw new ValidationError(`Timeout too large, got ${value}ms`);
    }
  }

  // Helper methods that don't throw
  private static isValidAddress(address: string): boolean {
    return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  private static isValidHexString(value: string): boolean {
    return typeof value === 'string' && /^0x[a-fA-F0-9]*$/.test(value);
  }

  private static isValidBytes32String(value: string): boolean {
    return typeof value === 'string' && /^0x[a-fA-F0-9]{64}$/.test(value);
  }
}

/**
 * Type guard utilities.
 */
export class TypeGuards {
  static isString(value: unknown): value is string {
    return typeof value === 'string';
  }

  static isNumber(value: unknown): value is number {
    return typeof value === 'number';
  }

  /**
   * Check if a value is a valid Ethereum address.
   */
  static isAddress(value: unknown): value is string {
    return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);
  }

  /**
   * Check if a value is a valid hex string.
   */
  static isHexString(value: unknown): value is string {
    return typeof value === 'string' && /^0x[a-fA-F0-9]*$/.test(value);
  }

  /**
   * Check if a value is a valid hex number (non-empty hex).
   */
  static isHexNumber(value: unknown): value is string {
    return typeof value === 'string' && /^0x[a-fA-F0-9]+$/.test(value);
  }

  /**
   * Check if a value is a positive integer.
   */
  static isPositiveInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
  }

  /**
   * Check if a value is a non-negative integer.
   */
  static isNonNegativeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
  }

  /**
   * Check if a value is a non-empty string.
   */
  static isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
  }

  /**
   * Check if a value is a non-empty array.
   */
  static isNonEmptyArray<T>(value: unknown): value is T[] {
    return Array.isArray(value) && value.length > 0;
  }
}
