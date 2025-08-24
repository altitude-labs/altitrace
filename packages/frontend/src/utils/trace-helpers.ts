/**
 * @fileoverview Trace data helpers for processing raw trace responses
 */

import type { TracerResponse, LogEntry } from '@altitrace/sdk/types'

/**
 * Extended tracer response with helper methods (compatible with SDK's ExtendedTracerResponse)
 */
export interface ExtendedTracerResponse extends TracerResponse {
  /** Check if the trace indicates successful execution */
  isSuccess(): boolean
  /** Check if the trace indicates failed execution */
  isFailed(): boolean
  /** Get total gas used from the trace */
  getTotalGasUsed(): bigint
  /** Get all error messages from the trace */
  getErrors(): string[]
  /** Get all log entries from the trace */
  getAllLogs(): LogEntry[]
  /** Get call count from call tracer */
  getCallCount(): number
  /** Get max call depth from call tracer */
  getMaxDepth(): number
  /** Get account addresses that were accessed */
  getAccessedAccounts(): string[]
  /** Get storage slots that were accessed */
  getAccessedStorageSlots(): Array<{ address: string; slot: string }>
  /** Get function signatures that were called (from 4byte tracer) */
  getFunctionSignatures(): string[]
}

/**
 * Extend a raw trace response with helper methods
 * (Similar to SDK's internal extendTracerResponse method)
 */
export function extendTracerResponse(
  response: TracerResponse,
): ExtendedTracerResponse {
  const extended = response as ExtendedTracerResponse

  // Add helper methods
  extended.isSuccess = () => {
    if (response.receipt) {
      return response.receipt.status
    }
    if (response.callTracer?.rootCall) {
      return !response.callTracer.rootCall.reverted
    }
    if (response.structLogger) {
      return !response.structLogger.error
    }
    return true
  }

  extended.isFailed = () => !extended.isSuccess()

  extended.getTotalGasUsed = () => {
    if (response.receipt) {
      return BigInt(response.receipt.gasUsed)
    }
    if (response.callTracer?.rootCall) {
      return BigInt(response.callTracer.rootCall.gasUsed)
    }
    if (response.structLogger) {
      return BigInt(response.structLogger.totalGas || '0x0')
    }
    return 0n
  }

  extended.getErrors = () => {
    const errors: string[] = []

    if (response.callTracer?.rootCall) {
      collectCallErrors(response.callTracer.rootCall, errors)
    }

    if (response.structLogger?.error) {
      errors.push(response.structLogger.error)
    }

    return errors
  }

  extended.getAllLogs = () => {
    const logs: LogEntry[] = []

    if (response.callTracer?.rootCall) {
      collectCallLogs(response.callTracer.rootCall, logs)
    }

    return logs
  }

  extended.getCallCount = () => {
    if (response.callTracer?.totalCalls !== undefined) {
      return response.callTracer.totalCalls
    }

    // Fallback: count calls in hierarchy
    if (response.callTracer?.rootCall) {
      return countCallsInHierarchy(response.callTracer.rootCall)
    }

    return 0
  }

  extended.getMaxDepth = () => {
    if (response.callTracer?.maxDepth !== undefined) {
      return response.callTracer.maxDepth
    }

    // Fallback: calculate depth from hierarchy
    if (response.callTracer?.rootCall) {
      return calculateMaxDepth(response.callTracer.rootCall, 0)
    }

    return 0
  }

  extended.getAccessedAccounts = () => {
    const accounts = new Set<string>()

    // TODO: Fix prestate tracer account access
    // The prestateTracer.accounts property needs proper typing
    // if (response.prestateTracer?.accounts) {
    //   for (const account of Object.keys(response.prestateTracer.accounts)) {
    //     accounts.add(account)
    //   }
    // }

    if (response.callTracer?.rootCall) {
      collectAccessedAccounts(response.callTracer.rootCall, accounts)
    }

    return Array.from(accounts)
  }

  extended.getAccessedStorageSlots = () => {
    const slots: Array<{ address: string; slot: string }> = []

    // TODO: Fix prestate tracer storage access
    // The prestateTracer.accounts property needs proper typing
    // if (response.prestateTracer?.accounts) {
    //   for (const [address, account] of Object.entries(
    //     response.prestateTracer.accounts,
    //   )) {
    //     if (account.storage) {
    //       for (const slot of Object.keys(account.storage)) {
    //         slots.push({ address, slot })
    //       }
    //     }
    //   }
    // }

    return slots
  }

  extended.getFunctionSignatures = () => {
    if (response['4byteTracer']) {
      return Object.keys(response['4byteTracer'])
    }
    return []
  }

  return extended
}

/**
 * Recursively collect errors from call hierarchy
 */
function collectCallErrors(call: any, errors: string[]): void {
  if (call.error) {
    errors.push(call.error)
  }

  if (call.calls && Array.isArray(call.calls)) {
    for (const subCall of call.calls) {
      collectCallErrors(subCall, errors)
    }
  }
}

/**
 * Recursively collect logs from call hierarchy
 */
function collectCallLogs(call: any, logs: LogEntry[]): void {
  if (call.logs && Array.isArray(call.logs)) {
    logs.push(...call.logs)
  }

  if (call.calls && Array.isArray(call.calls)) {
    for (const subCall of call.calls) {
      collectCallLogs(subCall, logs)
    }
  }
}

/**
 * Count total calls in call hierarchy
 */
function countCallsInHierarchy(call: any): number {
  let count = 1 // Count the current call

  if (call.calls && Array.isArray(call.calls)) {
    for (const subCall of call.calls) {
      count += countCallsInHierarchy(subCall)
    }
  }

  return count
}

/**
 * Calculate maximum depth in call hierarchy
 */
function calculateMaxDepth(call: any, currentDepth: number): number {
  let maxDepth = currentDepth

  if (call.calls && Array.isArray(call.calls)) {
    for (const subCall of call.calls) {
      const subDepth = calculateMaxDepth(subCall, currentDepth + 1)
      maxDepth = Math.max(maxDepth, subDepth)
    }
  }

  return maxDepth
}

/**
 * Collect accessed accounts from call hierarchy
 */
function collectAccessedAccounts(call: any, accounts: Set<string>): void {
  if (call.to) {
    accounts.add(call.to)
  }
  if (call.from) {
    accounts.add(call.from)
  }

  if (call.calls && Array.isArray(call.calls)) {
    for (const subCall of call.calls) {
      collectAccessedAccounts(subCall, accounts)
    }
  }
}
