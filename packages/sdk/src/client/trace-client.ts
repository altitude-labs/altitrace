/**
 * @fileoverview Trace client implementation for Altitrace SDK
 *
 * This module provides a comprehensive client for interacting with the trace endpoints,
 * supporting both transaction and call tracing with multiple tracer configurations.
 */

import { AltitraceApiError, ValidationError } from '@sdk/core/errors'
import type { HttpClient } from '@sdk/core/http-client'
import type { components } from '@sdk/generated/api-types'
import type {
  Bundle,
  ExtendedTracerResponse,
  StateContext,
  TraceCallBuilder,
  TraceCallManyBuilder,
  TraceExecutionOptions,
  TraceRequestBuilder,
  TracerManyResponse,
  TraceTransactionBuilder,
} from '@sdk/types/trace'
import { ValidationUtils } from '@sdk/utils/validation'

// Type aliases for OpenAPI generated types
type TraceTransactionRequest = components['schemas']['TraceTransactionRequest']
type TraceCallRequest = components['schemas']['TraceCallRequest']
type TraceCallManyRequest = components['schemas']['TraceCallManyRequest']
type TracerResponse = components['schemas']['TracerResponse']
type TraceConfig = components['schemas']['TraceConfig']
type TransactionCall = components['schemas']['TransactionCall']
type StateOverride = components['schemas']['StateOverride']
type BlockOverrides = components['schemas']['BlockOverrides']
type CallTracerConfig = components['schemas']['CallTracerConfig']
type PrestateTracerConfig = components['schemas']['PrestateTracerConfig']
type StructLoggerConfig = components['schemas']['StructLoggerConfig']

/**
 * Default tracer configurations.
 */
const DEFAULT_TRACERS: TraceConfig = {
  callTracer: {
    onlyTopCall: false,
    withLogs: true,
  },
  '4byteTracer': false,
  prestateTracer: null,
  structLogger: null,
}

/**
 * Trace client for interacting with the trace API endpoints.
 */
export class TraceClient {
  constructor(private httpClient: HttpClient) {}

  /**
   * Create a trace request builder for fluent API usage.
   */
  trace(): TraceRequestBuilder {
    return new TraceRequestBuilderImpl(this)
  }

  /**
   * Trace a transaction by hash directly.
   */
  async traceTransaction(
    transactionHash: string,
    config?: TraceConfig,
    options?: TraceExecutionOptions,
  ): Promise<ExtendedTracerResponse> {
    // Validate transaction hash
    if (!ValidationUtils.isTransactionHash(transactionHash)) {
      throw new ValidationError('Invalid transaction hash format')
    }

    const request: TraceTransactionRequest = {
      transactionHash,
      tracerConfig: config || DEFAULT_TRACERS,
    }

    const response = await this.executeRequest<TracerResponse>(
      'post',
      '/trace/tx',
      request,
      options,
    )

    return this.extendTracerResponse(response)
  }

  /**
   * Trace a call simulation directly.
   */
  async traceCall(
    call: TransactionCall,
    block = 'latest',
    config?: TraceConfig,
    overrides?: {
      stateOverrides?: Record<string, StateOverride> | undefined
      blockOverrides?: BlockOverrides | undefined
    },
    options?: TraceExecutionOptions,
  ): Promise<ExtendedTracerResponse> {
    // Validate call parameters
    if (call.to && !ValidationUtils.isAddress(call.to)) {
      throw new ValidationError('Invalid "to" address in call')
    }
    if (call.from && !ValidationUtils.isAddress(call.from)) {
      throw new ValidationError('Invalid "from" address in call')
    }

    const request: TraceCallRequest = {
      call,
      block,
      tracerConfig: config || DEFAULT_TRACERS,
      stateOverrides: overrides?.stateOverrides || null,
      blockOverrides: overrides?.blockOverrides || null,
    }

    const response = await this.executeRequest<TracerResponse>(
      'post',
      '/trace/call',
      request,
      options,
    )

    return this.extendTracerResponse(response)
  }

