/**
 * Response processing utilities for the Altitrace SDK.
 *
 * This module provides utilities for processing and enhancing API responses,
 * adding computed properties and utility methods for easier consumption.
 */

import type {
  Address,
  AssetChange,
  AssetChangeSummary,
  BatchSimulationResult,
  CallError,
  CallResult,
  DecodedEvent,
  EnhancedLog,
  ExtendedSimulationResult,
  SimulationResult,
} from '@sdk/types'

/**
 * Extended simulation result implementation with utility methods.
 */
class ExtendedSimulationResultImpl implements ExtendedSimulationResult {
  public readonly simulationId: string
  public readonly blockNumber: string
  public readonly status: SimulationResult['status']
  public readonly calls: CallResult[]
  public readonly gasUsed: string
  public readonly blockGasUsed: string
  public readonly assetChanges: AssetChange[] | null | undefined

  constructor(result: SimulationResult) {
    this.simulationId = result.simulationId
    this.blockNumber = result.blockNumber
    this.status = result.status
    this.calls = result.calls
    this.gasUsed = result.gasUsed
    this.blockGasUsed = result.blockGasUsed
    this.assetChanges = result.assetChanges ?? undefined
  }

  /**
   * Check if the simulation was successful.
   * @returns True if all calls succeeded
   */
  public isSuccess(): boolean {
    return this.status === 'success'
  }

  /**
   * Check if the simulation failed.
   * @returns True if any call failed or reverted
   */
  public isFailed(): boolean {
    return this.status === 'failed' || this.status === 'reverted'
  }

  /**
   * Get all errors from failed calls.
   * @returns Array of call errors
   */
  public getErrors(): CallError[] {
    return this.calls
      .map((call) => call.error)
      .filter((error): error is CallError => error !== undefined)
  }

  /**
   * Get total gas used as a bigint.
   * @returns Total gas used as a bigint
   */
  public getTotalGasUsed(): bigint {
    return BigInt(this.gasUsed)
  }

  /**
   * Get gas used by a specific call.
   * @param callIndex - Index of the call
   * @returns Gas used by the call as bigint
   */
  public getCallGasUsed(callIndex: number): bigint {
    const call = this.calls[callIndex]
    if (!call) {
      throw new Error(`Call at index ${callIndex} not found`)
    }
    return BigInt(call.gasUsed)
  }

  /**
   * Get the total number of logs across all calls.
   * @returns Total number of logs
   */
  public getLogCount(): number {
    return this.calls.reduce((acc, call) => acc + call.logs.length, 0)
  }

  /**
   * Get decoded events from all logs.
   * @returns Array of decoded events
   */
  public getDecodedEvents(): DecodedEvent[] {
    const decodedEvents: DecodedEvent[] = []

    for (const call of this.calls) {
      for (const log of call.logs) {
        if (log.decoded) {
          decodedEvents.push(log.decoded)
        }
      }
    }

    return decodedEvents
  }

  /**
   * Filter logs by contract address.
   * @param address - Contract address to filter by
   * @returns Array of logs from the specified address
   */
  public getLogsByAddress(address: Address): EnhancedLog[] {
    const logs: EnhancedLog[] = []

    for (const call of this.calls) {
      for (const log of call.logs) {
        if (log.address.toLowerCase() === address.toLowerCase()) {
          logs.push(log)
        }
      }
    }

    return logs
  }

  /**
   * Get asset changes summary.
   * @returns Formatted asset changes array
   */
  public getAssetChangesSummary(): AssetChangeSummary[] {
    if (!this.assetChanges || this.assetChanges.length === 0) {
      return []
    }

    return this.assetChanges.map((change) => {
      const preBN = BigInt(change.value.pre)
      const postBN = BigInt(change.value.post)
      const diffBN = postBN - preBN

      return {
        tokenAddress: change.token.address as Address,
        symbol: change.token.symbol || undefined,
        decimals: change.token.decimals || undefined,
        netChange: diffBN >= 0 ? `+${diffBN.toString()}` : diffBN.toString(),
        type: diffBN >= 0 ? ('gain' as const) : ('loss' as const),
      }
    })
  }
}

/**
 * Response processor for simulation results and other API responses.
 */
