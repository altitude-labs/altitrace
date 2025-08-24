/**
 * @fileoverview Main Altitrace SDK client
 */

import { AltitraceApiError } from '@sdk/core/errors'
import { HttpClient } from '@sdk/core/http-client'
import type {
  AccessList,
  AccessListComparisonBuilder,
  AccessListExecutionOptions,
  AccessListRequestBuilder,
  AltitraceClientConfig,
  ApiResponse,
  BatchSimulationConfig,
  BatchSimulationResult,
  BlockTag,
  ExtendedAccessListResponse,
  ExtendedSimulationResult,
  ExtendedTracerResponse,
  SimulationRequest,
  SimulationRequestBuilder,
  TraceRequestBuilder,
  TransactionCall,
} from '@sdk/types'
import type {
  Bundle,
  CallTracerConfig,
  PrestateTracerConfig,
  StateContext,
  StructLoggerConfig,
  TracerManyResponse,
} from '@sdk/types/trace'
import { AccessListClient } from './access-list-client'
import { SimulationClient } from './simulation-client'
import { TraceClient } from './trace-client'

/**
 * Main Altitrace SDK client for interacting with the HyperEVM simulation and trace APIs.
 *
 * This client provides a unified interface to both simulation and trace functionality,
 * with dedicated sub-clients for each feature area.
 */
export class AltitraceClient {
  private httpClient: HttpClient
  private simulationClient: SimulationClient
  private traceClient: TraceClient
  private accessListClient: AccessListClient
  private viemClient?: any // Optional viem client for blockchain data access

  constructor(config: AltitraceClientConfig = {}) {
    this.httpClient = new HttpClient(config)
    this.simulationClient = new SimulationClient(this.httpClient)
    this.traceClient = new TraceClient(this.httpClient, config.viemClient)
    this.accessListClient = new AccessListClient(this.httpClient)
    this.viemClient = config.viemClient
  }

  /**
   * Create a simulation request builder.
   */
  simulate(): SimulationRequestBuilder {
    return this.simulationClient.simulate()
  }

  /**
   * Create a trace request builder.
   */
  trace(): TraceRequestBuilder {
    return this.traceClient.trace()
  }

  /**
   * Create an access list request builder.
   */
  accessList(): AccessListRequestBuilder {
    return this.accessListClient.createAccessList()
  }

  /**
   * Create an access list comparison builder for gas optimization analysis.
   */
  compareAccessList(): AccessListComparisonBuilder {
    return this.accessListClient.compareAccessList()
  }

  /**
   * Execute a simulation request directly.
   */
  async executeSimulation(
    request: SimulationRequest,
  ): Promise<ExtendedSimulationResult> {
    return this.simulationClient.executeSimulation(request)
  }

  /**
   * Execute multiple simulations in batch.
   */
  async simulateBatch(
    config: BatchSimulationConfig,
  ): Promise<BatchSimulationResult> {
    return this.simulationClient.simulateBatch(config)
  }

  /**
   * Execute simulations using the batch API endpoint.
   */
  async simulateBatchAPI(
    simulations: SimulationRequest[],
  ): Promise<ExtendedSimulationResult[]> {
    return this.simulationClient.simulateBatchAPI(simulations)
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
    },
  ): Promise<ExtendedSimulationResult> {
    return this.simulationClient.simulateCall(call, options)
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
    return this.accessListClient.generateAccessList(call, options)
  }

  /**
   * Execute a simulation with a pre-generated access list for gas optimization.
   * This is a convenience method that combines simulation with access list usage.
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
    },
  ): Promise<ExtendedSimulationResult> {
    return this.simulationClient.simulateCallWithAccessList(
      call,
      accessList,
      options,
    )
  }

  /**
   * Check API health status.
   */
  async healthCheck(): Promise<any> {
    const response = await this.httpClient.get('/status/healthcheck')

    if (!response.success || !response.data) {
      throw new AltitraceApiError(
        response.error?.message || 'Health check failed',
        response.error?.code,
      )
    }

    return response.data
  }

  /**
   * Check API health status (legacy method).
   */
  async health(): Promise<ApiResponse<any>> {
    return this.httpClient.get('/status/healthcheck')
  }

  /**
   * Trace a transaction by hash directly.
   * This is a convenience method for single transaction traces.
   */
  async traceTransaction(
    transactionHash: string,
    options?: {
      callTracer?: boolean
      prestateTracer?: boolean
      structLogger?: boolean
      fourByteTracer?: boolean
    },
  ): Promise<ExtendedTracerResponse> {
    return this.traceClient.traceTransaction(
      transactionHash,
      this.buildTraceConfig(options),
    )
  }

  /**
   * Trace a call simulation directly.
   * This is a convenience method for single call traces.
   */
  async traceCall(
    call: TransactionCall,
    options?: {
      block?: string | number
      callTracer?: boolean
      prestateTracer?: boolean
      structLogger?: boolean
      fourByteTracer?: boolean
    },
  ): Promise<ExtendedTracerResponse> {
    const block = options?.block ? String(options.block) : 'latest'
    return this.traceClient.traceCall(
      call,
      block,
      this.buildTraceConfig(options),
    )
  }

  /**
   * Trace multiple calls with state context directly.
   * This is a convenience method for multiple call traces.
   */
  async traceCallMany(
    bundles: Bundle[],
    options?: {
      stateContext?: StateContext
      callTracer?: CallTracerConfig | boolean
      prestateTracer?: PrestateTracerConfig | boolean
      structLogger?: StructLoggerConfig | boolean
      fourByteTracer?: boolean
    },
  ): Promise<TracerManyResponse> {
    return this.traceClient.traceCallMany(
      bundles,
      options?.stateContext,
      this.buildTraceConfig(options),
    )
  }

  /**
   * Build trace configuration from options.
   */
  private buildTraceConfig(options?: {
    callTracer?: CallTracerConfig | boolean | undefined
    prestateTracer?: PrestateTracerConfig | boolean | undefined
    structLogger?: StructLoggerConfig | boolean | undefined
    fourByteTracer?: boolean | undefined
  }) {
    if (!options) return undefined

    const config: any = {}

    if (options.callTracer) {
      config.callTracer =
        typeof options.callTracer === 'boolean'
          ? { onlyTopCall: false, withLogs: true }
          : options.callTracer
    }
    if (options.prestateTracer) {
      config.prestateTracer =
        typeof options.prestateTracer === 'boolean'
          ? { diffMode: true, disableCode: false, disableStorage: false }
          : options.prestateTracer
    }
    if (options.structLogger) {
      config.structLogger =
        typeof options.structLogger === 'boolean'
          ? {
              cleanStructLogs: true,
              disableMemory: true,
              disableReturnData: false,
              disableStack: false,
              disableStorage: false,
            }
          : options.structLogger
    }
    if (options.fourByteTracer) {
      config['4byteTracer'] = true
    }

    return Object.keys(config).length > 0 ? config : undefined
  }

  /**
   * Get current client configuration.
   */
  getConfig(): Readonly<AltitraceClientConfig> {
    return this.httpClient.getConfig()
  }

  /**
   * Get direct access to the simulation client.
   * Useful for advanced simulation operations.
   */
  get simulation(): SimulationClient {
    return this.simulationClient
  }

  /**
   * Get direct access to the trace client.
   * Useful for advanced trace operations.
   */
  get tracing(): TraceClient {
    return this.traceClient
  }

  /**
   * Get direct access to the access list client.
   * Useful for advanced access list operations.
   */
  get accessLists(): AccessListClient {
    return this.accessListClient
  }
}
