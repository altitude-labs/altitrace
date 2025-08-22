/**
 * @fileoverview Access list client implementation for Altitrace SDK
 *
 * This module provides a comprehensive client for interacting with the access list endpoint,
 * supporting access list generation for transactions with complete configuration options.
 */

import { AltitraceApiError, ValidationError } from '@sdk/core/errors'
import type { HttpClient } from '@sdk/core/http-client'
import type {
  AccessListComparisonBuilder,
  AccessListComparisonResult,
  AccessListExecutionOptions,
  AccessListRequest,
  AccessListRequestBuilder,
  AccessListResponse,
  ExtendedAccessListResponse,
  ExtendedSimulationResult,
  SimulationRequest,
  TransactionCall,
} from '@sdk/types'
import { ValidationUtils } from '@sdk/utils/validation'

/**
 * Access list client for interacting with the access list API endpoint.
 */
export class AccessListClient {
  constructor(public httpClient: HttpClient) {}

  /**
   * Create an access list request builder for fluent API usage.
   */
  createAccessList(): AccessListRequestBuilder {
    return new AccessListRequestBuilderImpl(this)
  }

  /**
   * Create an access list comparison builder for gas optimization analysis.
   */
  compareAccessList(): AccessListComparisonBuilder {
    return new AccessListComparisonBuilderImpl(this)
  }

  /**
   * Execute an access list request directly.
   */
  async executeAccessListRequest(
    request: AccessListRequest,
    options?: AccessListExecutionOptions,
  ): Promise<ExtendedAccessListResponse> {
    const response = await this.executeRequest<AccessListResponse>(
      'post',
      '/simulate/access-list',
      request,
      options,
    )

    return this.extendAccessListResponse(response)
  }

  /**
   * Generate an access list for a transaction call without using the builder pattern.
   * This is a convenience method for simple access list generation.
   */
  async generateAccessList(
    call: TransactionCall,
    options?: {
      block?: string | number | bigint
      executionOptions?: AccessListExecutionOptions
    },
  ): Promise<ExtendedAccessListResponse> {
    // Validate the transaction call
    if (call.to && !ValidationUtils.isAddress(call.to)) {
      throw new ValidationError('Invalid "to" address')
    }
    if (call.from && !ValidationUtils.isAddress(call.from)) {
      throw new ValidationError('Invalid "from" address')
    }

    const blockParam = this.normalizeBlockParam(options?.block)
    const request: AccessListRequest = {
      params: call,
      ...(blockParam && { block: blockParam }),
    }

    return this.executeAccessListRequest(request, options?.executionOptions)
  }

  /**
   * Normalize block parameter to string format.
   */
  public normalizeBlockParam(
    block?: string | number | bigint,
  ): string | undefined {
    if (block === undefined) return undefined
    if (typeof block === 'string') return block
    if (typeof block === 'number' || typeof block === 'bigint') {
      return `0x${block.toString(16)}`
    }
    return undefined
  }

  /**
   * Execute an access list request with error handling.
   */
  private async executeRequest<T>(
    _method: 'post',
    endpoint: string,
    data: any,
    _options?: AccessListExecutionOptions,
  ): Promise<T> {
    const response = await this.httpClient.post<T>(endpoint, data)

    if (!response.success || !response.data) {
      throw new AltitraceApiError(
        response.error?.message || 'Access list request failed',
        response.error?.code,
      )
    }

    return response.data
  }

  /**
   * Extend a basic access list response with helper methods.
   */
  private extendAccessListResponse(
    response: AccessListResponse,
  ): ExtendedAccessListResponse {
    const extended = response as ExtendedAccessListResponse

    extended.isSuccess = () => !response.error
    extended.isFailed = () => !!response.error

    extended.getTotalGasUsed = () => BigInt(response.gasUsed)

    extended.getAccountCount = () => response.accessList.length

    extended.getStorageSlotCount = () => {
      return response.accessList.reduce(
        (total, item) => total + item.storageKeys.length,
        0,
      )
    }

    extended.getAccessListSummary = () => {
      return response.accessList.map((item) => ({
        address: item.address,
        storageSlotCount: item.storageKeys.length,
        storageSlots: [...item.storageKeys],
      }))
    }

    extended.hasAccount = (address: string) => {
      const normalizedAddress = address.toLowerCase()
      return response.accessList.some(
        (item) => item.address.toLowerCase() === normalizedAddress,
      )
    }

    extended.getAccountStorageSlots = (address: string) => {
      const normalizedAddress = address.toLowerCase()
      const item = response.accessList.find(
        (item) => item.address.toLowerCase() === normalizedAddress,
      )
      return item ? [...item.storageKeys] : []
    }

    return extended
  }
}