export const ResponseProcessor = {
  /**
   * Process a simulation result to add utility methods and computed properties.
   * @param result - Raw simulation result from API
   * @returns Extended simulation result with utility methods
   */
  processSimulationResult(result: SimulationResult): ExtendedSimulationResult {
    return new ExtendedSimulationResultImpl(result)
  },

  /**
   * Process a batch of simulation results.
   * @param results - Array of simulation results
   * @returns Batch result with aggregated metadata
   */
  processBatchResults(
    results: readonly SimulationResult[],
  ): BatchSimulationResult {
    const processedResults = results.map((result) =>
      ResponseProcessor.processSimulationResult(result),
    )

    const successCount = processedResults.filter((result) =>
      result.isSuccess(),
    ).length
    const failureCount = results.length - successCount

    // Calculate total execution time from performance data
    const totalExecutionTime = processedResults.reduce((total, _result) => {
      return total
    }, 0)

    const batchStatus: 'success' | 'partial' | 'failed' =
      failureCount === 0 ? 'success' : successCount === 0 ? 'failed' : 'partial'

    return {
      results: processedResults,
      batchStatus,
      totalExecutionTime,
      successCount,
      failureCount,
    }
  },

  /**
   * Extract and format event information from logs.
   * @param result - Simulation result
   * @returns Formatted event information
   */
  extractEvents(result: SimulationResult): EventSummary[] {
    const events: EventSummary[] = []

    for (const [callIndex, call] of result.calls.entries()) {
      for (const [logIndex, log] of call.logs.entries()) {
        const decoded = !log.decoded
          ? undefined
          : ({
              name: log.decoded.name,
              signature: log.decoded.signature,
              params: log.decoded.params.map(
                (param) =>
                  ({
                    name: param.name,
                    type: param.paramType,
                    value: param.value,
                    indexed: param.indexed,
                  }) as const,
              ),
              summary: log.decoded.summary,
            } as const)

        const eventSummary: EventSummary = {
          callIndex,
          logIndex,
          contractAddress: log.address as Address,
          topics: log.topics,
          data: log.data,
          decoded,
        }

        events.push(eventSummary)
      }
    }

    return events
  },

  /**
   * Check if a simulation result indicates a successful transaction.
   * @param result - Simulation result to check
   * @returns True if the simulation represents a successful transaction
   */
  isSuccessful(result: SimulationResult): boolean {
    return (
      result.status === 'success' &&
      result.calls.every((call) => call.status === 'success')
    )
  },

  /**
   * Extract error information from a failed simulation result.
   * @param result - Simulation result to analyze
   * @returns Array of error summaries
   */
  extractErrors(result: SimulationResult): ErrorSummary[] {
    const errors: ErrorSummary[] = []

    for (const [callIndex, call] of result.calls.entries()) {
      if (call.error) {
        errors.push({
          callIndex,
          errorType: call.error.errorType,
          reason: call.error.reason,
          message: call.error.message || undefined,
          contractAddress: call.error.contractAddress
            ? (call.error.contractAddress as Address)
            : undefined,
        })
      }
    }

    return errors
  },

  /**
   * Compare two simulation results to identify differences.
   * @param before - First simulation result
   * @param after - Second simulation result
   * @returns Comparison summary
   */
  compareResults(
    before: SimulationResult,
    after: SimulationResult,
  ): SimulationComparison {
    const beforeGas = Number.parseInt(before.gasUsed.replace('0x', ''), 16)
    const afterGas = Number.parseInt(after.gasUsed.replace('0x', ''), 16)
    const gasDiff = afterGas - beforeGas

    const statusChanged = before.status !== after.status
    const callsChanged =
      before.calls.length !== after.calls.length ||
      before.calls.some((call, index) => {
        const afterCall = after.calls[index]
        return !afterCall || call.status !== afterCall.status
      })

    return {
      gasUsageChange: {
        before: beforeGas,
        after: afterGas,
        difference: gasDiff,
        percentChange: beforeGas > 0 ? (gasDiff / beforeGas) * 100 : 0,
      },
      statusChanged,
      callsChanged,
      hasAssetChanges: {
        before: Boolean(before.assetChanges?.length),
        after: Boolean(after.assetChanges?.length),
      },
    }
  },
}

/**
 * Gas usage breakdown information.
 */
export interface GasUsageBreakdown {
  /** Total gas used across all calls */
  readonly totalGasUsed: number

  /** Total gas used in the block */
  readonly blockGasUsed: number

  /** Gas usage per call */
  readonly callGasUsage: ReadonlyArray<{
    readonly callIndex: number
    readonly gasUsed: number
    readonly status: string
  }>

  /** Detailed gas breakdown if available */
  readonly breakdown?:
    | {
        readonly intrinsic: number
        readonly computation: number
        readonly storage: {
          readonly reads: number
          readonly writes: number
        }
        readonly memory: number
        readonly logs: number
        readonly calls: number
        readonly creates: number
        readonly refund: number
        readonly accessList: number
      }
    | undefined
}

/**
 * Event summary information.
 */
export interface EventSummary {
  /** Index of the call that emitted this event */
  readonly callIndex: number

  /** Index of the log within the call */
  readonly logIndex: number

  /** Contract address that emitted the event */
  readonly contractAddress: Address

  /** Raw event topics */
  readonly topics: readonly string[]

  /** Raw event data */
  readonly data: string

  /** Decoded event information if available */
  readonly decoded?:
    | {
        readonly name: string
        readonly signature: string
        readonly params: ReadonlyArray<{
          readonly name: string
          readonly type: string
          readonly value: string
          readonly indexed: boolean
        }>
        readonly summary: string
      }
    | undefined
}

/**
 * Error summary information.
 */
export interface ErrorSummary {
  /** Index of the call that failed */
  readonly callIndex: number

  /** Type of error */
  readonly errorType: string

  /** Human-readable error reason */
  readonly reason: string

  /** Detailed error message */
  readonly message?: string | undefined

  /** Contract address where error occurred */
  readonly contractAddress?: Address | undefined
}

/**
 * Simulation comparison result.
 */
export interface SimulationComparison {
  /** Gas usage comparison */
  readonly gasUsageChange: {
    readonly before: number
    readonly after: number
    readonly difference: number
    readonly percentChange: number
  }

  /** Whether the overall status changed */
  readonly statusChanged: boolean

  /** Whether any call results changed */
  readonly callsChanged: boolean

  /** Asset changes presence comparison */
  readonly hasAssetChanges: {
    readonly before: boolean
    readonly after: boolean
  }
}