  /**
   * Trace multiple calls with state context directly.
   */
  async traceCallMany(
    bundles: Bundle[],
    stateContext?: StateContext,
    config?: TraceConfig,
    options?: TraceExecutionOptions,
  ): Promise<TracerManyResponse> {
    // Validate bundles
    if (!bundles || bundles.length === 0) {
      throw new ValidationError('At least one bundle is required')
    }

    // Validate bundle transactions
    for (const bundle of bundles) {
      if (!bundle.transactions || bundle.transactions.length === 0) {
        throw new ValidationError(
          'Each bundle must contain at least one transaction',
        )
      }

      for (const tx of bundle.transactions) {
        if (tx.to && !ValidationUtils.isAddress(tx.to)) {
          throw new ValidationError('Invalid "to" address in transaction')
        }
        if (tx.from && !ValidationUtils.isAddress(tx.from)) {
          throw new ValidationError('Invalid "from" address in transaction')
        }
      }
    }

    const request: TraceCallManyRequest = {
      bundles,
      stateContext: stateContext || {
        block: 'latest',
        txIndex: '-1',
      },
      tracerConfig: config || DEFAULT_TRACERS,
    }

    const response = await this.executeRequest<TracerManyResponse>(
      'post',
      '/trace/call-many',
      request,
      options,
    )

    // Extend each response in the array
    return response.map((tracerResponse) =>
      this.extendTracerResponse(tracerResponse),
    )
  }

  /**
   * Execute a trace request with error handling and retries.
   */
  private async executeRequest<T>(
    method: 'get' | 'post',
    endpoint: string,
    data: any,
    _options?: TraceExecutionOptions,
  ): Promise<T> {
    // For GET requests, send data as query parameters
    const response = await (method === 'get'
      ? this.httpClient.get<T>(endpoint, { params: data })
      : this.httpClient.post<T>(endpoint, data))

    if (!response.success || !response.data) {
      throw new AltitraceApiError(
        response.error?.message || 'Trace request failed',
        response.error?.code,
      )
    }

    return response.data
  }

  /**
   * Extend a basic tracer response with helper methods.
   */
  private extendTracerResponse(
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
        return BigInt(response.structLogger.totalGas)
      }
      return 0n
    }

    extended.getErrors = () => {
      const errors: string[] = []

      if (response.callTracer?.rootCall) {
        this.collectCallErrors(response.callTracer.rootCall, errors)
      }

      if (response.structLogger?.error) {
        errors.push(response.structLogger.error)
      }

      return errors
    }

    extended.getAllLogs = () => {
      const logs: components['schemas']['LogEntry'][] = []

      if (response.callTracer?.rootCall) {
        this.collectCallLogs(response.callTracer.rootCall, logs)
      }

      return logs
    }

    extended.getCallCount = () => {
      return response.callTracer?.totalCalls || 0
    }

    extended.getMaxDepth = () => {
      return response.callTracer?.maxDepth || 0
    }

    extended.getAccessedAccounts = () => {
      const accounts = new Set<string>()

      // From prestate tracer
      if (response.prestateTracer) {
        if ('pre' in response.prestateTracer) {
          // Diff mode
          for (const addr of Object.keys(response.prestateTracer.pre)) {
            accounts.add(addr)
          }
          for (const addr of Object.keys(response.prestateTracer.post)) {
            accounts.add(addr)
          }
        } else {
          // Default mode
          for (const addr of Object.keys(response.prestateTracer)) {
            accounts.add(addr)
          }
        }
      }

      // From call tracer
      if (response.callTracer?.rootCall) {
        this.collectCallAddresses(response.callTracer.rootCall, accounts)
      }

      return Array.from(accounts)
    }

    extended.getAccessedStorageSlots = () => {
      const slots: Array<{ address: string; slot: string }> = []

      // From struct logger
      if (response.structLogger?.structLogs) {
        for (const log of response.structLogger.structLogs) {
          if (log.storage) {
            for (const slot of Object.keys(log.storage)) {
              // Note: struct logs don't directly provide the address context
              // This would need additional processing to determine the contract address
              slots.push({ address: '0x', slot })
            }
          }
        }
      }

      return slots
    }

    extended.getFunctionSignatures = () => {
      if (response['4byteTracer']?.identifiers) {
        return Object.keys(response['4byteTracer'].identifiers)
      }
      return []
    }

    return extended
  }

  /**
   * Recursively collect error messages from call frames.
   */
  private collectCallErrors(
    call: components['schemas']['CallFrame'],
    errors: string[],
  ): void {
    if (call.error) {
      errors.push(call.error)
    }
    if (call.revertReason) {
      errors.push(call.revertReason)
    }
    if (call.calls) {
      for (const subcall of call.calls) {
        this.collectCallErrors(subcall, errors)
      }
    }
  }

  /**
   * Recursively collect logs from call frames.
   */
  private collectCallLogs(
    call: components['schemas']['CallFrame'],
    logs: components['schemas']['LogEntry'][],
  ): void {
    if (call.logs) {
      logs.push(...call.logs)
    }
    if (call.calls) {
      for (const subcall of call.calls) {
        this.collectCallLogs(subcall, logs)
      }
    }
  }

  /**
   * Recursively collect addresses from call frames.
   */
  private collectCallAddresses(
    call: components['schemas']['CallFrame'],
    addresses: Set<string>,
  ): void {
    addresses.add(call.from)
    if (call.to) {
      addresses.add(call.to)
    }
    if (call.calls) {
      for (const subcall of call.calls) {
        this.collectCallAddresses(subcall, addresses)
      }
    }
  }
}

