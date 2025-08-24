/**
 * @fileoverview Bundle simulation execution utilities
 */

import { AltitraceClient } from '@altitrace/sdk'
import type {
  TracerResponse,
  ExtendedTracerResponse,
} from '@altitrace/sdk/types'
import { extendTracerResponse } from './trace-helpers'

// Define types that aren't exported from SDK index
interface Bundle {
  transactions: Array<{
    to: string
    from?: string
    data?: string
    value?: string
    gas?: string
  }>
}

type TracerManyResponse = ExtendedTracerResponse[]

import type {
  BundleSimulationRequest,
  BundleSimulationResult,
  BundleTransactionResult,
} from '@/types/bundle'
import type { EnhancedSimulationResult } from './trace-integration'

/**
 * Recursively extract logs from call trace hierarchy
 */
function extractLogsFromCalls(calls: any[]): any[] {
  const logs: any[] = []

  for (const call of calls) {
    // Add logs from this call
    if (call.logs && Array.isArray(call.logs)) {
      logs.push(...call.logs)
    }

    // Recursively extract from subcalls
    if (call.calls && Array.isArray(call.calls)) {
      logs.push(...extractLogsFromCalls(call.calls))
    }
  }

  return logs
}

/**
 * Execute a bundle simulation using the trace API
 */
