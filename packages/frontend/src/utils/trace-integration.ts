import type { AltitraceClient } from '@altitrace/sdk/client/altitrace'
import type {
  AccessListComparisonResult,
  ExtendedAccessListResponse,
  ExtendedSimulationResult,
  ExtendedTracerResponse,
  SimulationRequest,
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

    // Create legacy gas comparison from the new comparison result
    let gasComparison: GasComparisonAnalysis | undefined
    if (accessListComparison?.success.baseline) {
      gasComparison = createGasComparisonFromComparison(accessListComparison)
    }

    // Combine results
    const enhancedResult: EnhancedSimulationResult = {
      ...simulationResult,
      traceData: traceResult || undefined,
      accessListData: accessListComparison?.accessListData || undefined,
      gasComparison,
      accessListComparison: accessListComparison || undefined,
      hasCallHierarchy: !!traceResult?.callTracer?.rootCall,
      hasAccessList: !!accessListComparison?.success.accessList,
      hasGasComparison: !!accessListComparison?.success.baseline,
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
  console.log(`🔍 [Transaction Trace] Starting trace for ${txHash}`)

  try {
    // Execute the trace
    const traceResult = await client
      .trace()
      .transaction(txHash)
      .withCallTracer({ onlyTopCall: false, withLogs: true })
      .with4ByteTracer()
      .execute()

    console.log('✅ [Transaction Trace] Trace completed successfully')

    // Extract basic information from trace
    const rootCall = traceResult.callTracer?.rootCall
    const success = rootCall ? !rootCall.reverted : true
    const gasUsed = rootCall ? BigInt(rootCall.gasUsed) : 0n
    const errors = traceResult.getErrors()

    // Extract contract addresses for ABI fetching
    const contractAddresses = extractContractAddressesFromTrace(traceResult)
    console.log(
      `🔍 [Transaction Trace] Found ${contractAddresses.length} contract addresses:`,
      contractAddresses,
    )

    // Fetch contracts and ABIs (in parallel with rate limiting)
    let fetchedContracts: ContractFetchResult[] = []
    let combinedABI: Abi | null = null
    let decodedEvents: any[] = []

    if (contractAddresses.length > 0) {
      console.log(
        `🔍 [Transaction Trace] Starting ABI fetch for addresses:`,
        contractAddresses,
      )
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
            console.log(
              `🎯 [Transaction Trace] Decoded ${decodedEvents.length} events`,
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

    console.log(
      `🎉 [Transaction Trace] Enhanced trace result created with ${fetchedContracts.length} contracts and ${decodedEvents.length} decoded events`,
    )

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

  console.log(
    `🔍 [extractContractAddressesFromTrace] Found addresses:`,
    Array.from(addresses),
  )
  return Array.from(addresses)
}

/**
 * Fetch contracts with rate limiting to avoid overwhelming block explorers
 */
async function fetchContractsWithRateLimit(
  addresses: string[],
): Promise<ContractFetchResult[]> {
  const results: ContractFetchResult[] = []

  console.log(
    `🔍 [Contract Fetcher] Fetching contracts for ${addresses.length} addresses...`,
  )

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
          console.log(
            `✅ [Contract Fetcher] Found ABI for ${address} (${contract.explorerSource})`,
          )
        } else {
          console.log(`⚠️ [Contract Fetcher] No ABI found for ${address}`)
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

  console.log(
    `🎯 [Contract Fetcher] Successfully fetched ${results.length} contracts with ABIs`,
  )

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

  console.log(
    `🔧 [Contract Fetcher] Created combined ABI with ${combinedEvents.length} events`,
  )

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
