import type { AltitraceClient } from '@altitrace/sdk/client/altitrace'
import type {
  AccessListComparisonResult,
  ExtendedAccessListResponse,
  ExtendedSimulationResult,
  ExtendedTracerResponse,
  SimulationRequest,
  StateOverride,
} from '@altitrace/sdk/types'
import {
  ContractFetcher,
  type ContractFetchResult,
} from '@/services/contract-fetcher'
import type { Abi } from 'viem'

/**
 * Enhanced trace result from transaction hash tracing with ABI decoding
 */
export interface EnhancedTraceResult {
  /** Original trace data from SDK */
  traceData: ExtendedTracerResponse
  /** Transaction hash that was traced */
  transactionHash: string
  /** Whether the transaction was successful */
  success: boolean
  /** Gas used by the transaction */
  gasUsed: bigint
  /** Any errors from trace execution */
  errors: string[]
  /** Transaction status */
  status: 'success' | 'failed' | 'reverted'
  /** Type identifier */
  type: 'trace'
  /** Whether this result has call hierarchy data */
  hasCallHierarchy: boolean
  /** Flag to identify trace results */
  isTraceResult: true
  /** Transaction receipt if available */
  receipt?: {
    blockNumber: bigint
    blockHash: string
    transactionIndex: number
    effectiveGasPrice: bigint
    contractAddress?: string
    blockGasUsed?: bigint
    blockGasLimit?: bigint
    baseFeePerGas?: bigint
  }
  /** Auto-fetched contracts for event decoding */
  fetchedContracts?: ContractFetchResult[]
  /** Combined ABI created from fetched contracts */
  combinedABI?: Abi
  /** Decoded events from logs using fetched ABIs */
  decodedEvents?: any[]
}

/**
 * Gas comparison analysis between simulations with and without access list
 */
export interface GasComparisonAnalysis {
  /** Original simulation without access list */
  originalSimulation: ExtendedSimulationResult
  /** Optimized simulation with access list (if successful) */
  optimizedSimulation?: ExtendedSimulationResult
  /** Access list data used for optimization */
  accessListData: ExtendedAccessListResponse
  /** Comparison metrics */
  comparison: {
    /** Original gas usage */
    originalGasUsed: bigint
    /** Optimized gas usage (if available) */
    optimizedGasUsed?: bigint
    /** Gas difference (negative = savings, positive = overhead) */
    gasDifference?: bigint
    /** Percentage change (negative = savings, positive = overhead) */
    percentageChange?: number
    /** Whether the access list provides benefit */
    isBeneficial?: boolean
    /** Human-readable recommendation */
    recommendation:
      | 'use-access-list'
      | 'skip-access-list'
      | 'neutral'
      | 'unknown'
    /** Status of the comparison */
    status: 'success' | 'partial' | 'failed'
    /** Error message if comparison failed */
    error?: string
  }
}

/**
 * Enhanced simulation result with trace data and access list for complete analysis
 */
export interface EnhancedSimulationResult extends ExtendedSimulationResult {
  traceData?: ExtendedTracerResponse
  accessListData?: ExtendedAccessListResponse
  gasComparison?: GasComparisonAnalysis
  accessListComparison?: AccessListComparisonResult
  hasCallHierarchy: boolean
  hasAccessList: boolean
  hasGasComparison: boolean
}

/**
 * Enhanced transaction trace result for direct transaction tracing
 */
export interface EnhancedTraceResult {
  traceData: ExtendedTracerResponse
  hasCallHierarchy: boolean
  transactionHash: string
  success: boolean
  gasUsed: bigint
  errors: string[]
  status: 'success' | 'failed' | 'reverted'
  type: 'trace'
  isTraceResult: true
  /** Optional receipt data with block gas info */
  receipt?: {
    blockNumber: bigint
    blockHash: string
    transactionIndex: number
    effectiveGasPrice: bigint
    contractAddress?: string
    blockGasUsed?: bigint
    blockGasLimit?: bigint
    baseFeePerGas?: bigint
  }
}

/* DISABLED - VIEM ASSET TRACKING (keep for debugging)
/**
 * Execute viem asset tracking for getting token balance changes
 * This uses viem's simulateCall with traceAssetChanges to get asset data that our API doesn't provide yet
 */