/**
 * Implementation of the trace request builder.
 */
class TraceRequestBuilderImpl implements TraceRequestBuilder {
  constructor(private client: TraceClient) {}

  transaction(hash: string): TraceTransactionBuilder {
    return new TraceTransactionBuilderImpl(this.client, hash)
  }

  call(call: TransactionCall): TraceCallBuilder {
    return new TraceCallBuilderImpl(this.client, call)
  }

  callMany(bundles: Bundle[]): TraceCallManyBuilder {
    return new TraceCallManyBuilderImpl(this.client, bundles)
  }
}

/**
 * Implementation of the transaction trace builder.
 */
class TraceTransactionBuilderImpl implements TraceTransactionBuilder {
  private config: TraceConfig = { ...DEFAULT_TRACERS }
  private options?: TraceExecutionOptions

  constructor(
    private client: TraceClient,
    private transactionHash: string,
  ) {}

  withTracers(config: TraceConfig): TraceTransactionBuilder {
    this.config = { ...config }
    return this
  }

  withCallTracer(config?: CallTracerConfig): TraceTransactionBuilder {
    this.config.callTracer = config || { onlyTopCall: false, withLogs: true }
    return this
  }

  withPrestateTracer(config?: PrestateTracerConfig): TraceTransactionBuilder {
    this.config.prestateTracer = config || {
      diffMode: false,
      disableCode: false,
      disableStorage: false,
    }
    return this
  }

  withStructLogger(config?: StructLoggerConfig): TraceTransactionBuilder {
    this.config.structLogger = config || {
      cleanStructLogs: true,
      disableMemory: true,
      disableReturnData: false,
      disableStack: false,
      disableStorage: false,
    }
    return this
  }

  with4ByteTracer(): TraceTransactionBuilder {
    this.config['4byteTracer'] = true
    return this
  }

  async execute(): Promise<ExtendedTracerResponse> {
    return this.client.traceTransaction(
      this.transactionHash,
      this.config,
      this.options,
    )
  }
}

/**
 * Implementation of the call trace builder.
 */
class TraceCallBuilderImpl implements TraceCallBuilder {
  private block = 'latest'
  private config: TraceConfig = { ...DEFAULT_TRACERS }
  private stateOverrides?: Record<string, StateOverride> | undefined
  private blockOverrides?: BlockOverrides | undefined
  private options?: TraceExecutionOptions

  constructor(
    private client: TraceClient,
    private call: TransactionCall,
  ) {}

  atBlock(block: string | number): TraceCallBuilder {
    this.block = typeof block === 'number' ? `0x${block.toString(16)}` : block
    return this
  }

  atLatest(): TraceCallBuilder {
    this.block = 'latest'
    return this
  }

