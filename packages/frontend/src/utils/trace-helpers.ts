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
  callContext: string // Full call context identifier like "0.0" or "1.2" representing [depth][index]
}

/**
 * Call context tracker for building proper call hierarchy
 */
interface CallContextInfo {
  contract: string
  callIndex: string // Format: "depth.index" like "0.0", "1.0", "1.1"
  startPc: number
  endPc?: number
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
  const callStack: CallContextInfo[] = []
  const depthIndexMap = new Map<number, number>() // Track index count at each depth
  
  // Initialize with root call
  callStack.push({
    contract: rootCall.to || '',
    callIndex: '0.0',
    startPc: 0
  })
  depthIndexMap.set(0, 0)

  for (let i = 0; i < traceData.structLogger.structLogs.length; i++) {
    const log = traceData.structLogger.structLogs[i]
    const prevLog = i > 0 ? traceData.structLogger.structLogs[i - 1] : null
    
    // Handle call stack changes
    if (prevLog && log.depth !== prevLog.depth) {
      if (log.depth > prevLog.depth) {
        // Entering a new call - check the previous opcode to determine call type
        if (prevLog.op === 'CALL' || prevLog.op === 'STATICCALL' || 
            prevLog.op === 'DELEGATECALL' || prevLog.op === 'CALLCODE' ||
            prevLog.op === 'CREATE' || prevLog.op === 'CREATE2') {
          
          // Extract target address from stack if possible
          let targetContract = ''
          if (prevLog.stack && prevLog.stack.length >= 2) {
            // For CALL-like opcodes (CALL, CALLCODE, DELEGATECALL, STATICCALL), the target address is the second from top
            // Stack layout varies by opcode, but for simplicity we'll try to extract it
            const addressHex = prevLog.stack[prevLog.stack.length - 2]
            if (addressHex) {
              // Convert 32-byte hex to address (last 20 bytes)
              const fullHex = addressHex.startsWith('0x') ? addressHex.slice(2) : addressHex
              targetContract = '0x' + fullHex.slice(-40) // Last 40 hex chars = 20 bytes
            }
          }
          
          // If we couldn't extract from stack, fall back to call hierarchy
          if (!targetContract || targetContract === '0x0000000000000000000000000000000000000000') {
            const callsAtDepth = getCallsAtDepth(rootCall, log.depth)
            if (callsAtDepth.length > 0) {
              targetContract = callsAtDepth[0].to || ''
            }
          }
          
          // Calculate call index
          const currentDepthIndex = depthIndexMap.get(log.depth) || 0
          depthIndexMap.set(log.depth, currentDepthIndex + 1)
          
          const callContext: CallContextInfo = {
            contract: targetContract,
            callIndex: `${log.depth}.${currentDepthIndex}`,
            startPc: log.pc
          }
          
          callStack.push(callContext)
        }
      } else if (log.depth < prevLog.depth) {
        // Returning from call(s)
        while (callStack.length > 1 && callStack[callStack.length - 1].callIndex.split('.')[0] > log.depth.toString()) {
          const finishedCall = callStack.pop()
          if (finishedCall) {
            finishedCall.endPc = prevLog.pc
          }
        }
      }
    }
    
    // Process storage operations
    if (log.op === 'SSTORE' || log.op === 'SLOAD') {
      const currentCall = callStack[callStack.length - 1]
      
      if (currentCall && currentCall.contract && log.stack && log.stack.length >= 1) {
        const slot = log.stack[log.stack.length - 1] // Top of stack is the slot
        
        let value: string | undefined
        let oldValue: string | undefined
        
        if (log.op === 'SSTORE' && log.stack.length >= 2) {
          value = log.stack[log.stack.length - 2]
          
          if (log.storage && slot) {
            oldValue = log.storage[slot]
          }
        } else if (log.op === 'SLOAD') {
          if (i + 1 < traceData.structLogger.structLogs.length) {
            const nextLog = traceData.structLogger.structLogs[i + 1]
            if (nextLog.stack && nextLog.stack.length > 0) {
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
          contract: currentCall.contract,
          callContext: currentCall.callIndex
        })
      }
    }
  }

  return storageOps
}

/**
 * Helper to get calls at a specific depth from the call hierarchy
 */
function getCallsAtDepth(rootCall: CallFrame, targetDepth: number): CallFrame[] {
  const calls: CallFrame[] = []
  
  function traverse(call: CallFrame, currentDepth: number) {
    if (currentDepth === targetDepth) {
      calls.push(call)
    } else if (call.calls && currentDepth < targetDepth) {
      call.calls.forEach(subcall => traverse(subcall, currentDepth + 1))
    }
  }
  
  traverse(rootCall, 0)
  return calls
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