/*
async function executeViemAssetTracking(
  client: AltitraceClient,
  request: SimulationRequest,
): Promise<any[] | undefined> {
  try {
    const viemClient = (client as any).viemClient
    if (!viemClient) {
      console.warn('⚠️ [Viem Asset Tracking] No viem client available')
      return undefined
    }

    console.log('🔍 [Viem Asset Tracking] Viem client available:', {
      hasSimulateCalls: typeof viemClient.simulateCalls === 'function',
      hasCall: typeof viemClient.call === 'function',
      availableMethods: Object.getOwnPropertyNames(viemClient).filter(name => typeof viemClient[name] === 'function'),
      transport: viemClient.transport?.url || 'unknown',
      chain: viemClient.chain?.name || 'unknown'
    })

    const primaryCall = request.params.calls[0]
    if (!primaryCall) {
      return undefined
    }

    // Prepare viem simulation parameters
    const viemCallParams: any = {
      to: primaryCall.to as `0x${string}`,
      data: primaryCall.data as `0x${string}`,
      value: primaryCall.value ? BigInt(primaryCall.value) : undefined,
      from: primaryCall.from as `0x${string}` | undefined,
      gas: primaryCall.gas ? BigInt(primaryCall.gas) : undefined,
    }

    // Add state overrides if present (convert from array to viem format)
    const stateOverride: Record<string, any> = {}
    if (request.options?.stateOverrides?.length) {
      for (const override of request.options.stateOverrides) {
        if (override.address) {
          const viemOverride: any = {}
          if (override.balance) viemOverride.balance = BigInt(override.balance)
          if (override.nonce !== undefined) viemOverride.nonce = override.nonce
          if (override.code) viemOverride.code = override.code
          if (override.storage) viemOverride.storage = override.storage
          stateOverride[override.address] = viemOverride
        }
      }
    }

    // Determine block parameter
    const blockTag = request.params.blockNumber || request.params.blockTag || 'latest'

    // Prepare simulation options with block parameter
    const viemSimulateOptions: any = {
      account: request.params.account || primaryCall.from,
      blockTag: blockTag === 'latest' ? 'latest' : blockTag,
    }

    // Add state override if any
    if (Object.keys(stateOverride).length > 0) {
      viemSimulateOptions.stateOverride = stateOverride
    }

    console.log('🔍 [Viem Asset Tracking] Calling viem call with:', {
      call: viemCallParams,
      options: viemSimulateOptions,
      block: blockTag,
    })

    // Skip basic connectivity test since transaction might be expired/invalid
    // We'll test connectivity directly with simulateCalls which handles block context better
    console.log('🔍 [Viem Asset Tracking] Proceeding directly to simulateCalls with proper block context')

    // Check if simulateCalls method exists
    if (typeof viemClient.simulateCalls !== 'function') {
      console.warn('⚠️ [Viem Asset Tracking] simulateCalls method not available on viem client')
      console.log('   Available methods:', Object.getOwnPropertyNames(viemClient).filter(name => typeof viemClient[name] === 'function'))
      return undefined
    }

    // Use viem's simulateCalls method with traceAssetChanges
    try {
      console.log('🔍 [Viem Asset Tracking] Calling simulateCalls with traceAssetChanges...')

      const callsToSimulate = [viemCallParams]

      // Prepare simulateCalls options - account is REQUIRED for traceAssetChanges
      const accountAddress = request.params.account || primaryCall.from

      if (!accountAddress) {
        console.warn('⚠️ [Viem Asset Tracking] No account address available for traceAssetChanges')
        return undefined
      }

      const simulateOptions: any = {
        traceAssetChanges: true,
        account: accountAddress,
      }

      console.log('🔍 [Viem Asset Tracking] Using account for asset tracking:', accountAddress)

      // Handle block parameter correctly for simulateCalls
      // CRITICAL: Must use the same historical block as the original simulation
      if (blockTag === 'latest') {
        simulateOptions.blockTag = 'latest'
      } else if (typeof blockTag === 'string' && blockTag.startsWith('0x')) {
        // Convert hex block number to bigint for simulateCalls
        const blockNumber = BigInt(blockTag)
        simulateOptions.blockNumber = blockNumber
        console.log(`🔍 [Viem Asset Tracking] Using historical block: ${blockNumber} (${blockTag})`)
      } else if (typeof blockTag === 'string' && !isNaN(Number(blockTag))) {
        // Handle numeric string
        const blockNumber = BigInt(blockTag)
        simulateOptions.blockNumber = blockNumber
        console.log(`🔍 [Viem Asset Tracking] Using historical block: ${blockNumber}`)
      } else {
        // For expired transactions, we should NOT default to latest
        console.warn('⚠️ [Viem Asset Tracking] Unknown block format, this may cause EXPIRED errors:', blockTag)
        simulateOptions.blockTag = 'latest'
      }

      // Add state overrides if present
      if (Object.keys(stateOverride).length > 0) {
        simulateOptions.stateOverride = stateOverride
      }

      console.log('📡 [Viem Asset Tracking] simulateCalls parameters:', {
        calls: callsToSimulate,
        options: simulateOptions,
        originalBlockTag: blockTag
      })

      const viemResult = await viemClient.simulateCalls({
        calls: callsToSimulate,
        ...simulateOptions,
      })

      console.log('✅ [Viem Asset Tracking] simulateCalls result:', JSON.stringify(viemResult, createBigIntSafeLogger(), 2))

      // Debug the structure to understand why assetChanges might be empty
      console.log('🔍 [Viem Asset Tracking] Result structure analysis:', {
        hasAssetChanges: !!viemResult?.assetChanges,
        assetChangesLength: viemResult?.assetChanges?.length || 0,
        assetChangesContent: viemResult?.assetChanges,
        hasResults: !!viemResult?.results,
        resultsLength: viemResult?.results?.length || 0,
        hasBlock: !!viemResult?.block,
        hasLogs: viemResult?.results?.[0]?.logs?.length || 0,
        logSample: viemResult?.results?.[0]?.logs?.slice(0, 2)
      })

      // Extract asset changes from viem result
      const assetChanges = extractAssetChangesFromViemResult(viemResult)

      if (assetChanges && assetChanges.length > 0) {
        console.log(`🎯 [Viem Asset Tracking] Found ${assetChanges.length} asset changes`)
        return assetChanges
      } else {
        console.log('ℹ️ [Viem Asset Tracking] No asset changes found in simulateCalls result')

        // Fallback: Extract from Transfer events if simulation has logs
        const logs = viemResult?.results?.[0]?.logs
        if (logs && logs.length > 0) {
          console.log('🔄 [Viem Asset Tracking] Attempting to extract asset changes from Transfer events as fallback...')
          const transferBasedAssetChanges = extractAssetChangesFromTransferEvents(logs, accountAddress)

          if (transferBasedAssetChanges && transferBasedAssetChanges.length > 0) {
            console.log(`✅ [Viem Asset Tracking] Fallback found ${transferBasedAssetChanges.length} asset changes from Transfer events`)
            return transferBasedAssetChanges
          }
        }

        return undefined
      }

    } catch (error) {
      console.warn('⚠️ [Viem Asset Tracking] simulateCalls failed:', error)
      console.log('   Error details:', {
        name: (error as any)?.name,
        message: (error as any)?.message,
        code: (error as any)?.code,
        stack: (error as any)?.stack?.split('\n').slice(0, 3)
      })

      return undefined
    }
  } catch (error) {
    console.warn('⚠️ [Viem Asset Tracking] Failed to get asset changes:', error)
    // Don't throw - this is supplementary data
    return undefined
  }
}
*/
// END DISABLED VIEM ASSET TRACKING

// Hardcoded token metadata for HyperEVM network
export const HARDCODED_TOKEN_DATA = new Map<
  string,
  { symbol: string; decimals: number; name: string }
