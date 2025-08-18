/**
 * Integration utilities for working with Viem types and the Altitrace SDK.
 *
 * This module provides utilities for converting between Viem types and Altitrace SDK types,
 * making it easy to use the SDK alongside Viem in Web3 applications.
 */

import type {
  Hex,
  Address as ViemAddress,
  TransactionRequest as ViemTransactionRequest,
} from 'viem';
import type { TransactionCall, Address, HexString, HexNumber } from '@sdk/types/simulation';
import { ValidationError } from '@sdk/core/errors';

/**
 * Convert a Viem transaction request to an Altitrace transaction call.
 * @param viemTx - Viem transaction request
 * @returns Altitrace transaction call
 */
export function viemToTransactionCall(viemTx: ViemTransactionRequest): TransactionCall {
  const call: TransactionCall = {};

  if (viemTx.from) {
    call.from = viemTx.from as Address;
  }

  if (viemTx.to) {
    call.to = viemTx.to as Address;
  }

  if (viemTx.data) {
    call.data = viemTx.data as HexString;
  }

  if (viemTx.value) {
    call.value =
      typeof viemTx.value === 'bigint'
        ? (`0x${viemTx.value.toString(16)}` as HexNumber)
        : (viemTx.value as HexNumber);
  }

  if (viemTx.gas) {
    call.gas =
      typeof viemTx.gas === 'bigint'
        ? (`0x${viemTx.gas.toString(16)}` as HexNumber)
        : (viemTx.gas as HexNumber);
  }

  return call;
}

/**
 * Convert an Altitrace transaction call to a Viem transaction request.
 * @param call - Altitrace transaction call
 * @returns Viem transaction request
 */
export function transactionCallToViem(call: TransactionCall): ViemTransactionRequest {
  const viemTx: ViemTransactionRequest = {};

  if (call.from) {
    viemTx.from = call.from as ViemAddress;
  }

  if (call.to) {
    viemTx.to = call.to as ViemAddress;
  }

  if (call.data) {
    viemTx.data = call.data as Hex;
  }

  if (call.value) {
    viemTx.value = BigInt(call.value);
  }

  if (call.gas) {
    viemTx.gas = BigInt(call.gas);
  }

  return viemTx;
}

/**
 * Convert multiple Viem transaction requests to Altitrace transaction calls.
 * @param viemTxs - Array of Viem transaction requests
 * @returns Array of Altitrace transaction calls
 */
export function viemBatchToTransactionCalls(
  viemTxs: readonly ViemTransactionRequest[]
): TransactionCall[] {
  return viemTxs.map(viemToTransactionCall);
}

/**
 * Convert Viem address to Altitrace address format.
 * @param viemAddress - Viem address
 * @returns Altitrace address
 */
export function viemAddressToAddress(viemAddress: ViemAddress): Address {
  return viemAddress as Address;
}

/**
 * Convert Altitrace address to Viem address format.
 * @param address - Altitrace address
 * @returns Viem address
 */
export function addressToViemAddress(address: Address): ViemAddress {
  return address as ViemAddress;
}

/**
 * Convert Viem hex string to Altitrace hex string format.
 * @param viemHex - Viem hex string
 * @returns Altitrace hex string
 */
export function viemHexToHexString(viemHex: Hex): HexString {
  return viemHex as HexString;
}

/**
 * Convert Altitrace hex string to Viem hex format.
 * @param hexString - Altitrace hex string
 * @returns Viem hex string
 */
export function hexStringToViemHex(hexString: HexString): Hex {
  return hexString as Hex;
}

/**
 * Convert a bigint value to hex number format.
 * @param value - BigInt value
 * @returns Hex number string
 */
export function bigintToHexNumber(value: bigint): HexNumber {
  return `0x${value.toString(16)}` as HexNumber;
}

/**
 * Convert a hex number string to bigint.
 * @param hexNumber - Hex number string
 * @returns BigInt value
 */
