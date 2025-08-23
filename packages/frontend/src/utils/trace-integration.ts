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

    // Execute simulation, trace, and access list comparison in parallel
    const [simulationResult, traceResult, accessListComparison] =
      await Promise.all([
        // Original simulation API
        client.executeSimulation(request),

        // Trace API for call hierarchy (fallback silently if not available)
        client
          .trace()
          .call(primaryCall)
          .atBlock(
            request.params.blockNumber || request.params.blockTag || 'latest',
          )
          .withCallTracer({ onlyTopCall: false, withLogs: true })
          .with4ByteTracer()
          .execute()
          .catch(() => null), // Silently fail if trace API not available

        // Access list comparison for gas optimization analysis
        client
          .compareAccessList()
          .call(primaryCall)
          .atBlock(
            request.params.blockNumber || request.params.blockTag || 'latest',
          )
          .withAssetChanges(request.params.traceAssetChanges ?? false)
          .withTransfers(request.params.traceTransfers ?? false)
          .withValidation(request.params.validation ?? true)
          .execute()
          .catch((_error) => {
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
 * Load transaction data from hash using trace API
 */
export async function loadTransactionFromHash(
  client: AltitraceClient,
  txHash: string,
): Promise<{
  to: string
  from: string
  data: string
  value: string
  gasUsed: string
  success: boolean
}> {
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
    gasUsed: rootCall.gasUsed,
    success: !rootCall.reverted,
  }
}
