import type { AltitraceClient } from '@altitrace/sdk/client/altitrace'
import type {
  AccessListComparisonResult,
  ExtendedAccessListResponse,
  ExtendedSimulationResult,
  ExtendedTracerResponse,
  SimulationRequest,
} from '@altitrace/sdk/types'

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
          
          let traceBuilder = client
            .trace()
            .call(primaryCall)
          
          // Add state overrides if available (must be called before other builder methods)
          if (request.options?.stateOverrides?.length) {
            
            // Convert array format to Record format expected by SDK
            const stateOverridesRecord: Record<string, typeof request.options.stateOverrides[0]> = {}
            request.options.stateOverrides.forEach(override => {
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
 * Execute transaction trace for an existing transaction hash
 * This traces the original transaction without simulation
 */
export async function executeTransactionTrace(
  client: AltitraceClient,
  txHash: string,
): Promise<EnhancedTraceResult> {
  try {
    const traceResult = await client
      .trace()
      .transaction(txHash)
      .withCallTracer({ onlyTopCall: false, withLogs: true })
      .with4ByteTracer()
      .withReceipt()
      .execute()
    
    // Extract basic information from trace
    const rootCall = traceResult.callTracer?.rootCall
    const success = rootCall ? !rootCall.reverted : true
    const gasUsed = rootCall ? BigInt(rootCall.gasUsed) : 0n
    const errors = traceResult.getErrors()
    
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
      receipt: traceResult.receipt ? {
        blockNumber: BigInt((traceResult.receipt as any).blockNumber || 0),
        blockHash: (traceResult.receipt as any).blockHash || '',
        transactionIndex: (traceResult.receipt as any).transactionIndex || 0,
        effectiveGasPrice: BigInt((traceResult.receipt as any).effectiveGasPrice || 0),
        contractAddress: (traceResult.receipt as any).contractAddress || undefined,
        blockGasUsed: (traceResult.receipt as any).blockGasUsed ? BigInt((traceResult.receipt as any).blockGasUsed) : undefined,
        blockGasLimit: (traceResult.receipt as any).blockGasLimit ? BigInt((traceResult.receipt as any).blockGasLimit) : undefined,
        baseFeePerGas: (traceResult.receipt as any).baseFeePerGas ? BigInt((traceResult.receipt as any).baseFeePerGas) : undefined,
      } : undefined,
    }
    
    return enhancedResult
  } catch (error) {
    throw error
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
    throw new Error('Viem client is required to load transaction data. Falling back to trace data.')
  }

  try {
    // Fetch both transaction and receipt data
    const [transaction, receipt] = await Promise.all([
      viemClient.getTransaction({ hash: txHash as `0x${string}` }),
      viemClient.getTransactionReceipt({ hash: txHash as `0x${string}` }).catch(() => null)
    ])

    return {
      to: transaction.to || '',
      from: transaction.from,
      data: transaction.input || '0x',
      value: `0x${transaction.value.toString(16)}`,
      gas: `0x${transaction.gas.toString(16)}`,
      gasPrice: transaction.gasPrice ? `0x${transaction.gasPrice.toString(16)}` : undefined,
      maxFeePerGas: transaction.maxFeePerGas ? `0x${transaction.maxFeePerGas.toString(16)}` : undefined,
      maxPriorityFeePerGas: transaction.maxPriorityFeePerGas ? `0x${transaction.maxPriorityFeePerGas.toString(16)}` : undefined,
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