>([
  // Native currency (ETH equivalent on HyperEVM)
  [
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    { symbol: 'HYPE', decimals: 18, name: 'HyperEVM Native Token' },
  ],
  // WHYPE (Wrapped HYPE)
  [
    '0x5555555555555555555555555555555555555555',
    { symbol: 'WHYPE', decimals: 18, name: 'Wrapped HYPE' },
  ],
])

// Cache for fetched token metadata
const tokenMetadataCache = new Map<
  string,
  { symbol?: string; decimals?: number; name?: string }
>()

/**
 * Get token metadata (symbol, decimals, name) with caching and hardcoded overrides
 */
export async function getTokenMetadata(
  tokenAddress: string,
): Promise<{ symbol?: string; decimals?: number; name?: string }> {
  const normalizedAddress = tokenAddress.toLowerCase()

  // Check hardcoded data first
  const hardcoded = HARDCODED_TOKEN_DATA.get(normalizedAddress)
  if (hardcoded) {
    return hardcoded
  }

  // Check cache
  if (tokenMetadataCache.has(normalizedAddress)) {
    const cached = tokenMetadataCache.get(normalizedAddress)!

    return cached
  }

  // Fetch from blockchain (using viem client from config)
  try {
    // Import viem client here to avoid circular dependencies
    const { viemClient } = await import('@/config/chains')

    // Run all calls in parallel
    const [symbol, decimals, name] = await Promise.allSettled([
      viemClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: [
          {
            name: 'symbol',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ type: 'string' }],
          },
        ],
        functionName: 'symbol',
      }),
      viemClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: [
          {
            name: 'decimals',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ type: 'uint8' }],
          },
        ],
        functionName: 'decimals',
      }),
      viemClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: [
          {
            name: 'name',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ type: 'string' }],
          },
        ],
        functionName: 'name',
      }),
    ])

    const metadata = {
      symbol:
        symbol.status === 'fulfilled' ? (symbol.value as string) : undefined,
      decimals: decimals.status === 'fulfilled' ? Number(decimals.value) : 18, // Default to 18
      name: name.status === 'fulfilled' ? (name.value as string) : undefined,
    }

    // Cache the result
    tokenMetadataCache.set(normalizedAddress, metadata)

    return metadata
  } catch (error) {
    console.warn(
      `⚠️ [Token Metadata] Failed to fetch metadata for ${tokenAddress}:`,
      error,
    )

    // Cache empty result to avoid repeated failed calls
    const emptyMetadata = { symbol: undefined, decimals: 18, name: undefined }
    tokenMetadataCache.set(normalizedAddress, emptyMetadata)
    return emptyMetadata
  }
}

/**
 * Parse native HYPE transfers from call trace value changes
 */
export function parseNativeTransfers(
  traceData: any,
  targetAccount: string,
): Array<{ address: string; change: bigint }> {
  const changes: Array<{ address: string; change: bigint }> = []

  if (!traceData.callTracer?.rootCall) {
    return changes
  }

  // Recursive function to analyze all calls in the trace
  function analyzeCall(call: any, depth = 0) {
    if (!call) return

    const indent = '  '.repeat(depth)

    // Check if this call transfers native currency to/from our target account
    const value = call.value ? BigInt(call.value) : BigInt(0)
    const from = (call.from || '').toLowerCase()
    const to = (call.to || '').toLowerCase()
    const target = targetAccount.toLowerCase()

    if (value > 0n) {
      if (from === target) {
        // Outgoing native transfer
        changes.push({
          address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          change: -value,
        })
      }
      if (to === target) {
        // Incoming native transfer
        changes.push({
          address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          change: value,
        })
      }
    }

    // Analyze subcalls recursively
    if (call.calls && Array.isArray(call.calls)) {
      for (const subCall of call.calls) {
        analyzeCall(subCall, depth + 1)
      }
    }
  }

  analyzeCall(traceData.callTracer.rootCall)

  return changes
}

/**
 * Parse ERC-20/ERC-721 Transfer events from logs
 */
export function parseTokenTransfersFromLogs(
  logs: any[],
  targetAccount: string,
): Array<{ address: string; change: bigint }> {
  const changes = new Map<string, bigint>()

  if (!logs || logs.length === 0) {
    return []
  }

  // ERC-20/ERC-721 Transfer event signature: Transfer(address,address,uint256)
  const TRANSFER_SIGNATURE =
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
  const target = targetAccount.toLowerCase()

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i]

    // Skip if not a Transfer event
    if (
      !log.topics ||
      log.topics[0] !== TRANSFER_SIGNATURE ||
      log.topics.length < 3
    ) {
      continue
    }

    const tokenAddress = log.address.toLowerCase()
    const fromAddress = '0x' + log.topics[1].slice(26).toLowerCase() // Remove padding
    const toAddress = '0x' + log.topics[2].slice(26).toLowerCase() // Remove padding

    // Parse transfer amount from data field
    let amount: bigint
    try {
      amount = BigInt(log.data || '0x0')
    } catch (error) {
      console.warn(
        `Failed to parse transfer amount for ${tokenAddress}:`,
        log.data,
      )
      continue
    }

    // Check if this transfer affects our target account
    let netChange = BigInt(0)
    if (fromAddress === target) {
      netChange -= amount // Outgoing transfer (negative)
    }
    if (toAddress === target) {
      netChange += amount // Incoming transfer (positive)
    }

    if (netChange !== BigInt(0)) {
      // Update running total for this token
      const currentChange = changes.get(tokenAddress) || BigInt(0)
      changes.set(tokenAddress, currentChange + netChange)
    }
  }

  // Convert to array format
  const result = Array.from(changes.entries()).map(([address, change]) => ({
    address,
    change,
  }))

  return result
}

/**
 * NEW: Execute trace-based asset tracking by parsing simulation results
 * This extracts asset changes from existing trace data without additional API calls
 */
