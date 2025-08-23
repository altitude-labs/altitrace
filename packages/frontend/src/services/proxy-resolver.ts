import type { Address } from '@altitrace/sdk/types'

/**
 * Utility for resolving proxy implementation addresses when explorer APIs fail
 * This uses common proxy patterns to attempt to read implementation addresses
 */
export class ProxyResolver {
  // Common proxy implementation slot addresses
  private static readonly PROXY_SLOTS = {
    EIP1967_IMPLEMENTATION:
      '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
    EIP1967_BEACON:
      '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50',
    TRANSPARENT_ADMIN:
      '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103',
    UUPS_IMPLEMENTATION:
      '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
  }

  // Function signatures for proxy implementation getters
  private static readonly IMPLEMENTATION_GETTERS = {
    IMPLEMENTATION: '0x5c60da1b', // implementation()
    ADMIN: '0xf851a440', // admin()
    BEACON: '0x59659e90', // beacon()
  }

  /**
   * Attempt to resolve implementation address using various methods
   * Note: This would require RPC access in a real implementation
   * For now, this is a placeholder that could be enhanced with RPC integration
   */
  static async resolveImplementation(
    proxyAddress: Address,
    proxyType?:
      | 'eip1967'
      | 'transparent'
      | 'uups'
      | 'beacon'
      | 'minimal'
      | 'unknown',
  ): Promise<Address | null> {
    // In a full implementation, this would:
    // 1. Try reading from storage slots based on proxy type
    // 2. Try calling implementation() function
    // 3. Try calling admin() function for transparent proxies
    // 4. Try calling beacon() function for beacon proxies

    // For now, return null as we don't have RPC access
    // This could be enhanced to use the HyperEVM RPC when available
    console.log(
      `ProxyResolver: Would attempt to resolve implementation for ${proxyAddress} (type: ${proxyType})`,
    )
    return null
  }

  /**
   * Generate RPC calls that could be made to resolve implementation
   * Useful for debugging or manual resolution
   */
  static generateRpcCalls(proxyAddress: Address): Array<{
    method: string
    description: string
    call: {
      to: Address
      data: string
    }
  }> {
    return [
      {
        method: 'eth_getStorageAt',
        description: 'Read EIP-1967 implementation slot',
        call: {
          to: proxyAddress,
          data: ProxyResolver.PROXY_SLOTS.EIP1967_IMPLEMENTATION,
        },
      },
      {
        method: 'eth_call',
        description: 'Call implementation() function',
        call: {
          to: proxyAddress,
          data: ProxyResolver.IMPLEMENTATION_GETTERS.IMPLEMENTATION,
        },
      },
      {
        method: 'eth_call',
        description: 'Call admin() function',
        call: {
          to: proxyAddress,
          data: ProxyResolver.IMPLEMENTATION_GETTERS.ADMIN,
        },
      },
      {
        method: 'eth_call',
        description: 'Call beacon() function',
        call: {
          to: proxyAddress,
          data: ProxyResolver.IMPLEMENTATION_GETTERS.BEACON,
        },
      },
    ]
  }

  /**
   * Check if an address appears to be zero (common for uninitialized proxies)
   */
  static isZeroAddress(address: string): boolean {
    return (
      address === '0x0000000000000000000000000000000000000000' ||
      address === '0x' ||
      !address
    )
  }

  /**
   * Clean and validate an address returned from storage/function call
   */
  static cleanAddress(rawAddress: string): Address | null {
    if (!rawAddress || typeof rawAddress !== 'string') return null

    // Remove leading zeros and ensure proper format
    const cleaned = rawAddress.replace(/^0x0+/, '0x').toLowerCase()

    // Check if it's a valid non-zero address
    if (ProxyResolver.isZeroAddress(cleaned) || cleaned.length !== 42) {
      return null
    }

    return cleaned as Address
  }
}