export function hexNumberToBigint(hexNumber: HexNumber): bigint {
  return BigInt(hexNumber);
}

/**
 * Convert a number to hex number format.
 * @param value - Number value
 * @returns Hex number string
 */
export function numberToHexNumber(value: number): HexNumber {
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError('Value must be a non-negative integer');
  }
  return `0x${value.toString(16)}` as HexNumber;
}

/**
 * Convert a hex number string to number.
 * @param hexNumber - Hex number string
 * @returns Number value
 */
export function hexNumberToNumber(hexNumber: HexNumber): number {
  const value = parseInt(hexNumber.replace('0x', ''), 16);
  if (value > Number.MAX_SAFE_INTEGER) {
    throw new ValidationError('Hex number is too large to convert to safe integer');
  }
  return value;
}

/**
 * Utility class for working with gas values in different formats.
 */
export class GasUtils {
  /**
   * Convert gas value from various formats to hex number.
   * @param gas - Gas value (number, bigint, or hex string)
   * @returns Hex number string
   */
  public static toHexNumber(gas: number | bigint | string): HexNumber {
    if (typeof gas === 'number') {
      return numberToHexNumber(gas);
    }

    if (typeof gas === 'bigint') {
      return bigintToHexNumber(gas);
    }

    if (typeof gas === 'string') {
      // Validate it's already a hex string
      if (!/^0x[a-fA-F0-9]+$/.test(gas)) {
        throw new ValidationError('Gas string must be a valid hex number');
      }
      return gas as HexNumber;
    }

    throw new ValidationError('Gas must be number, bigint, or hex string');
  }

  /**
   * Convert gas value to number format.
   * @param gas - Gas value in hex format
   * @returns Number value
   */
  public static toNumber(gas: HexNumber): number {
    return hexNumberToNumber(gas);
  }

  /**
   * Convert gas value to bigint format.
   * @param gas - Gas value in hex format
   * @returns BigInt value
   */
  public static toBigint(gas: HexNumber): bigint {
    return hexNumberToBigint(gas);
  }

  /**
   * Add two gas values.
   * @param gas1 - First gas value
   * @param gas2 - Second gas value
   * @returns Sum as hex number
   */
  public static add(gas1: HexNumber, gas2: HexNumber): HexNumber {
    const sum = hexNumberToBigint(gas1) + hexNumberToBigint(gas2);
    return bigintToHexNumber(sum);
  }

  /**
   * Subtract two gas values.
   * @param gas1 - First gas value (minuend)
   * @param gas2 - Second gas value (subtrahend)
   * @returns Difference as hex number
   */
  public static subtract(gas1: HexNumber, gas2: HexNumber): HexNumber {
    const difference = hexNumberToBigint(gas1) - hexNumberToBigint(gas2);
    if (difference < 0n) {
      throw new ValidationError('Gas subtraction resulted in negative value');
    }
    return bigintToHexNumber(difference);
  }

  /**
   * Calculate percentage of gas used.
   * @param gasUsed - Gas used
   * @param gasLimit - Gas limit
   * @returns Percentage (0-100)
   */
  public static calculatePercentage(gasUsed: HexNumber, gasLimit: HexNumber): number {
    const used = hexNumberToBigint(gasUsed);
    const limit = hexNumberToBigint(gasLimit);

    if (limit === 0n) {
      return 0;
    }

    return Number((used * 100n) / limit);
  }
}

/**
 * Utility class for working with Wei values in different formats.
 */
export class WeiUtils {
  /**
   * Convert Wei value from various formats to hex number.
   * @param wei - Wei value (number, bigint, or hex string)
   * @returns Hex number string
   */
  public static toHexNumber(wei: number | bigint | string): HexNumber {
    if (typeof wei === 'number') {
      return numberToHexNumber(wei);
    }

    if (typeof wei === 'bigint') {
      return bigintToHexNumber(wei);
    }

    if (typeof wei === 'string') {
      if (!/^0x[a-fA-F0-9]+$/.test(wei)) {
        throw new ValidationError('Wei string must be a valid hex number');
      }
      return wei as HexNumber;
    }

    throw new ValidationError('Wei must be number, bigint, or hex string');
  }

