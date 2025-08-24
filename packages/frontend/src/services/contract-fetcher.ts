import type { Address } from '@altitrace/sdk/types'
import type { Abi } from 'viem'
import { isAddress } from 'viem'

export interface ContractFetchResult {
  address: Address
  name: string
  abi: Abi
  sourceCode?: string
  constructorArgs?: string
  compiler?: string
  version?: string
  verified: boolean
  explorerSource: 'etherscan' | 'hyperscan'
  // Enhanced compiler/source information
  language?: 'solidity' | 'vyper' | 'yul'
  compilerSettings?: {
    optimization?: { enabled: boolean; runs: number }
    evmVersion?: string
    compilationTarget?: Record<string, string>
    libraries?: Record<string, string>
    remappings?: string[]
  }
  additionalSources?: Array<{
    filePath: string
    sourceCode: string
  }>
  filePath?: string
  // Proxy information
  isProxy?: boolean
  implementationAddress?: Address
  implementationName?: string
  proxyType?:
  | 'eip1967'
  | 'transparent'
  | 'uups'
  | 'beacon'
  | 'minimal'
  | 'unknown'
  combinedAbi?: Abi // Proxy + Implementation ABIs combined
}

export interface ExplorerApiConfig {
  name: 'etherscan' | 'hyperscan'
  baseUrl: string
  requiresApiKey: boolean
}

export class ContractFetchError extends Error {
  constructor(
    message: string,
    public source: 'etherscan' | 'hyperscan',
    public statusCode?: number,
    public isUnverified = false,
  ) {
    super(message)
    this.name = 'ContractFetchError'
  }
}

export class ContractNotVerifiedError extends ContractFetchError {
  constructor() {
    super(
      'Contract is not verified on HyperScan or Etherscan. Unable to fetch ABI and source code.',
      'etherscan', // Last tried source
      undefined,
      true,
    )
    this.name = 'ContractNotVerifiedError'
  }
}

export class ContractFetcher {
  private static readonly APIS: Record<string, ExplorerApiConfig> = {
    etherscan: {
      name: 'etherscan',
      baseUrl: 'https://api.etherscan.io/v2/api',
      requiresApiKey: true,
    },
    hyperscan: {
      name: 'hyperscan',
      baseUrl: 'https://www.hyperscan.com/api/v2',
      requiresApiKey: false,
    },
  }

  /**
   * Build Etherscan API URL with required parameters
   */
  private static buildEtherscanUrl(params: Record<string, string>): string {
    const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY
    if (!apiKey) {
      throw new ContractFetchError(
        'NEXT_PUBLIC_ETHERSCAN_API_KEY environment variable is required',
        'etherscan',
      )
    }

    const urlParams = new URLSearchParams({
      ...params,
      chainid: '999',
      apikey: apiKey,
    })

    return `${ContractFetcher.APIS.etherscan.baseUrl}?${urlParams.toString()}`
  }

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

  // Common proxy function signatures for detection
  private static readonly PROXY_SIGNATURES = new Set([
    'implementation()', // EIP-1967, UUPS
    'admin()', // Transparent proxy
    'proxyAdmin()', // Some transparent proxies
    'beacon()', // Beacon proxy
    'upgradeTo(address)', // UUPS
    'upgradeToAndCall(address,bytes)', // UUPS
    'changeAdmin(address)', // Transparent proxy
  ])

  /**
   * Validate if a string is a valid Ethereum address
   */
  static validateAddress(address: string): boolean {
    return isAddress(address)
  }

  /**
   * Detect if a contract appears to be a proxy based on its ABI
   */
  private static detectProxyFromAbi(abi: Abi): {
    isProxy: boolean
    proxyType?: ContractFetchResult['proxyType']
  } {
    const functionNames = abi
      .filter((item: any) => item.type === 'function')
      .map((item: any) => {
        const inputs =
          item.inputs?.map((input: any) => input.type).join(',') || ''
        return inputs ? `${item.name}(${inputs})` : `${item.name}()`
      })

    const hasProxyFunction = functionNames.some((name) =>
      ContractFetcher.PROXY_SIGNATURES.has(name),
    )

    if (!hasProxyFunction) {
      return { isProxy: false }
    }

    // Determine proxy type based on available functions
    if (functionNames.includes('implementation()')) {
      if (functionNames.includes('upgradeTo(address)')) {
        return { isProxy: true, proxyType: 'uups' }
      }
      return { isProxy: true, proxyType: 'eip1967' }
    }

    if (
      functionNames.includes('admin()') ||
      functionNames.includes('proxyAdmin()')
    ) {
      return { isProxy: true, proxyType: 'transparent' }
    }

    if (functionNames.includes('beacon()')) {
      return { isProxy: true, proxyType: 'beacon' }
    }

    return { isProxy: true, proxyType: 'unknown' }
  }

