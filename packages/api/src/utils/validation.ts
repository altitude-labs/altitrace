import type { Hex } from '@/types/api';
import { isValidAddress, MAX_UINT_256 } from './helpers';

export class ValidationError extends Error {
  constructor(
    message: string, 
    public field: string, 
    public value: any, 
    public code: string = 'INVALID_PARAMETER'
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates and normalizes a hex string
 */
export function validateHex(value: string, fieldName: string = 'data'): Hex {
  if (typeof value !== 'string') {
    throw new ValidationError(
      `Parameter '${fieldName}' must be a string, received ${typeof value}`,
      fieldName,
      value,
      'INVALID_TYPE'
    );
  }
  
  if (!value.startsWith('0x')) {
    throw new ValidationError(
      `Parameter '${fieldName}' must start with '0x', received: ${value}`,
      fieldName,
      value,
      'INVALID_HEX_PREFIX'
    );
  }
  
  const hexPart = value.slice(2);
  if (!/^[a-fA-F0-9]*$/.test(hexPart)) {
    throw new ValidationError(
      `Parameter '${fieldName}' contains invalid hex characters. Must only contain 0-9, a-f, A-F after '0x'`,
      fieldName,
      value,
      'INVALID_HEX_CHARS'
    );
  }
  
  return value as Hex;
}

/**
 * Validates and normalizes a gas value (must be reasonable)
 */
export function validateGas(value: string, fieldName: string = 'gas'): Hex {
  try {
    const hex = validateHex(value, fieldName);
    const gasValue = BigInt(hex);
    
    const maxGas = MAX_UINT_256;
    if (gasValue > maxGas) {
      throw new ValidationError(
        `Parameter '${fieldName}' value ${gasValue.toString()} exceeds maximum allowed gas limit of ${maxGas.toString()}`,
        fieldName,
        value,
        'GAS_LIMIT_EXCEEDED'
      );
    }
    
    if (gasValue < 0n) {
      throw new ValidationError(
        `Parameter '${fieldName}' cannot be negative, received: ${gasValue.toString()}`,
        fieldName,
        value,
        'NEGATIVE_GAS'
      );
    }
    
    return hex;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(
      `Parameter '${fieldName}' is invalid: ${error instanceof Error ? error.message : 'Unknown error'}`,
      fieldName,
      value,
      'INVALID_GAS_FORMAT'
    );
  }
}

/**
 * Validates an Ethereum address
 */
export function validateAddress(value: string, fieldName: string = 'address'): string {
  if (typeof value !== 'string') {
    throw new ValidationError(
      `Parameter '${fieldName}' must be a string, received ${typeof value}`,
      fieldName,
      value,
      'INVALID_TYPE'
    );
  }
  
  if (!isValidAddress(value)) {
    throw new ValidationError(
      `Parameter '${fieldName}' must be a valid Ethereum address (0x followed by 40 hex characters), received: ${value}`,
      fieldName,
      value,
      'INVALID_ADDRESS_FORMAT'
    );
  }
  
  return value;
}

/**
 * Validates and normalizes a value (ETH amount)
 */
export function validateValue(value: string, fieldName: string = 'value'): Hex {
  try {
    const hex = validateHex(value, fieldName);
    const weiValue = BigInt(hex);
    
    if (weiValue < 0n) {
      throw new ValidationError(
        `Parameter '${fieldName}' cannot be negative, received: ${weiValue.toString()} wei`,
        fieldName,
        value,
        'NEGATIVE_VALUE'
      );
    }
    
    // Check if value is reasonable (max 1M ETH in wei)
    if (weiValue > MAX_UINT_256) {
      const ethAmount = Number(weiValue) / Number(BigInt('10') ** BigInt('18'));
      throw new ValidationError(
        `Parameter '${fieldName}' value ${ethAmount.toFixed(4)} ETH exceeds uint256 value ${MAX_UINT_256}`,
        fieldName,
        value,
        'VALUE_TOO_LARGE'
      );
    }
    
    return hex;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(
      `Parameter '${fieldName}' is invalid: ${error instanceof Error ? error.message : 'Unknown error'}`,
      fieldName,
      value,
      'INVALID_VALUE_FORMAT'
    );
  }
}

/**
 * Converts a bigint to hex string
 */
export function bigintToHex(value: bigint): Hex {
  return `0x${value.toString(16)}` as Hex;
}

/**
 * Safely converts hex to bigint with validation
 */
export function hexToBigint(hex: string): bigint {
  const validated = validateHex(hex);
  return BigInt(validated);
}

/**
 * Recursively converts BigInt values to hex strings in an object
 * This is needed for JSON serialization since JSON.stringify can't handle BigInt
 */
export function convertBigIntsToHex(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return bigintToHex(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntsToHex);
  }
  
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = convertBigIntsToHex(value);
    }
    return result;
  }
  
  return obj;
}

/**
 * Converts Viem's assetChanges format to API format
 * Handles the specific structure: { token: {...}, value: { pre: bigint, post: bigint, diff: bigint } }
 */
export function formatAssetChanges(assetChanges: readonly any[] | any[]): any[] {
  if (!assetChanges || !Array.isArray(assetChanges)) {
    return [];
  }
  
  return assetChanges.map(change => ({
    token: {
      address: change.token.address,
      ...(change.token.decimals !== undefined && { decimals: change.token.decimals }),
      ...(change.token.symbol !== undefined && { symbol: change.token.symbol }),
    },
    value: {
      pre: bigintToHex(change.value.pre),
      post: bigintToHex(change.value.post),
      diff: bigintToHex(change.value.diff),
    },
  }));
}