async function executeTraceBasedAssetTracking(
  request: SimulationRequest,
  primaryCall: any,
  simulationResult: any,
  traceResult: any,
): Promise<any[] | undefined> {
  try {
    // Get the target account from the request or primary call
    const targetAccount = request.params.account || primaryCall.from
    if (!targetAccount) {
      console.warn(
        '⚠️ [Trace Asset Tracking] No target account specified for asset tracking',
      )
      return undefined
    }

    const allChanges = new Map<string, { address: string; change: bigint }>()

    // 1. Parse native HYPE transfers from trace data
    if (traceResult?.callTracer?.rootCall) {
      const nativeChanges = parseNativeTransfers(traceResult, targetAccount)

      for (const change of nativeChanges) {
        const existing = allChanges.get(change.address) || {
          address: change.address,
          change: BigInt(0),
        }
        existing.change += change.change
        allChanges.set(change.address, existing)
      }
    }

    // 2. Parse ERC-20/ERC-721 Transfer events from logs
    let logs: any[] = []

    // Try to get logs from trace data first (preferred)
    if (traceResult?.getAllLogs) {
      logs = traceResult.getAllLogs()
    }
    // Fallback to simulation result logs
    else if (simulationResult?.getAllLogs) {
      logs = simulationResult.getAllLogs()
    }
    // Fallback to direct logs property
    else if (simulationResult?.logs?.length) {
      logs = simulationResult.logs
    }

    if (logs.length > 0) {
      const tokenChanges = parseTokenTransfersFromLogs(logs, targetAccount)

      for (const change of tokenChanges) {
        const existing = allChanges.get(change.address) || {
          address: change.address,
          change: BigInt(0),
        }
        existing.change += change.change
        allChanges.set(change.address, existing)
      }
    }

    // 3. Convert to asset changes format with metadata fetching
    const assetChanges: any[] = []

    for (const [address, changeData] of allChanges.entries()) {
      if (changeData.change === BigInt(0)) {
        continue // Skip zero changes
      }

      // Fetch token metadata
      const metadata = await getTokenMetadata(address)

      // Determine change type
      const changeType = changeData.change > 0n ? 'gain' : 'loss'
      const absChange =
        changeData.change < 0n ? -changeData.change : changeData.change

      assetChanges.push({
        // Flat format for EnhancedSimulationResults UI compatibility
        tokenAddress: address,
        symbol: metadata.symbol,
        decimals: metadata.decimals || 18,
        netChange: absChange.toString(),
        type: changeType,

        // Legacy nested format for other components (if needed)
        token: {
          address: address,
          symbol: metadata.symbol,
          name: metadata.name,
          decimals: metadata.decimals || 18,
        },
        value: {
          pre: '0', // We don't track exact before/after, just the change
          post: changeData.change.toString(),
          diff: changeData.change.toString(),
        },
      })
    }

    if (assetChanges.length > 0) {
      return assetChanges
    } else {
      return []
    }
  } catch (error) {
    console.warn(
      '⚠️ [Trace Asset Tracking] Failed to get asset changes from trace:',
      error,
    )
    return undefined
  }
}

/* DISABLED - VIEM HELPER FUNCTIONS (keep for debugging)
/**
 * Extract and normalize asset changes from viem simulateCalls result
 */
/*
function extractAssetChangesFromViemResult(viemResult: any): any[] {
  try {
    console.log('🔍 [Viem Asset Tracking] Processing result structure:', {
      isArray: Array.isArray(viemResult),
      keys: viemResult ? Object.keys(viemResult) : [],
      length: Array.isArray(viemResult) ? viemResult.length : 'N/A'
    })

    // simulateCalls returns an array of results, we want the first one
    let resultToProcess = viemResult
    if (Array.isArray(viemResult) && viemResult.length > 0) {
      resultToProcess = viemResult[0]
      console.log('🔍 [Viem Asset Tracking] Processing first result from array')
    }

    // According to viem source code, assetChanges is a direct top-level property
    const assetChanges = resultToProcess?.assetChanges || []

    console.log('🔍 [Viem Asset Tracking] Looking for assetChanges in result:', {
      hasAssetChanges: !!resultToProcess?.assetChanges,
      assetChangesLength: resultToProcess?.assetChanges?.length || 0,
      resultKeys: Object.keys(resultToProcess || {}),
    })

    if (!assetChanges || assetChanges.length === 0) {
      console.log('🔍 [Viem Asset Tracking] No asset changes found. Result structure:',
        JSON.stringify(resultToProcess, createBigIntSafeLogger(), 2).slice(0, 500))
      return []
    }

    console.log(`✅ [Viem Asset Tracking] Found ${assetChanges.length} asset changes:`,
      JSON.stringify(assetChanges, createBigIntSafeLogger(), 2))

    // Normalize viem's exact structure to our expected format
    return assetChanges.map((change: any, index: number) => {
      console.log(`🔧 [Viem Asset Tracking] Processing change ${index}:`,
        JSON.stringify(change, createBigIntSafeLogger(), 2))

      // Viem returns exact structure: { token: {...}, value: { pre, post, diff } }
      return {
        token: {
          address: change.token?.address,
          symbol: change.token?.symbol || null,
          name: change.token?.name || null,
          decimals: change.token?.decimals || 18,
        },
        value: {
          pre: convertBigIntToString(change.value?.pre || '0'),
          post: convertBigIntToString(change.value?.post || '0'),
          diff: convertBigIntToString(change.value?.diff || '0'),
        },
      }
    })
  } catch (error) {
    console.warn('⚠️ [Viem Asset Tracking] Error processing asset changes:', error)
    return []
  }
}

/**
 * Helper function for BigInt-safe JSON logging
 */
function createBigIntSafeLogger() {
  return (key: string, value: any) =>
    typeof value === 'bigint' ? `BigInt(${value})` : value
}

/**
 * Helper function to safely convert BigInt or string values to string
 */
function convertBigIntToString(value: any): string {
  if (typeof value === 'bigint') {
    return value.toString()
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number') {
    return value.toString()
  }
  return '0'
}

/**
 * Helper function to calculate difference between two balance values
 */
function calculateDiff(pre: any, post: any): string {
  try {
    const preString = convertBigIntToString(pre)
    const postString = convertBigIntToString(post)
    const preBN = BigInt(preString)
    const postBN = BigInt(postString)
    return (postBN - preBN).toString()
  } catch (error) {
    console.warn('Failed to calculate diff:', error)
    return '0'
  }
}

