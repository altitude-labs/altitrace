import {
  encodeFunctionData,
  type Abi,
  isAddress,
  isHex,
  parseUnits,
  formatUnits,
} from 'viem';
import type { HexString as Hex, Address } from '@altitrace/sdk';
import { AbiFunction, AbiParameter, ParsedAbi } from '@/types/api';

export class AbiError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'AbiError';
  }
}

// Parse ABI JSON and extract functions
export function parseAbiJson(abiJson: string): ParsedAbi {
  try {
    const abi = JSON.parse(abiJson);

    if (!Array.isArray(abi)) {
      throw new AbiError('ABI must be an array');
    }

    const functions = abi
      .filter((item) => item.type === 'function')
      .map((item): AbiFunction => ({
        name: item.name,
        type: item.type,
        inputs: item.inputs || [],
        outputs: item.outputs || [],
        stateMutability: item.stateMutability || 'nonpayable',
      }));

    const events = abi.filter((item) => item.type === 'event');
    const errors = abi.filter((item) => item.type === 'error');

    return {
      functions,
      events,
      errors,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new AbiError('Invalid JSON format');
    }
    throw error instanceof AbiError ? error : new AbiError('Failed to parse ABI');
  }
}

// Get function signature for display
export function getFunctionSignature(func: AbiFunction): string {
  const inputs = func.inputs
    .map((input) => `${input.type}${input.name ? ` ${input.name}` : ''}`)
    .join(', ');
  return `${func.name}(${inputs})`;
}

// Validate parameter value based on type
export function validateParameter(value: string, type: string, name: string): string | null {
  if (!value.trim()) {
    return `${name} is required`;
  }

  try {
    // Address validation
    if (type === 'address') {
      if (!isAddress(value)) {
        return `${name} must be a valid address`;
      }
      return null;
    }

    // Boolean validation
    if (type === 'bool') {
      if (value !== 'true' && value !== 'false') {
        return `${name} must be 'true' or 'false'`;
      }
      return null;
    }

    // String validation
    if (type === 'string') {
      return null; // Any string is valid
    }

    // Bytes validation
    if (type.startsWith('bytes')) {
      if (!isHex(value)) {
        return `${name} must be hex format (0x...)`;
      }

      // For fixed-size bytes (bytes32, bytes4, etc.)
      const match = type.match(/^bytes(\d+)$/);
      if (match) {
        const size = parseInt(match[1]);
        const expectedLength = 2 + size * 2; // 0x + 2 chars per byte
        if (value.length !== expectedLength) {
          return `${name} must be exactly ${size} bytes (${expectedLength} characters including 0x)`;
        }
      }
      return null;
    }

    // Integer validation (uint, int)
    if (type.match(/^u?int(\d+)?$/)) {
      const isUnsigned = type.startsWith('uint');
      const bits = type.match(/\d+/)?.[0];
      const bitSize = bits ? parseInt(bits) : 256;

      try {
        const num = BigInt(value);

        if (isUnsigned && num < 0n) {
          return `${name} must be non-negative for ${type}`;
        }

        const maxValue = isUnsigned
          ? 2n ** BigInt(bitSize) - 1n
          : 2n ** (BigInt(bitSize) - 1n) - 1n;
        const minValue = isUnsigned
          ? 0n
          : -(2n ** (BigInt(bitSize) - 1n));

        if (num > maxValue || num < minValue) {
          return `${name} out of range for ${type}`;
        }

        return null;
      } catch {
        return `${name} must be a valid integer`;
      }
    }

    // Array validation
    if (type.endsWith('[]')) {
      try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
          return `${name} must be a valid JSON array`;
        }
        return null;
      } catch {
        return `${name} must be a valid JSON array`;
      }
    }

    // For other types, just check if it's not empty
    return null;
  } catch {
    return `Invalid value for ${name}`;
  }
}

// Convert parameter value to the correct type for encoding
export function convertParameterValue(value: string, type: string): unknown {
  if (!value.trim()) {
    throw new Error('Value cannot be empty');
  }

  // Address
  if (type === 'address') {
    return value as Address;
  }

  // Boolean  
  if (type === 'bool') {
    return value === 'true';
  }

  // String
  if (type === 'string') {
    return value;
  }

  // Bytes
  if (type.startsWith('bytes')) {
    return value as Hex;
  }

  // Integer types
  if (type.match(/^u?int(\d+)?$/)) {
    return BigInt(value);
  }

  // Arrays
  if (type.endsWith('[]')) {
    try {
      const arr = JSON.parse(value);
      return Array.isArray(arr) ? (arr as unknown[]) : [arr];
    } catch {
      return value;
    }
  }

  // Default: return as string
  return value;
}

// Encode function call data
export function encodeFunctionCall(
  abi: Abi,
  functionName: string,
  parameters: Record<string, string>
): Hex {
  try {
    // Find the function in the ABI
    const func = (abi as ReadonlyArray<{ type?: string; name?: string; inputs?: AbiParameter[] }>).find(
      (item) => item?.type === 'function' && item?.name === functionName
    );

    if (!func) {
      throw new AbiError(`Function ${functionName} not found in ABI`);
    }

    // Convert parameter values to correct types
    const args = (func as unknown as { inputs: AbiParameter[] }).inputs.map((input: AbiParameter) => {
      const value = parameters[input.name];
      if (value === undefined || value === '') {
        throw new AbiError(`Missing value for parameter ${input.name}`);
      }
      return convertParameterValue(value, input.type);
    });

    // Encode the function data
    return encodeFunctionData({
      abi,
      functionName,
      args,
    });
  } catch (error) {
    if (error instanceof AbiError) {
      throw error;
    }
    throw new AbiError(`Failed to encode function call: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Parse ABI from string and return viem-compatible format
export function parseAbiString(abiJson: string): Abi {
  try {
    const abi = JSON.parse(abiJson);
    return abi as Abi;
  } catch {
    throw new AbiError('Invalid ABI JSON format');
  }
}

// Format wei values for display
export function formatWeiValue(wei: string, decimals = 18): string {
  try {
    return formatUnits(BigInt(wei), decimals);
  } catch {
    return wei;
  }
}

// Parse ether values to wei
export function parseEtherValue(ether: string): string {
  try {
    return parseUnits(ether, 18).toString();
  } catch {
    throw new Error('Invalid HYPE value');
  }
}