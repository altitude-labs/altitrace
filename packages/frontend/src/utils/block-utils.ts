/**
 * @fileoverview Block utilities for dual block architecture
 */

/**
 * Block size thresholds for HyperEVM dual architecture
 */
export const BLOCK_SIZE_THRESHOLDS = {
  BIG_BLOCK_GAS_LIMIT: 50_000_000, // 50M gas limit
  SMALL_BLOCK_GAS_LIMIT: 2_000_000, // 2M gas limit
} as const

/**
 * Block size type
 */
export type BlockSize = 'big' | 'small' | 'unknown'

/**
 * Detect block size based on gas limit
 * @param gasLimit - Block gas limit (can be hex string, number, or bigint)
 * @returns Block size type
 */
export function detectBlockSize(
  gasLimit: string | number | bigint | null | undefined,
): BlockSize {
  if (!gasLimit) return 'unknown'

  let gasLimitNum: number

  try {
    if (typeof gasLimit === 'string') {
      gasLimitNum = gasLimit.startsWith('0x')
        ? parseInt(gasLimit, 16)
        : parseInt(gasLimit, 10)
    } else if (typeof gasLimit === 'bigint') {
      gasLimitNum = Number(gasLimit)
    } else {
      gasLimitNum = gasLimit
    }

    if (isNaN(gasLimitNum)) return 'unknown'

    // Check if it's close to our known block sizes (with some tolerance)
    const tolerance = 1_000_000 // 1M gas tolerance

    if (
      Math.abs(gasLimitNum - BLOCK_SIZE_THRESHOLDS.BIG_BLOCK_GAS_LIMIT) <=
      tolerance
    ) {
      return 'big'
    }

    if (
      Math.abs(gasLimitNum - BLOCK_SIZE_THRESHOLDS.SMALL_BLOCK_GAS_LIMIT) <=
      tolerance
    ) {
      return 'small'
    }

    // If closer to big block threshold, consider it big
    if (
      gasLimitNum >
      (BLOCK_SIZE_THRESHOLDS.SMALL_BLOCK_GAS_LIMIT +
        BLOCK_SIZE_THRESHOLDS.BIG_BLOCK_GAS_LIMIT) /
        2
    ) {
      return 'big'
    }

    return 'small'
  } catch (error) {
    console.warn('Failed to parse gas limit:', gasLimit, error)
    return 'unknown'
  }
}

/**
 * Get block size display label
 */
export function getBlockSizeLabel(blockSize: BlockSize): string {
  switch (blockSize) {
    case 'big':
      return 'Big Block'
    case 'small':
      return 'Small Block'
    default:
      return 'Unknown'
  }
}

/**
 * Get block size badge variant
 */
export function getBlockSizeBadgeVariant(
  blockSize: BlockSize,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (blockSize) {
    case 'big':
      return 'default'
    case 'small':
      return 'secondary'
    default:
      return 'outline'
  }
}

/**
 * Create block override for transforming to big block
 */
export function createBigBlockOverride() {
  return {
    gasLimit: BLOCK_SIZE_THRESHOLDS.BIG_BLOCK_GAS_LIMIT,
  }
}

/**
 * Extract gas limit from simulation result or request
 */
export function extractGasLimit(data: any): number | null {
  // Try different possible locations for gas limit
  const possiblePaths = [
    data?.gasLimit,
    data?.blockOverrides?.gasLimit,
    data?.blockOverrides?.gas_limit,
    data?.options?.blockOverrides?.gasLimit,
    data?.options?.blockOverrides?.gas_limit,
    data?.request?.options?.blockOverrides?.gasLimit,
    data?.request?.blockOverrides?.gasLimit,
  ]

  for (const gasLimit of possiblePaths) {
    if (gasLimit != null) {
      return typeof gasLimit === 'number'
        ? gasLimit
        : parseInt(
            gasLimit.toString(),
            gasLimit.toString().startsWith('0x') ? 16 : 10,
          )
    }
  }

  return null
}