/**
 * Implementation of the access list request builder.
 */
class AccessListRequestBuilderImpl implements AccessListRequestBuilder {
  private params?: TransactionCall
  private blockParam?: string
  private executionOptions?: AccessListExecutionOptions

  constructor(private client: AccessListClient) {}

  withTransaction(call: TransactionCall): AccessListRequestBuilder {
    // Validate the transaction call
    if (call.to && !ValidationUtils.isAddress(call.to)) {
      throw new ValidationError('Invalid "to" address')
    }
    if (call.from && !ValidationUtils.isAddress(call.from)) {
      throw new ValidationError('Invalid "from" address')
    }

    this.params = call
    return this
  }

  atBlock(
    blockNumberOrTag: string | number | bigint,
  ): AccessListRequestBuilder {
    const normalizedBlock = this.client.normalizeBlockParam(blockNumberOrTag)
    if (normalizedBlock !== undefined) {
      this.blockParam = normalizedBlock
    }
    return this
  }

  withExecutionOptions(
    options: AccessListExecutionOptions,
  ): AccessListRequestBuilder {
    this.executionOptions = options
    return this
  }

  withTimeout(timeout: number): AccessListRequestBuilder {
    this.executionOptions = {
      ...this.executionOptions,
      timeout,
    }
    return this
  }

  withHeaders(headers: Record<string, string>): AccessListRequestBuilder {
    this.executionOptions = {
      ...this.executionOptions,
      headers: {
        ...this.executionOptions?.headers,
        ...headers,
      },
    }
    return this
  }

  withRetry(enabled: boolean): AccessListRequestBuilder {
    this.executionOptions = {
      ...this.executionOptions,
      retry: enabled,
    }
    return this
  }

  async execute(): Promise<ExtendedAccessListResponse> {
    if (!this.params) {
      throw new ValidationError('Transaction call is required')
    }

    const request: AccessListRequest = {
      params: this.params,
    }

    return this.client.executeAccessListRequest(request, this.executionOptions)
  }

  build(): AccessListRequest {
    if (!this.params) {
      throw new ValidationError('Transaction call is required')
    }

    return {
      params: this.params,
      ...(this.blockParam && { block: this.blockParam }),
    }
  }
}

/**
 * Implementation of the access list comparison builder.
 */
class AccessListComparisonBuilderImpl implements AccessListComparisonBuilder {
  private callParam?: TransactionCall
  private blockParam = 'latest'
  private options = {
    traceAssetChanges: false,
    traceTransfers: false,
    validation: true,
  }

  constructor(private client: AccessListClient) {}

  call(call: TransactionCall): AccessListComparisonBuilder {
    this.callParam = call
    return this
  }

  atBlock(
    blockNumberOrTag: string | number | bigint,
  ): AccessListComparisonBuilder {
    if (typeof blockNumberOrTag === 'string') {
      this.blockParam = blockNumberOrTag
    } else {
      this.blockParam = `0x${blockNumberOrTag.toString(16)}`
    }
    return this
  }

  withAssetChanges(enabled: boolean): AccessListComparisonBuilder {
    this.options.traceAssetChanges = enabled
    return this
  }

  withTransfers(enabled: boolean): AccessListComparisonBuilder {
    this.options.traceTransfers = enabled
    return this
  }

  withValidation(enabled: boolean): AccessListComparisonBuilder {
    this.options.validation = enabled
    return this
  }