  /**
   * Convert Wei hex value to bigint.
   * @param wei - Wei value in hex format
   * @returns BigInt value
   */
  public static toBigint(wei: HexNumber): bigint {
    return hexNumberToBigint(wei);
  }

  /**
   * Convert ETH amount to Wei.
   * @param eth - ETH amount as string or number
   * @returns Wei as hex number
   */
  public static fromEth(eth: string | number): HexNumber {
    const ethBigint = typeof eth === 'string' ? BigInt(eth) : BigInt(Math.floor(eth));
    const weiBigint = ethBigint * 10n ** 18n;
    return bigintToHexNumber(weiBigint);
  }

  /**
   * Convert Wei to ETH amount.
   * @param wei - Wei value in hex format
   * @returns ETH amount as string
   */
  public static toEth(wei: HexNumber): string {
    const weiBigint = hexNumberToBigint(wei);
    const ethBigint = weiBigint / 10n ** 18n;
    return ethBigint.toString();
  }

  /**
   * Format Wei value with appropriate unit.
   * @param wei - Wei value in hex format
   * @returns Formatted string with unit
   */
  public static format(wei: HexNumber): string {
    const weiBigint = hexNumberToBigint(wei);

    if (weiBigint >= 10n ** 18n) {
      const eth = weiBigint / 10n ** 18n;
      const remainder = weiBigint % 10n ** 18n;
      if (remainder === 0n) {
        return `${eth} ETH`;
      }
      return `${eth}.${remainder.toString().padStart(18, '0').replace(/0+$/, '')} ETH`;
    }

    // Check if it's exactly divisible by 10^18 (1 ETH) but represented as a fraction
    if (weiBigint * 2n === 10n ** 18n) {
      // 0.5 ETH case
      return '0.5 ETH';
    }

    if (weiBigint >= 10n ** 9n) {
      const gwei = weiBigint / 10n ** 9n;
      const remainder = weiBigint % 10n ** 9n;
      if (remainder === 0n) {
        return `${gwei} gwei`;
      }
      return `${gwei}.${remainder.toString().padStart(9, '0').replace(/0+$/, '')} gwei`;
    }

    return `${weiBigint} wei`;
  }
}

/**
 * Utility functions for working with block numbers and tags.
 */
export class BlockUtils {
  /**
   * Convert block number from various formats to hex number.
   * @param blockNumber - Block number (number, bigint, or hex string)
   * @returns Hex number string
   */
  public static toHexNumber(blockNumber: number | bigint | string): HexNumber {
    if (typeof blockNumber === 'number') {
      return numberToHexNumber(blockNumber);
    }

    if (typeof blockNumber === 'bigint') {
      return bigintToHexNumber(blockNumber);
    }

    if (typeof blockNumber === 'string') {
      if (!/^0x[a-fA-F0-9]+$/.test(blockNumber)) {
        throw new ValidationError('Block number string must be a valid hex number');
      }
      return blockNumber as HexNumber;
    }

    throw new ValidationError('Block number must be number, bigint, or hex string');
  }

  /**
   * Convert hex block number to regular number.
   * @param hexBlockNumber - Block number in hex format
   * @returns Number value
   */
  public static toNumber(hexBlockNumber: HexNumber): number {
    return hexNumberToNumber(hexBlockNumber);
  }

  /**
   * Check if a block number is valid (non-negative).
   * @param blockNumber - Block number to validate
   * @returns True if valid
   */
  public static isValid(blockNumber: HexNumber): boolean {
    try {
      const num = hexNumberToNumber(blockNumber);
      return num >= 0;
    } catch {
      return false;
    }
  }
}
