/**
 * @fileoverview Trace data helpers for processing raw trace responses
 */

import type { TracerResponse, LogEntry, StructLog, CallFrame } from '@altitrace/sdk/types'

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

/**
 * Storage operation interface for SSTORE/SLOAD opcodes
 */
export interface StorageOperation {
  opcode: 'SSTORE' | 'SLOAD'
  depth: number
  gas: number
  gasCost: number
  pc: number
  slot: string
  value?: string // For SSTORE operations (the value being stored)
  oldValue?: string // For SSTORE operations (previous value)
  contract: string // Contract address where storage operation occurred
  callIndex: number // Index to help match with call hierarchy
}

/**
 * Parse storage operations (SSTORE/SLOAD) from struct logger trace data
 * This extracts detailed storage operations similar to Tenderly's interface
 */
export function parseStorageOperations(
  traceData: TracerResponse,
  rootCall: CallFrame
): StorageOperation[] {
  if (!traceData.structLogger?.structLogs) {
    return []
  }

  const storageOps: StorageOperation[] = []
  
  // Create a simple mapping of depth to contract address using actual struct logs
  // This tracks what contract is executing at each depth based on the actual trace
  const depthToContract = new Map<number, string>()
  
  // Pre-process to map EVM execution depths to contract addresses
  for (let i = 0; i < traceData.structLogger.structLogs.length; i++) {
    const log = traceData.structLogger.structLogs[i]
    
    // Track depth changes - when we see certain opcodes, we know the contract context
    if (log.op === 'CALL' || log.op === 'STATICCALL' || log.op === 'DELEGATECALL') {
      // The target contract is in the stack - this is complex to extract from stack
      // For now, we'll rely on the call hierarchy we already have
      continue
    }
  }
  
  // Build a simple map of calls by depth for reference
  const callsByDepth = new Map<number, CallFrame[]>()
  
  function collectCallsByDepth(call: CallFrame, currentDepth: number) {
    if (call.to) {
      if (!callsByDepth.has(currentDepth)) {
        callsByDepth.set(currentDepth, [])
      }
      callsByDepth.get(currentDepth)!.push(call)
    }
    
    if (call.calls) {
      call.calls.forEach(subcall => {
        collectCallsByDepth(subcall, currentDepth + 1)
      })
    }
  }
  
  collectCallsByDepth(rootCall, 0)

  for (let i = 0; i < traceData.structLogger.structLogs.length; i++) {
    const log = traceData.structLogger.structLogs[i]
    
    // Only process storage operations
    if (log.op === 'SSTORE' || log.op === 'SLOAD') {
      // Get possible contracts at this depth
      const possibleCalls = callsByDepth.get(log.depth) || []
      
      // For now, take the first contract at this depth
      // This is a simplification but should work for most cases
      const contract = possibleCalls[0]?.to || rootCall.to || ''
      
      if (contract && log.stack && log.stack.length >= 1) {
        // For EVM stack, storage operations have:
        // SSTORE: stack[0] = slot, stack[1] = value (from bottom)
        // SLOAD: stack[0] = slot (from bottom)
        // Note: EVM stack is LIFO, so we access from the end
        const slot = log.stack[log.stack.length - 1] // Top of stack is the slot
        
        let value: string | undefined
        let oldValue: string | undefined
        
        if (log.op === 'SSTORE' && log.stack.length >= 2) {
          // For SSTORE: the new value is the second item from top
          value = log.stack[log.stack.length - 2]
          
          // Get the old value from storage state if available
          if (log.storage && slot) {
            oldValue = log.storage[slot]
          }
        } else if (log.op === 'SLOAD') {
          // For SLOAD: get the read value from the next operation's stack (if available)
          // The SLOAD pushes the read value onto the stack, so it appears as the top item in the next operation
          if (i + 1 < traceData.structLogger.structLogs.length) {
            const nextLog = traceData.structLogger.structLogs[i + 1]
            if (nextLog.stack && nextLog.stack.length > 0) {
              // The value that was read by SLOAD is now the top of the stack in the next operation
              value = nextLog.stack[nextLog.stack.length - 1]
            }
          }
        }

        storageOps.push({
          opcode: log.op as 'SSTORE' | 'SLOAD',
          depth: log.depth,
          gas: log.gas,
          gasCost: log.gasCost || 0,
          pc: log.pc,
          slot: formatStorageSlot(slot),
          value: value ? formatStorageValue(value) : undefined,
          oldValue: oldValue ? formatStorageValue(oldValue) : undefined,
          contract: contract,
          callIndex: log.depth // Use depth as call index
        })
      }
    }
  }

  return storageOps
}

/**
 * Update call stack based on current execution depth
 * This helps track which contract each storage operation belongs to
 */
function updateCallStack(
  callStack: Array<{ contract: string; depth: number; index: number }>,
  log: StructLog,
  rootCall: CallFrame
): void {
  // Remove calls that are deeper than current depth
  while (callStack.length > 0 && callStack[callStack.length - 1].depth > log.depth) {
    callStack.pop()
  }
  
  // This is a simplified approach - in reality, we'd need to track CALL opcodes
  // to properly maintain the call stack with contract addresses
  // For now, we'll use the depth to approximate the call structure
}

/**
 * Format storage slot for display (pad to 32 bytes if needed)
 */
function formatStorageSlot(slot: string): string {
  if (!slot || slot === '0x') return '0x0'
  
  // Ensure proper hex format
  if (!slot.startsWith('0x')) {
    slot = '0x' + slot
  }
  
  // Pad to 32 bytes (64 hex characters + 0x)
  if (slot.length < 66) {
    slot = '0x' + slot.slice(2).padStart(64, '0')
  }
  
  return slot
}

/**
 * Format storage value for display
 */
function formatStorageValue(value: string): string {
  if (!value || value === '0x') return '0x0'
  
  // Ensure proper hex format
  if (!value.startsWith('0x')) {
    value = '0x' + value
  }
  
  // Remove leading zeros for cleaner display, but keep at least one zero
  const cleanValue = value.replace(/^0x0+/, '0x') || '0x0'
  return cleanValue === '0x' ? '0x0' : cleanValue
}

/**
 * Group storage operations by contract for better organization
 */
export function groupStorageOperationsByContract(
  operations: StorageOperation[]
): Record<string, StorageOperation[]> {
  const grouped: Record<string, StorageOperation[]> = {}
  
  for (const op of operations) {
    if (!grouped[op.contract]) {
      grouped[op.contract] = []
    }
    grouped[op.contract].push(op)
  }
  
  return grouped
}

/**
 * Get storage operations count for a specific contract
 */
export function getStorageOperationsCount(operations: StorageOperation[]): number {
  return operations.length
}

/**
 * Filter storage operations by type (SSTORE or SLOAD)
 */
export function filterStorageOperationsByType(
  operations: StorageOperation[],
  type: 'SSTORE' | 'SLOAD'
): StorageOperation[] {
  return operations.filter(op => op.opcode === type)
}