/**
 * Fallback: Extract asset changes from Transfer events when viem's native tracking fails
 * This parses ERC-20/ERC-721 Transfer events from simulation logs
 */
function extractAssetChangesFromTransferEvents(
  logs: any[],
  accountAddress: string,
): any[] {
  if (!logs || logs.length === 0 || !accountAddress) {
    return []
  }

  console.log(
    `🔍 [Transfer Events] Parsing ${logs.length} logs for account ${accountAddress}`,
  )

  // ERC-20/ERC-721 Transfer event signature: Transfer(address,address,uint256)
  const TRANSFER_SIGNATURE =
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

  // Track balance changes per token
  const tokenChanges = new Map<
    string,
    {
      token: { address: string; symbol?: string; decimals?: number }
      totalChange: bigint
    }
  >()

  const targetAccount = accountAddress.toLowerCase()

  for (const log of logs) {
    // Skip if not a Transfer event
    if (
      !log.topics ||
      log.topics[0] !== TRANSFER_SIGNATURE ||
      log.topics.length < 3
    ) {
      continue
    }

    const tokenAddress = log.address.toLowerCase()
    const fromAddress = '0x' + log.topics[1].slice(26) // Remove padding
    const toAddress = '0x' + log.topics[2].slice(26) // Remove padding

    // Parse transfer amount from data field
    let amount: bigint
    try {
      amount = BigInt(log.data || '0x0')
    } catch (error) {
      console.warn(
        `Failed to parse transfer amount for ${tokenAddress}:`,
        log.data,
      )
      continue
    }

    console.log(
      `📝 [Transfer Events] ${tokenAddress}: ${fromAddress} → ${toAddress}, amount: ${amount.toString()}`,
    )

    // Check if this transfer affects our target account
    let accountChange = 0n
    if (fromAddress.toLowerCase() === targetAccount) {
      accountChange -= amount // Outgoing transfer (negative)
    }
    if (toAddress.toLowerCase() === targetAccount) {
      accountChange += amount // Incoming transfer (positive)
    }

    if (accountChange !== 0n) {
      console.log(
        `💰 [Transfer Events] Account affected: ${accountChange > 0n ? '+' : ''}${accountChange.toString()}`,
      )

      // Update or create token change tracking
      if (tokenChanges.has(tokenAddress)) {
        const existing = tokenChanges.get(tokenAddress)!
        existing.totalChange += accountChange
      } else {
        tokenChanges.set(tokenAddress, {
          token: {
            address: tokenAddress,
            // We don't have symbol/decimals from logs, they'll be undefined
            symbol: undefined,
            decimals: undefined,
          },
          totalChange: accountChange,
        })
      }
    }
  }

  // Convert to asset changes format
  const assetChanges = Array.from(tokenChanges.entries()).map(
    ([address, change]) => {
      console.log(
        `🎯 [Transfer Events] Final change for ${address}: ${change.totalChange.toString()}`,
      )

      return {
        token: {
          address: change.token.address,
          symbol: change.token.symbol,
          name: undefined, // Not available from Transfer events
          decimals: change.token.decimals || 18, // Default to 18 for ERC-20
        },
        value: {
          pre: '0', // We don't know the exact before/after from events
          post: change.totalChange.toString(), // Net change
          diff: change.totalChange.toString(),
        },
      }
    },
  )

  console.log(
    `✅ [Transfer Events] Extracted ${assetChanges.length} asset changes from Transfer events`,
  )
  return assetChanges
}
// END DISABLED VIEM HELPER FUNCTIONS

/**
 * Merge asset changes from API and trace sources, preferring trace data when available
 */
function mergeAssetChanges(
  apiAssetChanges: any[] | undefined | null,
  traceAssetChanges: any[] | undefined | null,
): any[] {
  // If no data from either source, return empty array
  if (
    (!apiAssetChanges || apiAssetChanges.length === 0) &&
    (!traceAssetChanges || traceAssetChanges.length === 0)
  ) {
    return []
  }

  // If only trace data available, use it
  if (!apiAssetChanges || apiAssetChanges.length === 0) {
    return traceAssetChanges || []
  }

  // If only API data available, use it
  if (!traceAssetChanges || traceAssetChanges.length === 0) {
    return apiAssetChanges
  }

  // If both available, merge them (prefer trace data for duplicates)
  const mergedMap = new Map<string, any>()

  // Add API data first
  for (const change of apiAssetChanges) {
    const key = change.token?.address || change.address
    if (key) {
      mergedMap.set(key.toLowerCase(), change)
    }
  }

  // Add trace data second (overwrites API data for same token)
  for (const change of traceAssetChanges) {
    const key = change.token?.address || change.address
    if (key) {
      mergedMap.set(key.toLowerCase(), change) // trace data takes priority
    }
  }

  const merged = Array.from(mergedMap.values())
  return merged
}

/**
 * Execute simulation, trace, and access list APIs with gas comparison analysis
 */
