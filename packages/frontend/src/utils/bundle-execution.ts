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
import {
  parseNativeTransfers,
  parseTokenTransfersFromLogs,
  getTokenMetadata,
  HARDCODED_TOKEN_DATA,
} from './trace-integration'

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
 * Parse asset changes for a single transaction in a bundle
 */
async function parseTransactionAssetChanges(
  traceData: any,
  targetAccount: string,
  txIndex: number,
): Promise<Array<{ address: string; change: bigint }>> {
  try {
    const allChanges = new Map<string, bigint>()

    // 1. Parse native HYPE transfers from trace data
    if (traceData?.callTracer?.rootCall) {
      const nativeChanges = parseNativeTransfers(traceData, targetAccount)

      for (const change of nativeChanges) {
        const existing = allChanges.get(change.address) || BigInt(0)
        allChanges.set(change.address, existing + change.change)
      }
    }

    // 2. Parse ERC-20/ERC-721 Transfer events from logs
    const logs = traceData?.getAllLogs
      ? traceData.getAllLogs()
      : traceData?.callTracer?.rootCall
        ? extractLogsFromCalls([traceData.callTracer.rootCall])
        : []

    if (logs.length > 0) {
      const tokenChanges = parseTokenTransfersFromLogs(logs, targetAccount)

      for (const change of tokenChanges) {
        const existing = allChanges.get(change.address) || BigInt(0)
        allChanges.set(change.address, existing + change.change)
      }
    }

    // Convert to array format
    const result = Array.from(allChanges.entries()).map(
      ([address, change]) => ({ address, change }),
    )

    return result
  } catch (error) {
    console.warn(
      `⚠️ [Bundle Asset Tracking] Failed to parse asset changes for transaction ${txIndex + 1}:`,
      error,
    )
    return []
  }
}

/**
 * Aggregate asset changes across all transactions in a bundle
 */
async function aggregateBundleAssetChanges(
  transactionResults: BundleTransactionResult[],
  targetAccount: string,
): Promise<any[]> {
  try {
    const bundleChanges = new Map<string, { address: string; change: bigint }>()

    // Process each successful transaction
    for (let i = 0; i < transactionResults.length; i++) {
      const txResult = transactionResults[i]

      if (txResult.status !== 'success' || !txResult.traceData) {
        continue
      }

      const txChanges = await parseTransactionAssetChanges(
        txResult.traceData,
        targetAccount,
        i,
      )

      // Aggregate changes across all transactions
      for (const change of txChanges) {
        const existing = bundleChanges.get(change.address) || {
          address: change.address,
          change: BigInt(0),
        }
        existing.change += change.change
        bundleChanges.set(change.address, existing)
      }
    }

    // Convert to final format with metadata
    const assetChanges: any[] = []

    for (const [address, changeData] of bundleChanges.entries()) {
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
        // Flat format for UI compatibility
        tokenAddress: address,
        symbol: metadata.symbol,
        decimals: metadata.decimals || 18,
        netChange: absChange.toString(),
        type: changeType,

        // Legacy nested format for compatibility
        token: {
          address: address,
          symbol: metadata.symbol,
          name: metadata.name,
          decimals: metadata.decimals || 18,
        },
        value: {
          pre: '0',
          post: changeData.change.toString(),
          diff: changeData.change.toString(),
        },
      })
    }

    return assetChanges
  } catch (error) {
    console.warn(
      '⚠️ [Bundle Asset Tracking] Failed to aggregate bundle asset changes:',
      error,
    )
    return []
  }
}

/**
 * Execute a bundle simulation using the trace API
 */
export async function executeBundleSimulation(
  client: InstanceType<typeof AltitraceClient>,
  request: BundleSimulationRequest,
): Promise<BundleSimulationResult> {
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

    // Execute bundle using trace API directly (the builder pattern has issues with state context)
    const rawTraceResult = await client.traceCallMany(bundles, {
      stateContext: {
        block: request.blockNumber || request.blockTag || 'latest',
        // txIndex omitted - API should default to end of block for trace operations
      },
      callTracer: true,
      fourByteTracer: true,
      prestateTracer: {
        diffMode: true,
        disableCode: false,
        disableStorage: false,
      },
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
        // Asset changes for this specific transaction (will be populated later)
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

      // Check if we should continue on failure
      if (status === 'failed' && !bundleTx.continueOnFailure) {
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

    // Calculate bundle-level asset changes if an account is specified
    let bundleAssetChanges: any[] = []
    if (request.account && request.traceAssetChanges) {
      try {
        bundleAssetChanges = await aggregateBundleAssetChanges(
          transactionResults,
          request.account,
        )
      } catch (error) {
        console.warn(
          '⚠️ [Bundle Simulation] Failed to calculate bundle asset changes:',
          error,
        )
      }
    }

    // Calculate per-transaction asset changes if account is specified
    if (request.account && request.traceAssetChanges) {
      for (let i = 0; i < transactionResults.length; i++) {
        const txResult = transactionResults[i]
        if (txResult.status === 'success' && txResult.traceData) {
          try {
            const txChanges = await parseTransactionAssetChanges(
              txResult.traceData,
              request.account,
              i,
            )

            // Convert to UI format
            const formattedChanges: any[] = []
            for (const change of txChanges) {
              if (change.change === BigInt(0)) continue

              const metadata = await getTokenMetadata(change.address)
              const changeType = change.change > 0n ? 'gain' : 'loss'
              const absChange =
                change.change < 0n ? -change.change : change.change

              formattedChanges.push({
                tokenAddress: change.address,
                symbol: metadata.symbol,
                decimals: metadata.decimals || 18,
                netChange: absChange.toString(),
                type: changeType,
                token: {
                  address: change.address,
                  symbol: metadata.symbol,
                  name: metadata.name,
                  decimals: metadata.decimals || 18,
                },
                value: {
                  pre: '0',
                  post: change.change.toString(),
                  diff: change.change.toString(),
                },
              })
            }

            txResult.assetChanges = formattedChanges
          } catch (error) {
            console.warn(
              `⚠️ [Bundle Simulation] Failed to calculate asset changes for transaction ${i + 1}:`,
              error,
            )
          }
        }
      }
    }

    const result: BundleSimulationResult = {
      bundleId,
      bundleStatus,
      blockNumber: request.blockNumber || request.blockTag || 'latest',
      totalGasUsed: '0x' + totalGasUsed.toString(16),
      transactionResults,
      executionTimeMs,
      bundleAssetChanges,
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