  async execute(): Promise<AccessListComparisonResult> {
    if (!this.callParam) {
      throw new ValidationError('Transaction call is required for comparison')
    }

    const result: AccessListComparisonResult = {
      comparison: {
        recommended: false,
      },
      success: {
        baseline: false,
        accessList: false,
        optimized: false,
      },
      errors: {},
    }

    try {
      // Step 1: Run baseline simulation without access list
      const baselineSimulation = await this.runSimulation(this.callParam)
      result.baseline = baselineSimulation
      result.success.baseline = true
      result.comparison.gasBaseline = baselineSimulation.getTotalGasUsed()
    } catch (error) {
      result.errors.baseline =
        error instanceof Error ? error.message : 'Unknown error'
      result.success.baseline = false
    }

    try {
      // Step 2: Generate access list
      const blockOption =
        this.blockParam !== 'latest' ? this.blockParam : undefined
      const accessListResponse = await this.client.generateAccessList(
        this.callParam,
        {
          ...(blockOption && { block: blockOption }),
        },
      )
      if (accessListResponse.isSuccess()) {
        result.accessListData = accessListResponse
        result.success.accessList = true

        try {
          // Step 3: Run optimized simulation with access list
          const callWithAccessList: TransactionCall = {
            ...this.callParam,
            accessList: accessListResponse.accessList,
          }
          const optimizedSimulation =
            await this.runSimulation(callWithAccessList)
          result.optimized = optimizedSimulation
          result.success.optimized = true
          result.comparison.gasOptimized = optimizedSimulation.getTotalGasUsed()

          // Calculate comparison metrics
          if (result.comparison.gasBaseline && result.comparison.gasOptimized) {
            result.comparison.gasDifference =
              result.comparison.gasOptimized - result.comparison.gasBaseline
            result.comparison.gasPercentageChange =
              (Number(result.comparison.gasDifference) /
                Number(result.comparison.gasBaseline)) *
              100

            // Consider access list effective if it saves at least 1000 gas
            const significantThreshold = 1000n
            result.comparison.accessListEffective =
              result.comparison.gasDifference < -significantThreshold
            result.comparison.recommended =
              result.comparison.accessListEffective || false
          }
        } catch (error) {
          result.errors.optimized =
            error instanceof Error ? error.message : 'Unknown error'
          result.success.optimized = false
        }
      } else {
        result.errors.accessList =
          accessListResponse.error || 'Access list generation failed'
        result.success.accessList = false
      }
    } catch (error) {
      result.errors.accessList =
        error instanceof Error ? error.message : 'Unknown error'
      result.success.accessList = false
    }

    return result
  }

  build() {
    if (!this.callParam) {
      throw new ValidationError('Transaction call is required for comparison')
    }

    return {
      call: this.callParam,
      block: this.blockParam,
      options: { ...this.options },
    }
  }

  /**
   * Helper method to run a simulation with consistent parameters.
   */
  private async runSimulation(
    call: TransactionCall,
  ): Promise<ExtendedSimulationResult> {
    // We need access to the simulation client, so we'll use the HTTP client directly
    const simulationRequest: SimulationRequest = {
      params: {
        calls: [call],
        validation: this.options.validation,
        traceAssetChanges: this.options.traceAssetChanges,
        traceTransfers: this.options.traceTransfers,
        account: null,
        blockTag: this.blockParam === 'latest' ? 'latest' : null,
        blockNumber: this.blockParam !== 'latest' ? this.blockParam : null,
      },
      options: null,
    }

    const response = await this.client.httpClient.post<any>(
      '/simulate',
      simulationRequest,
    )

    if (!response.success || !response.data) {
      throw new AltitraceApiError(
        response.error?.message || 'Simulation request failed',
        response.error?.code,
      )
    }

    // Create a basic extended result (we don't have access to the full simulation client here)
    const basicResult = response.data as any
    const extendedResult = basicResult as ExtendedSimulationResult

    // Add helper methods
    extendedResult.isSuccess = () => basicResult.status === 'success'
    extendedResult.isFailed = () =>
      basicResult.status === 'failed' || basicResult.status === 'reverted'
    extendedResult.getTotalGasUsed = () => BigInt(basicResult.gasUsed)
    extendedResult.getCallGasUsed = (callIndex: number) => {
      const call = basicResult.calls[callIndex]
      return call ? BigInt(call.gasUsed) : 0n
    }
    extendedResult.getErrors = () => {
      return basicResult.calls
        .map((call: any) => call.error)
        .filter((error: any) => error !== undefined && error !== null)
    }
    extendedResult.getAssetChangesSummary = () => {
      if (!basicResult.assetChanges) return []
      return basicResult.assetChanges.map((change: any) => ({
        tokenAddress: change.token.address,
        symbol: change.token.symbol,
        decimals: change.token.decimals,
        netChange: change.value.diff,
        type: change.value.diff.startsWith('-') ? 'loss' : 'gain',
      }))
    }
    extendedResult.getDecodedEvents = () => {
      const events: any[] = []
      for (const call of basicResult.calls) {
        for (const log of call.logs || []) {
          if (log.decoded) {
            events.push(log.decoded)
          }
        }
      }
      return events
    }
    extendedResult.getLogCount = () => {
      return basicResult.calls.reduce(
        (acc: number, call: any) => acc + (call.logs?.length || 0),
        0,
      )
    }

    return extendedResult
  }
}