  /**
   * Attempt to resolve implementation address from explorer API
   */
  private static async getImplementationFromExplorer(
    address: Address,
    source: 'etherscan' | 'hyperscan',
  ): Promise<Address | null> {
    try {
      if (source === 'etherscan') {
        // Etherscan has a specific API for proxy contracts
        const url = ContractFetcher.buildEtherscanUrl({
          module: 'contract',
          action: 'getabi',
          address,
        })
        const response = await fetch(url)

        if (response.ok) {
          const data = await response.json()
          // Check if response indicates this is a proxy
          if (
            data.result &&
            typeof data.result === 'string' &&
            data.result.includes('Proxy')
          ) {
            // Try to extract implementation address from response
            const implMatch = data.result.match(/0x[a-fA-F0-9]{40}/)
            if (implMatch) {
              return implMatch[0] as Address
            }
          }
        }
      } else {
        // HyperScan might have proxy information in the contract details
        const response = await fetch(
          `${ContractFetcher.APIS.hyperscan.baseUrl}/smart-contracts/${address}`,
        )

        if (response.ok) {
          const data = await response.json()
          if (data.implementation_address) {
            return data.implementation_address as Address
          }
          if (data.proxy?.implementation) {
            return data.proxy.implementation as Address
          }
        }
      }
    } catch (_error) { }

    return null
  }

  /**
   * Combine proxy and implementation ABIs
   */
  private static combineAbis(proxyAbi: Abi, implementationAbi: Abi): Abi {
    const combined = [...implementationAbi]

    // Add proxy-specific functions that aren't in implementation
    const implementationFunctionNames = new Set(
      implementationAbi
        .filter((item: any) => item.type === 'function')
        .map((item: any) => item.name),
    )

    for (const item of proxyAbi) {
      if (
        item.type === 'function' &&
        !implementationFunctionNames.has((item as any).name)
      ) {
        // Only add proxy functions that might be useful (skip internal ones)
        const functionName = (item as any).name
        if (
          ContractFetcher.PROXY_SIGNATURES.has(`${functionName}()`) ||
          ContractFetcher.PROXY_SIGNATURES.has(`${functionName}(address)`) ||
          ContractFetcher.PROXY_SIGNATURES.has(`${functionName}(address,bytes)`)
        ) {
          combined.push(item)
        }
      }
    }

    return combined as Abi
  }

