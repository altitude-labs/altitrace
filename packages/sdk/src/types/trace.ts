/**
 * @fileoverview Trace types that extend the OpenAPI generated types
 *
 * This module re-exports the generated trace types and adds extended interfaces
 * with helper methods for better developer experience.
 */

import type { components } from '@sdk/generated/api-types'
import type { BlockOverrides } from './block'
import type { StateOverride } from './state'
import type { TransactionCall } from './transaction'

// Re-export all trace-related types from generated API types
export type TraceTransactionRequest =
  components['schemas']['TraceTransactionRequest']
export type TraceCallRequest = components['schemas']['TraceCallRequest']
export type TraceCallManyRequest = components['schemas']['TraceCallManyRequest']
export type TracerResponse = components['schemas']['TracerResponse']
export type TracerManyResponse = TracerResponse[]
export type TraceConfig = components['schemas']['TraceConfig']
export type Tracers = components['schemas']['Tracers']
export type StorageSlot = components['schemas']['StorageSlot']

// Bundle and StateContext types
export type Bundle = components['schemas']['Bundle']
export type StateContext = components['schemas']['StateContext']
export type TxIndex = components['schemas']['TxIndex']

// Tracer configuration types
export type CallTracerConfig = components['schemas']['CallTracerConfig']
export type PrestateTracerConfig = components['schemas']['PrestateTracerConfig']
export type StructLoggerConfig = components['schemas']['StructLoggerConfig']

// Response types
export type CallTraceResponse = components['schemas']['CallTraceResponse']
export type CallFrame = components['schemas']['CallFrame']
export type PrestateTraceResponse =
  components['schemas']['PrestateTraceResponse']
export type PrestateDefaultMode = components['schemas']['PrestateDefaultMode']
export type PrestateDiffMode = components['schemas']['PrestateDiffMode']

export type StructLogResponse = components['schemas']['StructLogResponse']
export type StructLog = components['schemas']['StructLog']
export type FourByteResponse = components['schemas']['FourByteResponse']
export type FourByteInfo = components['schemas']['FourByteInfo']
export type TransactionReceiptInfo =
  components['schemas']['TransactionReceiptInfo']
export type LogEntry = components['schemas']['LogEntry']

// Extended response type with helper methods
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

// Builder interfaces for fluent API
export interface TraceRequestBuilder {
  /** Set transaction hash for transaction tracing */
  transaction(hash: string): TraceTransactionBuilder

  /** Set call parameters for call tracing */
  call(call: TransactionCall): TraceCallBuilder

  /** Set multiple calls for call-many tracing */
  callMany(bundles: Bundle[]): TraceCallManyBuilder
}

export interface TraceTransactionBuilder {
  /** Configure tracer options */
  withTracers(config: TraceConfig): TraceTransactionBuilder

  /** Enable call tracer with options */
  withCallTracer(config?: CallTracerConfig): TraceTransactionBuilder

  /** Enable prestate tracer with options */
  withPrestateTracer(config?: PrestateTracerConfig): TraceTransactionBuilder

  /** Enable struct logger with options */
  withStructLogger(config?: StructLoggerConfig): TraceTransactionBuilder

  /** Enable 4byte tracer */
  with4ByteTracer(): TraceTransactionBuilder

  /** Execute the trace request */
  execute(): Promise<ExtendedTracerResponse>
}

export interface TraceCallBuilder {
  /** Set block context */
  atBlock(block: string | number): TraceCallBuilder

  /** Set block context to latest */
  atLatest(): TraceCallBuilder

  /** Configure tracer options */
  withTracers(config: TraceConfig): TraceCallBuilder

  /** Enable call tracer with options */
  withCallTracer(config?: CallTracerConfig): TraceCallBuilder

  /** Enable prestate tracer with options */
  withPrestateTracer(config?: PrestateTracerConfig): TraceCallBuilder

  /** Enable struct logger with options */
  withStructLogger(config?: StructLoggerConfig): TraceCallBuilder

  /** Enable 4byte tracer */
  with4ByteTracer(): TraceCallBuilder

  /** Add state overrides */
  withStateOverrides(
    overrides: Record<string, StateOverride> | undefined,
  ): TraceCallBuilder

  /** Add block overrides */
  withBlockOverrides(overrides: BlockOverrides | undefined): TraceCallBuilder

  /** Execute the trace request */
  execute(): Promise<ExtendedTracerResponse>
}

export interface TraceCallManyBuilder {
  /** Set state context for tracing */
  withStateContext(context: StateContext): TraceCallManyBuilder

  /** Set state context to a specific block */
  atBlock(block: string | number): TraceCallManyBuilder

  /** Set state context to latest block */
  atLatest(): TraceCallManyBuilder

  /** Set transaction index within the block */
  withTransactionIndex(index: number): TraceCallManyBuilder

  /** Set transaction index to end of block (-1) */
  atEnd(): TraceCallManyBuilder

  /** Configure tracer options */
  withTracers(config: TraceConfig): TraceCallManyBuilder

  /** Enable call tracer with options */
  withCallTracer(config?: CallTracerConfig): TraceCallManyBuilder

  /** Enable prestate tracer with options */
  withPrestateTracer(config?: PrestateTracerConfig): TraceCallManyBuilder

  /** Enable struct logger with options */
  withStructLogger(config?: StructLoggerConfig): TraceCallManyBuilder

  /** Enable 4byte tracer */
  with4ByteTracer(): TraceCallManyBuilder

  /** Execute the trace request */
  execute(): Promise<TracerManyResponse>
}

// Utility types
export interface TraceExecutionOptions {
  /** Timeout for trace execution in milliseconds */
  timeout?: number

  /** Whether to retry on failure */
  retry?: boolean

  /** Maximum number of retry attempts */
  maxRetries?: number
}

// Type guards
export const TracerTypeGuards = {
  isCallTraceResponse(response: unknown): response is CallTraceResponse {
    return (
      response !== null &&
      typeof response === 'object' &&
      'rootCall' in response
    )
  },

  isPrestateTraceResponse(
    response: unknown,
  ): response is PrestateTraceResponse {
    return response !== null && typeof response === 'object'
  },

  isStructLogResponse(response: unknown): response is StructLogResponse {
    return (
      response !== null &&
      typeof response === 'object' &&
      'totalOpcodes' in response
    )
  },

  isFourByteResponse(response: unknown): response is FourByteResponse {
    return (
      response !== null &&
      typeof response === 'object' &&
      'totalIdentifiers' in response
    )
  },

  isDiffPrestateTrace(
    response: PrestateTraceResponse,
  ): response is PrestateDiffMode {
    return 'pre' in response && 'post' in response
  },

  isDefaultPrestateTrace(
    response: PrestateTraceResponse,
  ): response is PrestateDefaultMode {
    return !('pre' in response || 'post' in response)
  },
}
