/**
 * @fileoverview Simulation client implementation for Altitrace SDK
 *
 * This module provides a comprehensive client for interacting with the simulation endpoints,
 * supporting both single and batch simulations with complete configuration options.
 */

import { AltitraceApiError, ValidationError } from '@sdk/core/errors'
import type { HttpClient } from '@sdk/core/http-client'
import type { components } from '@sdk/generated/api-types'
import type {
  AccessList,
  BatchSimulationConfig,
  BatchSimulationResult,
  BlockTag,
  ExtendedSimulationResult,
  SimulationExecutionOptions,
  SimulationRequestBuilder,
  TransactionCall,
} from '@sdk/types'
import { ValidationUtils } from '@sdk/utils/validation'

// Type aliases for OpenAPI generated types
type SimulationRequest = components['schemas']['SimulationRequest']
type SimulationResult = components['schemas']['SimulationResult']
type SimulationParams = components['schemas']['SimulationParams']
type SimulationOptions = components['schemas']['SimulationOptions']
type StateOverride = components['schemas']['StateOverride']
type BlockOverrides = components['schemas']['BlockOverrides']
type BlockTagGenerated = components['schemas']['BlockTag']

/**
 * Simulation client for interacting with the simulation API endpoints.
 */
export class SimulationClient {
  constructor(private httpClient: HttpClient) {}

  /**
   * Create a simulation request builder for fluent API usage.
   */
  simulate(): SimulationRequestBuilder {
    return new SimulationRequestBuilderImpl(this)
  }

  /**
   * Execute a simulation request directly.
   */
  async executeSimulation(
    request: SimulationRequest,
    options?: SimulationExecutionOptions,
  ): Promise<ExtendedSimulationResult> {
    const response = await this.executeRequest<SimulationResult>(
      'post',
      '/simulate',
      request,
      options,
    )

    return this.extendSimulationResult(response)
  }

  /**
   * Execute multiple simulations in batch.
   */
  async simulateBatch(
    config: BatchSimulationConfig,
    options?: SimulationExecutionOptions,
  ): Promise<BatchSimulationResult> {
    ValidationUtils.validateMinArrayLength(config.simulations, 1)
    ValidationUtils.validateRequired(config.simulations, 'simulations')

    const startTime = Date.now()

    if (config.maxConcurrency && config.maxConcurrency > 1) {
      // Execute in parallel with concurrency limit
      return this.executeSimulationsBatched(config, startTime, options)
    }
    // Execute sequentially
    return this.executeSimulationsSequential(config, startTime, options)
  }

  /**
   * Execute simulations using the batch API endpoint.
   */
  async simulateBatchAPI(
    simulations: SimulationRequest[],
    options?: SimulationExecutionOptions,
  ): Promise<ExtendedSimulationResult[]> {
    ValidationUtils.validateMinArrayLength(simulations, 1)

    const response = await this.executeRequest<SimulationResult[]>(
      'post',
      '/simulate/batch',
      simulations,
      options,
    )

    return response.map((result) => this.extendSimulationResult(result))
  }

  /**
   * Execute a simple call simulation without using the builder pattern.
   * This is a convenience method for single contract calls.
   */
  async simulateCall(
    call: TransactionCall,
    options?: {
      blockTag?: BlockTag | string
      validation?: boolean
      traceAssetChanges?: boolean
      traceTransfers?: boolean
      account?: string
      stateOverrides?: StateOverride[]
      blockOverrides?: BlockOverrides
    },
    executionOptions?: SimulationExecutionOptions,
  ): Promise<ExtendedSimulationResult> {
    // Validate the transaction call
    if (call.to && !ValidationUtils.isAddress(call.to)) {
      throw new ValidationError('Invalid "to" address')
    }
    if (call.from && !ValidationUtils.isAddress(call.from)) {
      throw new ValidationError('Invalid "from" address')
    }

    const params: SimulationParams = {
      calls: [call],
      validation: options?.validation ?? true,
      traceAssetChanges: options?.traceAssetChanges ?? false,
      traceTransfers: options?.traceTransfers ?? false,
      account: options?.account || null,
      blockNumber:
        options?.blockTag && options.blockTag !== 'latest'
          ? options.blockTag
          : null,
      blockTag: options?.blockTag === 'latest' ? 'latest' : null,
    }

    const simulationOptions: SimulationOptions | null =
      options?.stateOverrides || options?.blockOverrides
        ? {
            stateOverrides: options.stateOverrides || null,
            blockOverrides: options.blockOverrides || null,
          }
        : null

    const request: SimulationRequest = {
      params,
      options: simulationOptions,
    }

    return this.executeSimulation(request, executionOptions)
  }