  /**
   * Fetch contract data from HyperScan API with proxy detection
   */
  private static async fetchFromHyperScan(
    address: Address,
  ): Promise<ContractFetchResult> {
    const response = await fetch(
      `${ContractFetcher.APIS.hyperscan.baseUrl}/smart-contracts/${address}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    )

    if (!response.ok) {
      throw new ContractFetchError(
        `HyperScan API request failed: ${response.statusText}`,
        'hyperscan',
        response.status,
      )
    }

    const data = await response.json()

    // Handle HyperScan response format
    if (!data || typeof data !== 'object') {
      throw new ContractFetchError(
        'Invalid response from HyperScan',
        'hyperscan',
      )
    }

    // Parse ABI if available
    let abi: Abi = []
    if (data.abi) {
      try {
        abi = typeof data.abi === 'string' ? JSON.parse(data.abi) : data.abi
      } catch {
        throw new ContractFetchError(
          'Invalid ABI format from HyperScan',
          'hyperscan',
        )
      }
    }

    const baseResult: ContractFetchResult = {
      address,
      name: data.name || data.contract_name || 'Unknown Contract',
      abi,
      sourceCode: data.source_code,
      constructorArgs: data.constructor_args,
      compiler: data.compiler_version,
      version: data.compiler_version,
      verified: !!data.is_verified || !!data.verified,
      explorerSource: 'hyperscan',
      // Enhanced fields from HyperScan
      language: data.language as 'solidity' | 'vyper' | 'yul' | undefined,
      filePath: data.file_path,
      compilerSettings: data.compiler_settings
        ? {
          optimization: data.compiler_settings.optimizer
            ? {
              enabled: data.compiler_settings.optimizer.enabled,
              runs: data.compiler_settings.optimizer.runs,
            }
            : data.optimization_enabled !== undefined
              ? {
                enabled: data.optimization_enabled,
                runs: data.optimizations_runs || 200,
              }
              : undefined,
          evmVersion: data.compiler_settings.evmVersion || data.evm_version,
          compilationTarget: data.compiler_settings.compilationTarget,
          libraries: data.compiler_settings.libraries,
          remappings: data.compiler_settings.remappings,
        }
        : undefined,
      additionalSources: data.additional_sources?.map((source: any) => ({
        filePath: source.file_path,
        sourceCode: source.source_code,
      })),
    }

    // Check for proxy information
    const proxyDetection = ContractFetcher.detectProxyFromAbi(abi)
    if (!proxyDetection.isProxy) {
      return baseResult
    }

    // This is a proxy - try to get implementation
    let implementationAddress: Address | null = null

    // First try from the API response
    if (data.implementation_address) {
      implementationAddress = data.implementation_address as Address
    } else if (data.proxy?.implementation) {
      implementationAddress = data.proxy.implementation as Address
    } else {
      // Try to resolve from explorer
      implementationAddress =
        await ContractFetcher.getImplementationFromExplorer(
          address,
          'hyperscan',
        )
    }

    if (!implementationAddress) {
      // Return proxy contract as-is if we can't resolve implementation
      return {
        ...baseResult,
        isProxy: true,
        proxyType: proxyDetection.proxyType,
      }
    }

    try {
      // Fetch implementation contract
      const implementationResult = await ContractFetcher.fetchFromHyperScan(
        implementationAddress,
      )

      return {
        ...baseResult,
        isProxy: true,
        implementationAddress,
        implementationName: implementationResult.name,
        proxyType: proxyDetection.proxyType,
        // Use implementation ABI as primary, with combined ABI as fallback
        abi:
          implementationResult.abi.length > 0 ? implementationResult.abi : abi,
        combinedAbi:
          implementationResult.abi.length > 0
            ? ContractFetcher.combineAbis(abi, implementationResult.abi)
            : undefined,
        name: `${baseResult.name} (Proxy)`,
      }
    } catch (_error) {
      // Return proxy contract if implementation fetch fails
      return {
        ...baseResult,
        isProxy: true,
        implementationAddress,
        proxyType: proxyDetection.proxyType,
      }
    }
  }

  /**
   * Fetch contract data from Etherscan API with proxy detection
   */
  private static async fetchFromEtherscan(
    address: Address,
  ): Promise<ContractFetchResult> {
    const url = ContractFetcher.buildEtherscanUrl({
      module: 'contract',
      action: 'getsourcecode',
      address,
    })
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new ContractFetchError(
        `Etherscan API request failed: ${response.statusText}`,
        'etherscan',
        response.status,
      )
    }

    const data = await response.json()

    if (data.status !== '1' || !data.result || data.result.length === 0) {
      throw new ContractFetchError(
        data.message || 'Contract not found on Etherscan',
        'etherscan',
      )
    }

    const contract = data.result[0]

    // Parse ABI
    let abi: Abi = []
    if (contract.ABI && contract.ABI !== 'Contract source code not verified') {
      try {
        abi = JSON.parse(contract.ABI)
      } catch {
        throw new ContractFetchError(
          'Invalid ABI format from Etherscan',
          'etherscan',
        )
      }
    }

    // Parse Etherscan source code (might be JSON for multi-file)
    let sourceCode = contract.SourceCode
    let additionalSources:
      | Array<{ filePath: string; sourceCode: string }>
      | undefined
    let compilerSettings: ContractFetchResult['compilerSettings']

    if (sourceCode?.startsWith('{')) {
      try {
        const parsed = JSON.parse(sourceCode.slice(1, -1)) // Remove outer braces
        if (parsed.sources) {
          // Multi-file contract
          const sources = Object.entries(parsed.sources)
          if (sources.length > 0) {
            const [_mainFile, mainSource] = sources[0] as [string, any]
            sourceCode = mainSource.content
            additionalSources = sources
              .slice(1)
              .map(([filePath, source]: [string, any]) => ({
                filePath,
                sourceCode: source.content,
              }))
          }
        }

        // Extract compiler settings
        if (parsed.settings) {
          compilerSettings = {
            optimization: parsed.settings.optimizer,
            evmVersion: parsed.settings.evmVersion,
            compilationTarget: parsed.settings.compilationTarget,
            libraries: parsed.settings.libraries,
            remappings: parsed.settings.remappings,
          }
        }
      } catch {
        // If parsing fails, use as-is
      }
    }

    const baseResult: ContractFetchResult = {
      address,
      name: contract.ContractName || 'Unknown Contract',
      abi,
      sourceCode,
      constructorArgs: contract.ConstructorArguments,
      compiler: contract.CompilerVersion,
      version: contract.CompilerVersion,
      verified: contract.ABI !== 'Contract source code not verified',
      explorerSource: 'etherscan',
      language: 'solidity', // Etherscan is primarily Solidity
      compilerSettings,
      additionalSources,
    }

    // Check for proxy information
    const proxyDetection = ContractFetcher.detectProxyFromAbi(abi)
    if (!proxyDetection.isProxy) {
      return baseResult
    }

    // This is a proxy - try to get implementation
    let implementationAddress: Address | null = null

    // First try from the source code or API response
    if (contract.Implementation) {
      implementationAddress = contract.Implementation as Address
    } else if (contract.Proxy === '1' && contract.Implementation) {
      implementationAddress = contract.Implementation as Address
    } else {
      // Try to resolve from explorer
      implementationAddress =
        await ContractFetcher.getImplementationFromExplorer(
          address,
          'etherscan',
        )
    }

    if (!implementationAddress) {
      // Return proxy contract as-is if we can't resolve implementation
      return {
        ...baseResult,
        isProxy: true,
        proxyType: proxyDetection.proxyType,
      }
    }

    try {
      // Fetch implementation contract
      const implementationResult = await ContractFetcher.fetchFromEtherscan(
        implementationAddress,
      )

      return {
        ...baseResult,
        isProxy: true,
        implementationAddress,
        implementationName: implementationResult.name,
        proxyType: proxyDetection.proxyType,
        // Use implementation ABI as primary, with combined ABI as fallback
        abi:
          implementationResult.abi.length > 0 ? implementationResult.abi : abi,
        combinedAbi:
          implementationResult.abi.length > 0
            ? ContractFetcher.combineAbis(abi, implementationResult.abi)
            : undefined,
        name: `${baseResult.name} (Proxy)`,
      }
    } catch (_error) {
      // Return proxy contract if implementation fetch fails
      return {
        ...baseResult,
        isProxy: true,
        implementationAddress,
        proxyType: proxyDetection.proxyType,
      }
    }
  }

  /**
   * Attempt to fetch contract from multiple sources with fallback
   * If first source returns unverified contract, tries second source
   * If both return unverified, throws ContractNotVerifiedError
   */
  static async fetchContract(
    address: string,
    preferredSource: 'etherscan' | 'hyperscan' = 'hyperscan',
  ): Promise<ContractFetchResult> {
    if (!ContractFetcher.validateAddress(address)) {
      throw new ContractFetchError('Invalid address format', preferredSource)
    }

    const validAddress = address as Address
    const sources: Array<'etherscan' | 'hyperscan'> =
      preferredSource === 'hyperscan'
        ? ['hyperscan', 'etherscan']
        : ['etherscan', 'hyperscan']

    let lastError: ContractFetchError | null = null
    let unverifiedResults: ContractFetchResult[] = []

    for (const source of sources) {
      try {
        const result = source === 'hyperscan'
          ? await ContractFetcher.fetchFromHyperScan(validAddress)
          : await ContractFetcher.fetchFromEtherscan(validAddress)

        // If contract is verified, return immediately
        if (result.verified) {
          return result
        }

        // Store unverified result to potentially return later
        unverifiedResults.push(result)
      } catch (error) {
        lastError =
          error instanceof ContractFetchError
            ? error
            : new ContractFetchError(
              error instanceof Error ? error.message : 'Unknown error',
              source,
            )
      }
    }

    // If we have unverified results but no verified ones, throw specialized error
    if (unverifiedResults.length > 0) {
      throw new ContractNotVerifiedError()
    }

    // If we get here, all sources failed with errors
    throw (
      lastError ||
      new ContractFetchError(
        'Failed to fetch contract from all sources',
        preferredSource,
      )
    )
  }

  /**
   * Fetch only ABI from contract address
   */
  static async fetchAbi(
    address: string,
    preferredSource: 'etherscan' | 'hyperscan' = 'hyperscan',
  ): Promise<Abi> {
    const contract = await ContractFetcher.fetchContract(
      address,
      preferredSource,
    )
    return contract.abi
  }

  /**
   * Check if an address is a contract (has code)
   * This is a simplified check - ideally would use RPC call
   */
  static async isContractAddress(address: Address): Promise<boolean> {
    try {
      // Try to fetch contract data - if successful, it's likely a contract
      await ContractFetcher.fetchContract(address)
      return true
    } catch {
      // If fetching fails, it might not be a contract or not verified
      return false
    }
  }

  /**
   * Get available explorer sources
   */
  static getAvailableSources(): ExplorerApiConfig[] {
    return Object.values(ContractFetcher.APIS)
  }
}