export async function executeBundleSimulation(
  client: InstanceType<typeof AltitraceClient>,
  request: BundleSimulationRequest,
): Promise<BundleSimulationResult> {
  console.log('\n🔗 [Bundle Simulation] Starting bundle execution...')
  console.log('📋 Bundle details:')
  console.log('   Transactions:', request.transactions.length)
  console.log('   Block:', request.blockNumber || request.blockTag || 'latest')
  console.log('   Validation:', request.validation)

  const startTime = Date.now()
  const bundleId = crypto.randomUUID()

  try {
    // Convert bundle transactions to SDK Bundle format
    const bundles: Bundle[] = request.transactions.map((bundleTx) => {
      const transaction: any = {}

      // 'to' is required for a valid transaction
      if (bundleTx.transaction.to && bundleTx.transaction.to.trim() !== '') {
        transaction.to = bundleTx.transaction.to
      } else {
        throw new Error(
          `Transaction ${bundleTx.id} missing required 'to' address`,
        )
      }

      // Optional fields - only include if not empty and valid to avoid API parsing errors
      if (
        bundleTx.transaction.from &&
        bundleTx.transaction.from.trim() !== ''
      ) {
        transaction.from = bundleTx.transaction.from
      }
      if (
        bundleTx.transaction.data &&
        bundleTx.transaction.data.trim() !== ''
      ) {
        const data = bundleTx.transaction.data.trim()
        // Validate hex data has even number of digits to prevent API parsing errors
        const hexPart = data.startsWith('0x') ? data.slice(2) : data
        if (hexPart.length % 2 !== 0) {
          throw new Error(
            `Transaction ${bundleTx.id} has invalid call data: odd number of hex digits (${hexPart.length}). Add or remove one character to make it valid.`,
          )
        }
        transaction.data = data
      }
      if (
        bundleTx.transaction.value &&
        bundleTx.transaction.value.trim() !== ''
      ) {
        transaction.value = bundleTx.transaction.value
      }
      if (bundleTx.transaction.gas && bundleTx.transaction.gas.trim() !== '') {
        transaction.gas = bundleTx.transaction.gas
      }

      return {
        transactions: [transaction],
      }
    })

    console.log(
      '📡 [Bundle API] Calling traceCallMany with',
      bundles.length,
      'bundles...',
    )

    // Execute bundle using trace API directly (the builder pattern has issues with state context)
    const rawTraceResult = await client.traceCallMany(bundles, {
      stateContext: {
        block: request.blockNumber || request.blockTag || 'latest',
        // txIndex omitted - API should default to end of block for trace operations
      },
      callTracer: true,
      fourByteTracer: true,
      // Add state overrides if provided
      ...(request.stateOverrides &&
        request.stateOverrides.length > 0 && {
          stateOverrides: request.stateOverrides,
        }),
    })

    // Extend the raw responses with helper methods
    const traceResult: TracerManyResponse = rawTraceResult.map((response) =>
      extendTracerResponse(response),
    )

    console.log('✅ [Bundle API] Trace response received')
    console.log('   Results count:', traceResult.length)

    // Process results
    const transactionResults: BundleTransactionResult[] = []
    let totalGasUsed = BigInt(0)
    let successCount = 0
    let failureCount = 0

    for (let i = 0; i < request.transactions.length; i++) {
      const bundleTx = request.transactions[i]
      const traceResponse = traceResult[i]

      if (!traceResponse) {
        // Transaction was skipped or failed to execute
        transactionResults.push({
          transactionId: bundleTx.id,
          status: 'skipped',
          gasUsed: '0x0',
          logs: [],
        })
        continue
      }

      // Extract gas used and execution status from correct path
      const gasUsed = traceResponse.callTracer?.rootCall?.gasUsed || '0x0'
      const gasUsedBig = BigInt(gasUsed)
      totalGasUsed += gasUsedBig

      // Determine transaction status from rootCall
      let status: BundleTransactionResult['status'] = 'success'
      let error: BundleTransactionResult['error'] | undefined

      if (traceResponse.callTracer?.rootCall?.reverted) {
        status = 'failed'
        failureCount++
        error = {
          type: 'execution_reverted',
          reason: 'Transaction reverted',
          message: `Transaction ${i + 1} reverted during execution`,
        }
      } else {
        successCount++
      }

      // Extract logs from rootCall and its subcalls
      const rootLogs = traceResponse.callTracer?.rootCall?.logs || []
      const subCallLogs = extractLogsFromCalls(
        traceResponse.callTracer?.rootCall?.calls || [],
      )
      const logs = [...rootLogs, ...subCallLogs]

      transactionResults.push({
        transactionId: bundleTx.id,
        status,
        gasUsed,
        returnData: traceResponse.callTracer?.rootCall?.output,
        error,
        logs,
        // Asset changes would be populated here if available from trace response
        assetChanges: [],
        // Store full trace data for individual transaction analysis
        traceData: traceResponse,
        // Store original transaction details
        originalTransaction: {
          to: bundleTx.transaction.to || undefined,
          from: bundleTx.transaction.from || undefined,
          data: bundleTx.transaction.data || undefined,
          value: bundleTx.transaction.value || undefined,
          gas: bundleTx.transaction.gas || undefined,
        },
      })

      console.log(
        `   Transaction ${i + 1}: ${status} (gas: ${Number(gasUsedBig).toLocaleString()})`,
      )

      // Check if we should continue on failure
      if (status === 'failed' && !bundleTx.continueOnFailure) {
        console.log(
          `   🛑 Bundle execution stopped at transaction ${i + 1} (continue on failure: ${bundleTx.continueOnFailure})`,
        )

        // Mark remaining transactions as skipped
        for (let j = i + 1; j < request.transactions.length; j++) {
          const skippedTx = request.transactions[j]
          transactionResults.push({
            transactionId: skippedTx.id,
            status: 'skipped',
            gasUsed: '0x0',
            logs: [],
            originalTransaction: {
              to: skippedTx.transaction.to || undefined,
              from: skippedTx.transaction.from || undefined,
              data: skippedTx.transaction.data || undefined,
              value: skippedTx.transaction.value || undefined,
              gas: skippedTx.transaction.gas || undefined,
            },
          })
        }
        break
      }
    }

    // Determine overall bundle status
    let bundleStatus: BundleSimulationResult['bundleStatus']
    if (successCount === request.transactions.length) {
      bundleStatus = 'success'
    } else if (successCount > 0) {
      bundleStatus = 'partial_success'
    } else {
      bundleStatus = 'failed'
    }

    const executionTimeMs = Date.now() - startTime

    console.log('📊 [Bundle Results]:')
    console.log('   Bundle status:', bundleStatus)
    console.log('   Success count:', successCount)
    console.log('   Failure count:', failureCount)
    console.log('   Total gas used:', totalGasUsed.toString())
    console.log('   Execution time:', executionTimeMs, 'ms')

    const result: BundleSimulationResult = {
      bundleId,
      bundleStatus,
      blockNumber: request.blockNumber || request.blockTag || 'latest',
      totalGasUsed: '0x' + totalGasUsed.toString(16),
      transactionResults,
      executionTimeMs,
      bundleAssetChanges: [], // Would be populated from trace analysis
      bundleErrors:
        failureCount > 0
          ? [`${failureCount} transaction(s) failed`]
          : undefined,
    }

    return result
  } catch (error) {
    const executionTimeMs = Date.now() - startTime

    console.error('❌ [Bundle Simulation] Execution failed:', error)

    // Return failed bundle result
    const transactionResults: BundleTransactionResult[] =
      request.transactions.map((tx) => ({
        transactionId: tx.id,
        status: 'failed',
        gasUsed: '0x0',
        logs: [],
        error: {
          type: 'bundle_execution_error',
          reason: error instanceof Error ? error.message : 'Unknown error',
          message: `Bundle execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        originalTransaction: {
          to: tx.transaction.to || undefined,
          from: tx.transaction.from || undefined,
          data: tx.transaction.data || undefined,
          value: tx.transaction.value || undefined,
          gas: tx.transaction.gas || undefined,
        },
      }))

    return {
      bundleId,
      bundleStatus: 'failed',
      blockNumber: request.blockNumber || 'latest',
      totalGasUsed: '0x0',
      transactionResults,
      executionTimeMs,
      bundleErrors: [
        error instanceof Error ? error.message : 'Bundle execution failed',
      ],
    }
  }
}

/**
 * Enhanced bundle simulation result with additional helper methods
 */
export interface EnhancedBundleSimulationResult extends BundleSimulationResult {
  /** Check if entire bundle was successful */
  isSuccess(): boolean
  /** Check if bundle completely failed */
  isFailed(): boolean
  /** Check if bundle had partial success */
  isPartialSuccess(): boolean
  /** Get total gas used as bigint */
  getTotalGasUsed(): bigint
  /** Get successful transaction count */
  getSuccessCount(): number
  /** Get failed transaction count */
  getFailureCount(): number
  /** Get all errors from failed transactions */
  getAllErrors(): string[]
}

/**
 * Enhance bundle simulation result with helper methods
 */
export function enhanceBundleSimulationResult(
  result: BundleSimulationResult,
): EnhancedBundleSimulationResult {
  return {
    ...result,
    isSuccess: () => result.bundleStatus === 'success',
    isFailed: () => result.bundleStatus === 'failed',
    isPartialSuccess: () => result.bundleStatus === 'partial_success',
    getTotalGasUsed: () => BigInt(result.totalGasUsed),
    getSuccessCount: () =>
      result.transactionResults.filter((tx) => tx.status === 'success').length,
    getFailureCount: () =>
      result.transactionResults.filter((tx) => tx.status === 'failed').length,
    getAllErrors: () => [
      ...(result.bundleErrors || []),
      ...result.transactionResults
        .filter((tx) => tx.error)
        .map((tx) => tx.error!.message),
    ],
  }
}