export async function executeEnhancedSimulation(
  client: AltitraceClient,
  request: SimulationRequest,
): Promise<EnhancedSimulationResult> {
  try {
    // Extract the first call for tracing and access list (assumes single transaction simulation)
    const primaryCall = request.params.calls[0]

    if (!primaryCall) {
      throw new Error('No calls found in simulation request')
    }

    // Execute simulation and trace in parallel first
    const [simulationResult, traceResult, accessListComparison] =
      await Promise.all([
        // Original simulation API
        (async () => {
          const simResult = await client.executeSimulation(request)
          return simResult
        })(),

        // Trace API for call hierarchy (fallback silently if not available)
        (async () => {
          let traceBuilder = client.trace().call(primaryCall)

          // Add state overrides if available (must be called before other builder methods)
          if (request.options?.stateOverrides?.length) {
            // Convert array format to Record format expected by SDK
            const stateOverridesRecord: Record<
              string,
              (typeof request.options.stateOverrides)[0]
            > = {}
            request.options.stateOverrides.forEach((override) => {
              if (override.address) {
                stateOverridesRecord[override.address] = override
              }
            })

            traceBuilder = traceBuilder.withStateOverrides(stateOverridesRecord)
          }

          // Add tracing configuration after state overrides
          traceBuilder = traceBuilder
            .atBlock(
              request.params.blockNumber || request.params.blockTag || 'latest',
            )
            .withCallTracer({ onlyTopCall: false, withLogs: true })
            .with4ByteTracer()

          const result = await traceBuilder.execute()
          return result
        })().catch((error) => {
          console.warn(
            '⚠️ [Trace API] Trace API failed, continuing without trace data:',
            error,
          )
          return null
        }), // Silently fail if trace API not available

        // Access list comparison for gas optimization analysis
        (async () => {
          // Skip access list when state overrides are present (not supported by backend yet)
          if (request.options?.stateOverrides?.length) {
            return null
          }

          const accessListBuilder = client
            .compareAccessList()
            .call(primaryCall)
            .atBlock(
              request.params.blockNumber || request.params.blockTag || 'latest',
            )
            .withAssetChanges(request.params.traceAssetChanges ?? false)
            .withTransfers(request.params.traceTransfers ?? false)
            .withValidation(request.params.validation ?? true)

          return accessListBuilder.execute()
        })().catch((_error) => {
          return null
        }), // Log error but continue with simulation
      ])

    // Now execute trace-based asset tracking with the available data
    let traceAssetChanges: any[] | undefined
    try {
      traceAssetChanges = await executeTraceBasedAssetTracking(
        request,
        primaryCall,
        simulationResult,
        traceResult,
      )
    } catch (error) {
      console.warn(
        '⚠️ [Trace Asset Tracking] Failed to get asset changes from trace:',
        error,
      )
      traceAssetChanges = undefined
    }

    // Create legacy gas comparison from the new comparison result
    let gasComparison: GasComparisonAnalysis | undefined
    if (accessListComparison?.success.baseline) {
      gasComparison = createGasComparisonFromComparison(accessListComparison)
    }

    // Merge asset changes from trace parsing with API results (if any)
    const mergedAssetChanges = mergeAssetChanges(
      simulationResult.assetChanges,
      traceAssetChanges,
    )

    // Combine results
    const enhancedResult: EnhancedSimulationResult = {
      ...simulationResult,
      assetChanges: mergedAssetChanges,
      traceData: traceResult || undefined,
      accessListData: accessListComparison?.accessListData || undefined,
      gasComparison,
      accessListComparison: accessListComparison || undefined,
      hasCallHierarchy: !!traceResult?.callTracer?.rootCall,
      hasAccessList: !!accessListComparison?.success.accessList,
      hasGasComparison: !!accessListComparison?.success.baseline,
    }

    // Override getAssetChangesSummary to use our trace-based asset changes
    enhancedResult.getAssetChangesSummary = () => {
      if (!mergedAssetChanges || mergedAssetChanges.length === 0) {
        return []
      }

      // Convert our format to AssetChangeSummary format
      const summary = mergedAssetChanges.map((change, index) => {
        return {
          tokenAddress: change.tokenAddress,
          symbol: change.symbol,
          decimals: change.decimals,
          netChange: change.netChange,
          type: change.type as 'gain' | 'loss',
        }
      })

      return summary
    }

    return enhancedResult
  } catch (_error) {
    const simulationResult = await client.executeSimulation(request)

    return {
      ...simulationResult,
      hasCallHierarchy: false,
      hasAccessList: false,
      hasGasComparison: false,
    }
  }
}

/**
 * Create legacy gas comparison from new comparison result
 */
function createGasComparisonFromComparison(
  comparisonResult: AccessListComparisonResult,
): GasComparisonAnalysis | undefined {
  if (!comparisonResult.baseline || !comparisonResult.accessListData) {
    return undefined
  }

  const { baseline, optimized, accessListData, comparison, success, errors } =
    comparisonResult

  // Map recommendation from new format to legacy format
  let recommendation: GasComparisonAnalysis['comparison']['recommendation']
  if (comparison.recommended) {
    recommendation = 'use-access-list'
  } else if (comparison.accessListEffective === false) {
    recommendation = 'skip-access-list'
  } else if (!success.optimized) {
    recommendation = 'unknown'
  } else {
    recommendation = 'neutral'
  }

  // Determine status based on what succeeded
  let status: GasComparisonAnalysis['comparison']['status']
  if (success.baseline && success.accessList && success.optimized) {
    status = 'success'
  } else if (success.baseline && success.accessList) {
    status = 'partial'
  } else {
    status = 'failed'
  }

  return {
    originalSimulation: baseline,
    optimizedSimulation: optimized || undefined,
    accessListData: accessListData!, // accessListData is required for gas comparison
    comparison: {
      originalGasUsed: comparison.gasBaseline || 0n,
      optimizedGasUsed: comparison.gasOptimized || undefined,
      gasDifference: comparison.gasDifference || undefined,
      percentageChange: comparison.gasPercentageChange || undefined,
      isBeneficial: comparison.accessListEffective,
      recommendation,
      status,
      error: !success.baseline
        ? errors.baseline
        : !success.accessList
          ? errors.accessList
          : !success.optimized
            ? errors.optimized
            : undefined,
    },
  }
}

/**
 * Create gas comparison analysis from simulation results (legacy function)
 */
function _createGasComparisonAnalysis(
  originalSimulation: ExtendedSimulationResult,
  optimizedSimulation: ExtendedSimulationResult,
  accessListData: ExtendedAccessListResponse,
): GasComparisonAnalysis {
  const originalGasUsed = originalSimulation.getTotalGasUsed()
  const optimizedGasUsed = optimizedSimulation.getTotalGasUsed()
  const gasDifference = optimizedGasUsed - originalGasUsed
  const percentageChange =
    (Number(gasDifference) / Number(originalGasUsed)) * 100

  // Determine if access list is beneficial (considering a small threshold)
  const significantThreshold = 1000n // 1000 gas threshold
  let isBeneficial: boolean
  let recommendation: GasComparisonAnalysis['comparison']['recommendation']

  if (gasDifference < -significantThreshold) {
    isBeneficial = true
    recommendation = 'use-access-list'
  } else if (gasDifference > significantThreshold) {
    isBeneficial = false
    recommendation = 'skip-access-list'
  } else {
    isBeneficial = false
    recommendation = 'neutral'
  }

  return {
    originalSimulation,
    optimizedSimulation,
    accessListData,
    comparison: {
      originalGasUsed,
      optimizedGasUsed,
      gasDifference: BigInt(gasDifference),
      percentageChange,
      isBeneficial,
      recommendation,
      status: 'success',
    },
  }
}

