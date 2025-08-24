/**
 * Utilities for extracting and using token symbols from asset tracking data
 */

export interface TokenInfo {
  address: string
  symbol?: string | null
  name?: string | null
  decimals?: number | null
}

/**
 * Extract token information map from asset changes data
 */
export function extractTokenInfoFromAssetChanges(
  assetChanges: any[],
): Map<string, TokenInfo> {
  const tokenMap = new Map<string, TokenInfo>()

  if (!assetChanges || assetChanges.length === 0) {
    return tokenMap
  }

  for (const change of assetChanges) {
    const tokenAddress = change.token?.address || change.address
    if (tokenAddress) {
      tokenMap.set(tokenAddress.toLowerCase(), {
        address: tokenAddress,
        symbol: change.token?.symbol || change.symbol,
        name: change.token?.name || change.name,
        decimals: change.token?.decimals || change.decimals,
      })
    }
  }

  return tokenMap
}

/**
 * Get enhanced display name for a contract address using token info
 */
export function getEnhancedAddressDisplay(
  address: string,
  tokenMap: Map<string, TokenInfo>,
  options: {
    showSymbolFirst?: boolean
    showAddressTruncated?: boolean
    fallbackFormat?: 'full' | 'truncated'
  } = {},
): {
  primary: string
  secondary?: string
  isToken: boolean
  tokenInfo?: TokenInfo
} {
  const {
    showSymbolFirst = true,
    showAddressTruncated = true,
    fallbackFormat = 'truncated',
  } = options

  const tokenInfo = tokenMap.get(address.toLowerCase())
  const isToken = !!tokenInfo

  // Handle HYPE (native token) special case
  const isHYPE = address === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  if (isHYPE) {
    return {
      primary: 'HYPE',
      secondary: 'Native Token',
      isToken: true,
      tokenInfo: { address, symbol: 'HYPE', name: 'HyperEVM Native Token' },
    }
  }

  // If we have token info, show symbol prominently
  if (isToken && tokenInfo?.symbol && tokenInfo.symbol !== 'null') {
    if (showSymbolFirst) {
      return {
        primary: tokenInfo.symbol,
        secondary: showAddressTruncated
          ? `${address.slice(0, 6)}...${address.slice(-4)}`
          : address,
        isToken: true,
        tokenInfo,
      }
    } else {
      return {
        primary: showAddressTruncated
          ? `${address.slice(0, 6)}...${address.slice(-4)}`
          : address,
        secondary: tokenInfo.symbol,
        isToken: true,
        tokenInfo,
      }
    }
  }

  // Fallback for non-token addresses
  const displayAddress =
    fallbackFormat === 'truncated'
      ? `${address.slice(0, 6)}...${address.slice(-4)}`
      : address

  return {
    primary: displayAddress,
    isToken: false,
  }
}

/**
 * Format token amount using decimals from token info
 */
export function formatTokenAmount(
  amount: string | bigint,
  tokenInfo?: TokenInfo,
  options: {
    maxDecimals?: number
    showSymbol?: boolean
  } = {},
): string {
  const { maxDecimals = 6, showSymbol = false } = options

  if (!amount || amount === '0') {
    const formatted = '0'
    return showSymbol && tokenInfo?.symbol
      ? `${formatted} ${tokenInfo.symbol}`
      : formatted
  }

  try {
    const value = typeof amount === 'bigint' ? amount : BigInt(amount)
    const decimals = tokenInfo?.decimals || 18

    if (decimals && decimals > 0) {
      const divisor = BigInt(10 ** decimals)
      const wholePart = value / divisor
      const fractionalPart = value % divisor

      if (fractionalPart === 0n) {
        const formatted = wholePart.toString()
        return showSymbol && tokenInfo?.symbol
          ? `${formatted} ${tokenInfo.symbol}`
          : formatted
      } else {
        const fractionalStr = fractionalPart.toString().padStart(decimals, '0')
        // Limit decimal places and remove trailing zeros
        const trimmed = fractionalStr.slice(0, maxDecimals).replace(/0+$/, '')
        const formatted = trimmed
          ? `${wholePart}.${trimmed}`
          : wholePart.toString()
        return showSymbol && tokenInfo?.symbol
          ? `${formatted} ${tokenInfo.symbol}`
          : formatted
      }
    }

    const formatted = value.toString()
    return showSymbol && tokenInfo?.symbol
      ? `${formatted} ${tokenInfo.symbol}`
      : formatted
  } catch (error) {
    const formatted = amount.toString()
    return showSymbol && tokenInfo?.symbol
      ? `${formatted} ${tokenInfo.symbol}`
      : formatted
  }
}