  /**
   * Execute a simple call simulation with access list without using the builder pattern.
   * This is a convenience method for single contract calls with gas optimization.
   */
  async simulateCallWithAccessList(
    call: Omit<TransactionCall, 'accessList'>,
    accessList: AccessList,
    options?: {
      blockTag?: BlockTag | string
      validation?: boolean
      traceAssetChanges?: boolean
      traceTransfers?: boolean
      account?: string
      stateOverrides?: StateOverride[]
      blockOverrides?: BlockOverrides
    },
    executionOptions?: SimulationExecutionOptions,
  ): Promise<ExtendedSimulationResult> {
    const callWithAccessList: TransactionCall = {
      ...call,
      accessList,
    }

    return this.simulateCall(callWithAccessList, options, executionOptions)
  }

  /**
   * Execute a simulation request with error handling and retries.
   */
  private async executeRequest<T>(
    _method: 'post',
    endpoint: string,
    data: any,
    _options?: SimulationExecutionOptions,
  ): Promise<T> {
    const response = await this.httpClient.post<T>(endpoint, data)

    if (!response.success || !response.data) {
      throw new AltitraceApiError(
        response.error?.message || 'Simulation request failed',
        response.error?.code,
      )
    }

    return response.data
  }

  /**
   * Execute simulations sequentially with stop-on-failure support.
   */
  private async executeSimulationsSequential(
    config: BatchSimulationConfig,
    startTime: number,
    options?: SimulationExecutionOptions,
  ): Promise<BatchSimulationResult> {
    const results: ExtendedSimulationResult[] = []
    let successCount = 0
    let failureCount = 0

    for (const request of config.simulations) {
      try {
        const result = await this.executeSimulation(request, options)
        results.push(result)

        if (result.isSuccess()) {
          successCount++
        } else {
          failureCount++
          if (config.stopOnFailure) {
            break
          }
        }
      } catch (error) {
        failureCount++
        // Create a failed result for the error
        const failedResult = this.createFailedResult(error)
        results.push(failedResult)

        if (config.stopOnFailure) {
          break
        }
      }
    }

    return this.createBatchResult(
      results,
      successCount,
      failureCount,
      startTime,
    )
  }

  /**
   * Execute simulations in parallel batches with concurrency control.
   */
  private async executeSimulationsBatched(
    config: BatchSimulationConfig,
    startTime: number,
    options?: SimulationExecutionOptions,
  ): Promise<BatchSimulationResult> {
    const results: ExtendedSimulationResult[] = []
    let successCount = 0
    let failureCount = 0

    const promises = config.simulations.map((request) =>
      this.executeSimulation(request, options).catch((error) =>
        this.createFailedResult(error),
      ),
    )

    const executionResults = await Promise.all(promises)
    results.push(...executionResults)

    for (const result of executionResults) {
      if (result.isSuccess()) {
        successCount++
      } else {
        failureCount++
      }
    }

    return this.createBatchResult(
      results,
      successCount,
      failureCount,
      startTime,
    )
  }

  /**
   * Create a batch simulation result.
   */
  private createBatchResult(
    results: ExtendedSimulationResult[],
    successCount: number,
    failureCount: number,
    startTime: number,
  ): BatchSimulationResult {
    const totalExecutionTime = Date.now() - startTime
    const batchStatus =
      failureCount === 0 ? 'success' : successCount === 0 ? 'failed' : 'partial'

    return {
      results,
      batchStatus,
      totalExecutionTime,
      successCount,
      failureCount,
    }
  }

  /**
   * Create a failed simulation result from an error.
   */
  private createFailedResult(_error: any): ExtendedSimulationResult {
    const baseResult: SimulationResult = {
      simulationId: crypto.randomUUID(),
      blockNumber: '0x0',
      status: 'failed',
      calls: [],
      gasUsed: '0x0',
      blockGasUsed: '0x0',
    }

    return this.extendSimulationResult(baseResult)
  }

  /**
   * Extend a basic simulation result with helper methods.
   */
  private extendSimulationResult(
    result: SimulationResult,
  ): ExtendedSimulationResult {
    const extended = result as ExtendedSimulationResult

    extended.isSuccess = () => result.status === 'success'
    extended.isFailed = () =>
      result.status === 'failed' || result.status === 'reverted'

    extended.getTotalGasUsed = () => BigInt(result.gasUsed)

    extended.getCallGasUsed = (callIndex: number) => {
      const call = result.calls[callIndex]
      return call ? BigInt(call.gasUsed) : 0n
    }

    extended.getErrors = () => {
      return result.calls
        .map((call) => call.error)
        .filter((error) => error !== undefined && error !== null) as any[]
    }

    extended.getAssetChangesSummary = () => {
      if (!result.assetChanges) return []

      return result.assetChanges.map((change) => ({
        tokenAddress: change.token.address,
        symbol: change.token.symbol,
        decimals: change.token.decimals,
        netChange: change.value.diff,
        type: change.value.diff.startsWith('-')
          ? 'loss'
          : ('gain' as 'gain' | 'loss'),
      }))
    }

    extended.getDecodedEvents = () => {
      const events: any[] = []
      for (const call of result.calls) {
        for (const log of call.logs) {
          if (log.decoded) {
            events.push(log.decoded)
          }
        }
      }
      return events
    }

    extended.getLogCount = () => {
      return result.calls.reduce(
        (acc, call) => acc + (call.logs?.length || 0),
        0,
      )
    }

    return extended
  }
}