/**
 * Create failed gas comparison when optimization couldn't be performed
 */
function _createFailedGasComparison(
  originalSimulation: ExtendedSimulationResult,
  accessListData: ExtendedAccessListResponse,
  error: string,
): GasComparisonAnalysis {
  return {
    originalSimulation,
    accessListData,
    comparison: {
      originalGasUsed: originalSimulation.getTotalGasUsed(),
      recommendation: 'unknown',
      status: 'failed',
      error,
    },
  }
}

/**
 * Load transaction data from hash using viem to get original transaction parameters
 * This is different from trace data - it gets the actual transaction parameters
 */
export async function loadTransactionFromHash(
  client: AltitraceClient,
  txHash: string,
): Promise<{
  to: string
  from: string
  data: string
  value: string
  gas: string
  gasPrice?: string
  maxFeePerGas?: string
  maxPriorityFeePerGas?: string
  nonce: number
  success: boolean
  gasUsed: string
  transactionType?: string
}> {
  // Get the viem client from the Altitrace client
  const viemClient = (client as any).viemClient
  if (!viemClient) {
    throw new Error(
      'Viem client is required to load transaction data. Falling back to trace data.',
    )
  }

  try {
    // Fetch both transaction and receipt data
    const [transaction, receipt] = await Promise.all([
      viemClient.getTransaction({ hash: txHash as `0x${string}` }),
      viemClient
        .getTransactionReceipt({ hash: txHash as `0x${string}` })
        .catch(() => null),
    ])

    return {
      to: transaction.to || '',
      from: transaction.from,
      data: transaction.input || '0x',
      value: `0x${transaction.value.toString(16)}`,
      gas: `0x${transaction.gas.toString(16)}`,
      gasPrice: transaction.gasPrice
        ? `0x${transaction.gasPrice.toString(16)}`
        : undefined,
      maxFeePerGas: transaction.maxFeePerGas
        ? `0x${transaction.maxFeePerGas.toString(16)}`
        : undefined,
      maxPriorityFeePerGas: transaction.maxPriorityFeePerGas
        ? `0x${transaction.maxPriorityFeePerGas.toString(16)}`
        : undefined,
      nonce: Number(transaction.nonce),
      success: receipt?.status === 'success',
      gasUsed: receipt ? `0x${receipt.gasUsed.toString(16)}` : '0x0',
      transactionType: transaction.type || 'legacy',
    }
  } catch (_error) {
    // Fallback to trace data if viem fails

    const trace = await client.traceTransaction(txHash)

    if (!trace.callTracer?.rootCall) {
      throw new Error('No call data found in transaction trace')
    }

    const rootCall = trace.callTracer.rootCall

    return {
      to: rootCall.to || '',
      from: rootCall.from,
      data: rootCall.input, // This IS the calldata!
      value: rootCall.value,
      gas: rootCall.gasUsed, // Note: this is gasUsed, not gasLimit from original tx
      gasUsed: rootCall.gasUsed,
      nonce: 0, // Not available in trace
      success: !rootCall.reverted,
    }
  }
}

/**
 * Execute transaction trace for an existing transaction hash with automatic ABI fetching
 * This traces the original transaction and attempts to decode events using fetched ABIs
 */
export async function executeTransactionTrace(
  client: AltitraceClient,
  txHash: string,
): Promise<EnhancedTraceResult> {
  try {
    // Execute the trace
    const traceResult = await client
      .trace()
      .transaction(txHash)
      .withCallTracer({ onlyTopCall: false, withLogs: true })
      .with4ByteTracer()
      .execute()

    // Extract basic information from trace
    const rootCall = traceResult.callTracer?.rootCall
    const success = rootCall ? !rootCall.reverted : true
    const gasUsed = rootCall ? BigInt(rootCall.gasUsed) : 0n
    const errors = traceResult.getErrors()

    // Extract contract addresses for ABI fetching
    const contractAddresses = extractContractAddressesFromTrace(traceResult)

    // Fetch contracts and ABIs (in parallel with rate limiting)
    let fetchedContracts: ContractFetchResult[] = []
    let combinedABI: Abi | null = null
    let decodedEvents: any[] = []

    if (contractAddresses.length > 0) {
      try {
        const contractResults =
          await fetchContractsWithRateLimit(contractAddresses)
        fetchedContracts = contractResults

        if (fetchedContracts.length > 0) {
          combinedABI = createCombinedABIFromContracts(fetchedContracts)

          // Decode events if we have ABIs and logs
          if (combinedABI && rootCall?.logs && rootCall.logs.length > 0) {
            decodedEvents = await decodeEventsFromLogs(
              rootCall.logs,
              combinedABI,
            )
          }
        }
      } catch (abiError) {
        console.warn(`⚠️ [Transaction Trace] ABI fetching failed:`, abiError)
        // Continue without ABI decoding - not critical for trace functionality
      }
    }

    const enhancedResult: EnhancedTraceResult = {
      traceData: traceResult,
      hasCallHierarchy: !!rootCall,
      transactionHash: txHash,
      success,
      gasUsed,
      errors,
      status: errors.length > 0 ? 'failed' : success ? 'success' : 'reverted',
      type: 'trace',
      isTraceResult: true,
      receipt: traceResult.receipt
        ? {
            blockNumber: BigInt((traceResult.receipt as any).blockNumber || 0),
            blockHash: (traceResult.receipt as any).blockHash || '',
            transactionIndex:
              (traceResult.receipt as any).transactionIndex || 0,
            effectiveGasPrice: BigInt(
              (traceResult.receipt as any).effectiveGasPrice || 0,
            ),
            contractAddress:
              (traceResult.receipt as any).contractAddress || undefined,
            blockGasUsed: (traceResult.receipt as any).blockGasUsed
              ? BigInt((traceResult.receipt as any).blockGasUsed)
              : undefined,
            blockGasLimit: (traceResult.receipt as any).blockGasLimit
              ? BigInt((traceResult.receipt as any).blockGasLimit)
              : undefined,
            baseFeePerGas: (traceResult.receipt as any).baseFeePerGas
              ? BigInt((traceResult.receipt as any).baseFeePerGas)
              : undefined,
          }
        : undefined,
      fetchedContracts:
        fetchedContracts.length > 0 ? fetchedContracts : undefined,
      combinedABI: combinedABI || undefined,
      decodedEvents: decodedEvents.length > 0 ? decodedEvents : undefined,
    }

    return enhancedResult
  } catch (error) {
    console.error(
      `❌ [Transaction Trace] Failed to trace transaction ${txHash}:`,
      error,
    )
    throw error
  }
}