  withTracers(config: TraceConfig): TraceCallBuilder {
    this.config = { ...config }
    return this
  }

  withCallTracer(config?: CallTracerConfig): TraceCallBuilder {
    this.config.callTracer = config || { onlyTopCall: false, withLogs: true }
    return this
  }

  withPrestateTracer(config?: PrestateTracerConfig): TraceCallBuilder {
    this.config.prestateTracer = config || {
      diffMode: false,
      disableCode: false,
      disableStorage: false,
    }
    return this
  }

  withStructLogger(config?: StructLoggerConfig): TraceCallBuilder {
    this.config.structLogger = config || {
      cleanStructLogs: true,
      disableMemory: true,
      disableReturnData: false,
      disableStack: false,
      disableStorage: false,
    }
    return this
  }

  with4ByteTracer(): TraceCallBuilder {
    this.config['4byteTracer'] = true
    return this
  }

  withStateOverrides(
    overrides: Record<string, StateOverride>,
  ): TraceCallBuilder {
    this.stateOverrides = overrides
    return this
  }

  withBlockOverrides(overrides: BlockOverrides): TraceCallBuilder {
    this.blockOverrides = overrides
    return this
  }

  async execute(): Promise<ExtendedTracerResponse> {
    return this.client.traceCall(
      this.call,
      this.block,
      this.config,
      (() => {
        const hasOverrides = this.stateOverrides || this.blockOverrides
        if (!hasOverrides) return undefined

        const result: {
          stateOverrides?: Record<string, StateOverride>
          blockOverrides?: BlockOverrides
        } = {}
        if (this.stateOverrides) result.stateOverrides = this.stateOverrides
        if (this.blockOverrides) result.blockOverrides = this.blockOverrides
        return result
      })(),
      this.options,
    )
  }
}

/**
 * Implementation of the call-many trace builder.
 */
class TraceCallManyBuilderImpl implements TraceCallManyBuilder {
  private stateContext: StateContext = {
    block: 'latest',
    txIndex: '-1',
  }
  private config: TraceConfig = { ...DEFAULT_TRACERS }
  private options?: TraceExecutionOptions

  constructor(
    private client: TraceClient,
    private bundles: Bundle[],
  ) {}

  withStateContext(context: StateContext): TraceCallManyBuilder {
    this.stateContext = { ...context }
    return this
  }

  atBlock(block: string | number): TraceCallManyBuilder {
    const blockStr =
      typeof block === 'number' ? `0x${block.toString(16)}` : block
    this.stateContext = {
      ...this.stateContext,
      block: blockStr,
    }
    return this
  }

  atLatest(): TraceCallManyBuilder {
    this.stateContext = {
      ...this.stateContext,
      block: 'latest',
    }
    return this
  }

  withTransactionIndex(index: number): TraceCallManyBuilder {
    this.stateContext = {
      ...this.stateContext,
      txIndex: { Index: index },
    }
    return this
  }

  atEnd(): TraceCallManyBuilder {
    this.stateContext = {
      ...this.stateContext,
      txIndex: '-1',
    }
    return this
  }

  withTracers(config: TraceConfig): TraceCallManyBuilder {
    this.config = { ...config }
    return this
  }

  withCallTracer(config?: CallTracerConfig): TraceCallManyBuilder {
    this.config.callTracer = config || { onlyTopCall: false, withLogs: true }
    return this
  }

  withPrestateTracer(config?: PrestateTracerConfig): TraceCallManyBuilder {
    this.config.prestateTracer = config || {
      diffMode: false,
      disableCode: false,
      disableStorage: false,
    }
    return this
  }

  withStructLogger(config?: StructLoggerConfig): TraceCallManyBuilder {
    this.config.structLogger = config || {
      cleanStructLogs: true,
      disableMemory: true,
      disableReturnData: false,
      disableStack: false,
      disableStorage: false,
    }
    return this
  }

  with4ByteTracer(): TraceCallManyBuilder {
    this.config['4byteTracer'] = true
    return this
  }

  async execute(): Promise<TracerManyResponse> {
    return this.client.traceCallMany(
      this.bundles,
      this.stateContext,
      this.config,
      this.options,
    )
  }
}