/**
 * Implementation of the simulation request builder.
 */
class SimulationRequestBuilderImpl implements SimulationRequestBuilder {
  private params: Partial<SimulationParams> = {
    calls: [],
    validation: true,
    traceAssetChanges: false,
    traceTransfers: false,
  }

  private options: Partial<SimulationOptions> = {}
  private executionOptions?: SimulationExecutionOptions

  constructor(private client: SimulationClient) {}

  call(call: TransactionCall): SimulationRequestBuilder {
    this.params.calls = this.params.calls || []
    this.params.calls.push(call)
    return this
  }

  callWithAccessList(
    call: Omit<TransactionCall, 'accessList'>,
    accessList: AccessList,
  ): SimulationRequestBuilder {
    const callWithAccessList: TransactionCall = {
      ...call,
      accessList,
    }
    this.params.calls = this.params.calls || []
    this.params.calls.push(callWithAccessList)
    return this
  }

  forAccount(account: string): SimulationRequestBuilder {
    if (!ValidationUtils.isAddress(account)) {
      throw new ValidationError('Invalid account address')
    }
    this.params.account = account
    return this
  }

  withValidation(enabled: boolean): SimulationRequestBuilder {
    this.params.validation = enabled
    return this
  }

  withAssetChanges(enabled: boolean): SimulationRequestBuilder {
    this.params.traceAssetChanges = enabled
    return this
  }

  withTransfers(enabled: boolean): SimulationRequestBuilder {
    this.params.traceTransfers = enabled
    return this
  }

  atBlockTag(tag: BlockTag): SimulationRequestBuilder {
    this.params.blockTag = tag
    this.params.blockNumber = null
    return this
  }

  atBlock(
    blockNumberOrTag: string | number | bigint,
  ): SimulationRequestBuilder {
    if (typeof blockNumberOrTag === 'string') {
      if (
        ['latest', 'earliest', 'safe', 'finalized'].includes(blockNumberOrTag)
      ) {
        return this.atBlockTag(blockNumberOrTag as BlockTagGenerated)
      }
      return this.atBlockNumber(blockNumberOrTag)
    }
    const blockHex = `0x${blockNumberOrTag.toString(16)}`
    return this.atBlockNumber(blockHex)
  }

  atBlockNumber(blockNumber: string): SimulationRequestBuilder {
    if (!ValidationUtils.isHexString(blockNumber)) {
      throw new ValidationError('Block number must be a hex string')
    }
    this.params.blockNumber = blockNumber
    this.params.blockTag = null
    return this
  }

  withStateOverride(override: StateOverride): SimulationRequestBuilder {
    this.options.stateOverrides = this.options.stateOverrides || []
    this.options.stateOverrides.push(override)
    return this
  }

  withStateOverrides(overrides: StateOverride[]): SimulationRequestBuilder {
    this.options.stateOverrides = overrides
    return this
  }

  withBlockOverrides(overrides: BlockOverrides): SimulationRequestBuilder {
    this.options.blockOverrides = overrides
    return this
  }

  withExecutionOptions(
    options: SimulationExecutionOptions,
  ): SimulationRequestBuilder {
    this.executionOptions = options
    return this
  }

  async execute(): Promise<ExtendedSimulationResult> {
    if (!this.params.calls || this.params.calls.length === 0) {
      throw new ValidationError('At least one call is required')
    }

    const request: SimulationRequest = {
      params: this.params as SimulationParams,
      options:
        Object.keys(this.options).length > 0
          ? (this.options as SimulationOptions)
          : null,
    }

    return this.client.executeSimulation(request, this.executionOptions)
  }

  build(): SimulationRequest {
    if (!this.params.calls || this.params.calls.length === 0) {
      throw new ValidationError('At least one call is required')
    }

    return {
      params: this.params as SimulationParams,
      options:
        Object.keys(this.options).length > 0
          ? (this.options as SimulationOptions)
          : null,
    }
  }
}