/**
 * Extract contract addresses from trace data
 */
function extractContractAddressesFromTrace(
  traceData: ExtendedTracerResponse,
): string[] {
  const addresses = new Set<string>()

  // Recursively extract addresses from all calls and their logs
  const extractFromCallAndLogs = (call: any) => {
    // Extract from logs in this call
    if (call.logs && call.logs.length > 0) {
      for (const log of call.logs) {
        if (log.address) {
          addresses.add(log.address.toLowerCase())
        }
      }
    }

    // Extract contract address being called (but skip static calls for ABI fetching)
    if (call.to && call.to !== '0x' && call.to.length === 42) {
      // Only add non-static call addresses for ABI fetching since static calls don't emit events
      if (call.callType !== 'STATICCALL') {
        addresses.add(call.to.toLowerCase())
      }
    }

    // Recurse into nested calls
    if (call.calls && call.calls.length > 0) {
      for (const nestedCall of call.calls) {
        extractFromCallAndLogs(nestedCall)
      }
    }
  }

  if (traceData.callTracer?.rootCall) {
    extractFromCallAndLogs(traceData.callTracer.rootCall)
  }

  return Array.from(addresses)
}

/**
 * Fetch contracts with rate limiting to avoid overwhelming block explorers
 */
async function fetchContractsWithRateLimit(
  addresses: string[],
): Promise<ContractFetchResult[]> {
  const results: ContractFetchResult[] = []

  // Fetch with rate limiting - process in batches of 2
  const batchSize = 2
  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize)

    const batchPromises = batch.map(async (address) => {
      try {
        const contract = await ContractFetcher.fetchContract(
          address,
          'hyperscan',
        )
        if (contract.abi && contract.abi.length > 0) {
          results.push(contract)
        }
      } catch (error) {
        console.warn(
          `❌ [Contract Fetcher] Failed to fetch ${address}:`,
          error instanceof Error ? error.message : error,
        )
      }
    })

    await Promise.all(batchPromises)

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < addresses.length) {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  return results
}

/**
 * Create a combined ABI from multiple fetched contracts for event decoding
 */
function createCombinedABIFromContracts(
  contracts: ContractFetchResult[],
): Abi | null {
  if (contracts.length === 0) return null

  // Combine all events from all ABIs
  const combinedEvents: any[] = []
  const seenSignatures = new Set<string>()

  for (const contract of contracts) {
    // Use combinedAbi if available (for proxy contracts), otherwise use regular abi
    const abi = contract.combinedAbi || contract.abi
    const events = abi.filter((item: any) => item.type === 'event')

    for (const event of events) {
      // Type guard to ensure this is an AbiEvent
      if (event.type === 'event' && 'name' in event && 'inputs' in event) {
        // Create a signature to avoid duplicates
        const signature = `${event.name}(${event.inputs?.map((i: any) => i.type).join(',') || ''})`

        if (!seenSignatures.has(signature)) {
          seenSignatures.add(signature)
          combinedEvents.push(event)
        }
      }
    }
  }

  if (combinedEvents.length === 0) return null

  return combinedEvents as Abi
}

/**
 * Decode events from raw logs using provided ABI
 * This is a simplified implementation - in production you'd use proper ABI decoding libraries
 */
async function decodeEventsFromLogs(logs: any[], abi: Abi): Promise<any[]> {
  const decodedEvents: any[] = []

  // Create a map of event signatures to ABI entries for faster lookup
  const eventMap = new Map<string, any>()

  for (const abiEntry of abi) {
    if (abiEntry.type === 'event' && abiEntry.inputs) {
      // Create event signature hash (topic0)
      const signature = `${abiEntry.name}(${abiEntry.inputs.map((input: any) => input.type).join(',')})`
      try {
        // For now, we'll use a simple approach - in a real implementation,
        // you'd want to use proper ABI encoding libraries like viem
        eventMap.set(signature, abiEntry)
      } catch (error) {
        console.warn(
          `Failed to process event signature for ${abiEntry.name}:`,
          error,
        )
      }
    }
  }

  // Process each log
  for (const log of logs) {
    if (!log.topics || log.topics.length === 0) continue

    try {
      // For now, create a basic decoded event structure
      // In a full implementation, you'd use proper ABI decoding libraries like viem
      const decodedEvent = {
        address: log.address,
        topics: log.topics,
        data: log.data,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        transactionIndex: log.transactionIndex,
        logIndex: log.logIndex,
        // Add basic decoded info - this is a simplified version
        eventName: 'Unknown Event', // Would be decoded from topic0
        args: {}, // Would contain decoded parameters
        signature: log.topics[0], // topic0 is the event signature hash
      }

      decodedEvents.push(decodedEvent)
    } catch (error) {
      console.warn(`Failed to decode log:`, error)
      // Add the raw log as fallback
      decodedEvents.push({
        ...log,
        eventName: 'Raw Log',
        args: { data: log.data },
        signature: log.topics?.[0] || 'unknown',
      })
    }
  }

  return decodedEvents
}
