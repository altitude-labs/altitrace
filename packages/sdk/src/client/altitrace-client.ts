/**
 * @fileoverview Main Altitrace SDK client
 */

import type { AltitraceClientConfig, ApiResponse } from '@sdk/types/client';
import type {
  SimulationRequest,
  SimulationResult,
  ExtendedSimulationResult,
  BatchSimulationConfig,
  BatchSimulationResult,
  SimulationRequestBuilder,
  TransactionCall,
  BlockTag,
} from '@sdk/types/simulation';
import { HttpClient } from '@sdk/core/http-client';
import { createSimulationBuilder } from '@sdk/builders/simulation-builder';
import { ValidationUtils } from '@sdk/utils/validation';
import { ValidationError, AltitraceApiError } from '@sdk/core/errors';

/**
 * Main Altitrace SDK client for interacting with the HyperEVM simulation API.
 */
export class AltitraceClient {
  private httpClient: HttpClient;

  constructor(config: AltitraceClientConfig = {}) {
    this.httpClient = new HttpClient(config);
  }

  /**
   * Create a simulation request builder.
   */
  simulate(): SimulationRequestBuilder {
    return createSimulationBuilder(this);
  }

  /**
   * Execute a simulation request directly.
   */
  async executeSimulation(request: SimulationRequest): Promise<ExtendedSimulationResult> {
    const response = await this.httpClient.post<SimulationResult>('/simulate', request);

    if (!response.success || !response.data) {
      throw new AltitraceApiError(
        response.error?.message || 'Simulation failed',
        response.error?.code
      );
    }

    return this.extendSimulationResult(response.data);
  }

  /**
   * Execute multiple simulations in batch.
   */
  async simulateBatch(config: BatchSimulationConfig): Promise<BatchSimulationResult> {
    ValidationUtils.validateMinArrayLength(config.simulations, 1);
    ValidationUtils.validateRequired(config.simulations, 'simulations');

    const startTime = Date.now();

    if (config.maxConcurrency && config.maxConcurrency > 1) {
      // Execute in parallel with concurrency limit
      return this.executeSimulationsBatched(config, startTime);
    } else {
      // Execute sequentially
      return this.executeSimulationsSequential(config, startTime);
    }
  }

  /**
   * Execute simulations using the batch API endpoint.
   */
  async simulateBatchAPI(simulations: SimulationRequest[]): Promise<ExtendedSimulationResult[]> {
    ValidationUtils.validateMinArrayLength(simulations, 1);

    const response = await this.httpClient.post<SimulationResult[]>('/simulate/batch', simulations);

    if (!response.success || !response.data) {
      throw new AltitraceApiError(
        response.error?.message || 'Batch simulation failed',
        response.error?.code
      );
    }

    return response.data.map(result => this.extendSimulationResult(result));
  }

  /**
   * Execute a simple call simulation without using the builder pattern.
   * This is a convenience method for single contract calls.
   */
  async simulateCall(
    call: TransactionCall,
    options?: {
      blockTag?: BlockTag | string;
      validation?: boolean;
      traceAssetChanges?: boolean;
      traceTransfers?: boolean;
      account?: string;
    }
  ): Promise<ExtendedSimulationResult> {
    // Validate the transaction call
    if (call.to && !ValidationUtils.isAddress(call.to)) {
      throw new ValidationError('Invalid "to" address');
    }
    if (call.from && !ValidationUtils.isAddress(call.from)) {
      throw new ValidationError('Invalid "from" address');
    }

    // Create a simulation request
    const request: SimulationRequest = {
      params: {
        calls: [call],
        validation: options?.validation ?? true,
        traceAssetChanges: options?.traceAssetChanges ?? false,
        traceTransfers: options?.traceTransfers ?? false,
        account: options?.account ?? null,
        blockNumber: options?.blockTag && options.blockTag !== 'latest' ? options.blockTag : null,
        blockTag: options?.blockTag === 'latest' ? 'latest' : null,
      },
    };

    return this.executeSimulation(request);
  }

  /**
   * Check API health status.
   */
  async healthCheck(): Promise<any> {
    const response = await this.httpClient.get('/status/healthcheck');

    if (!response.success || !response.data) {
      throw new AltitraceApiError(
        response.error?.message || 'Health check failed',
        response.error?.code
      );
    }

    return response.data;
  }

  /**
   * Check API health status (legacy method).
   */
  async health(): Promise<ApiResponse<any>> {
    return this.httpClient.get('/status/healthcheck');
  }

  /**
   * Get current client configuration.
   */
  getConfig(): Readonly<AltitraceClientConfig> {
    return this.httpClient.getConfig();
  }

  /**
   * Execute simulations sequentially with stop-on-failure support.
   */
  private async executeSimulationsSequential(
    config: BatchSimulationConfig,
    startTime: number
  ): Promise<BatchSimulationResult> {
    const results: ExtendedSimulationResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const request of config.simulations) {
      try {
        const result = await this.executeSimulation(request);
        results.push(result);

        if (result.isSuccess()) {
          successCount++;
        } else {
          failureCount++;
          if (config.stopOnFailure) {
            break;
          }
        }
      } catch (error) {
        failureCount++;
        // Create a failed result for the error
        const failedResult = this.createFailedResult(error);
        results.push(failedResult);

        if (config.stopOnFailure) {
          break;
        }
      }
    }

    return this.createBatchResult(results, successCount, failureCount, startTime);
  }

  /**
   * Execute simulations in parallel batches with concurrency control.
   */
  private async executeSimulationsBatched(
    config: BatchSimulationConfig,
    startTime: number
  ): Promise<BatchSimulationResult> {
    const concurrency = config.maxConcurrency || 5;
    const results: ExtendedSimulationResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    // Process in chunks
    for (let i = 0; i < config.simulations.length; i += concurrency) {
      const chunk = config.simulations.slice(i, i + concurrency);
      const chunkPromises = chunk.map(request =>
        this.executeSimulation(request).catch(error => this.createFailedResult(error))
      );

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);

      // Count successes/failures
      for (const result of chunkResults) {
        if (result.isSuccess()) {
          successCount++;
        } else {
          failureCount++;
        }
      }

      // Check stop condition
      if (config.stopOnFailure && failureCount > 0) {
        break;
      }
    }

    return this.createBatchResult(results, successCount, failureCount, startTime);
  }

  /**
   * Create a batch simulation result.
   */
  private createBatchResult(
    results: ExtendedSimulationResult[],
    successCount: number,
    failureCount: number,
    startTime: number
  ): BatchSimulationResult {
    const totalExecutionTime = Date.now() - startTime;
    const batchStatus = failureCount === 0 ? 'success' : successCount === 0 ? 'failed' : 'partial';

    return {
      results,
      batchStatus,
      totalExecutionTime,
      successCount,
      failureCount,
    };
  }

  /**
   * Create a failed simulation result from an error.
   */
  private createFailedResult(error: any): ExtendedSimulationResult {
    const baseResult: SimulationResult = {
      simulationId: crypto.randomUUID(),
      blockNumber: '0x0',
      status: 'failed',
      calls: [],
      gasUsed: '0x0',
      blockGasUsed: '0x0',
    };

    return this.extendSimulationResult(baseResult);
  }

  /**
   * Extend a basic simulation result with helper methods.
   */
  private extendSimulationResult(result: SimulationResult): ExtendedSimulationResult {
    const extended = result as ExtendedSimulationResult;

    extended.isSuccess = () => result.status === 'success';
    extended.isFailed = () => result.status === 'failed' || result.status === 'reverted';

    extended.getTotalGasUsed = () => BigInt(result.gasUsed);

    extended.getCallGasUsed = (callIndex: number) => {
      const call = result.calls[callIndex];
      return call ? BigInt(call.gasUsed) : 0n;
    };

    extended.getErrors = () => {
      return result.calls
        .map(call => call.error)
        .filter(error => error !== undefined && error !== null) as any[];
    };

    extended.getAssetChangesSummary = () => {
      if (!result.assetChanges) return [];

      return result.assetChanges.map(change => ({
        tokenAddress: change.token.address,
        symbol: change.token.symbol,
        decimals: change.token.decimals,
        netChange: change.value.diff,
        type: change.value.diff.startsWith('-') ? 'loss' : ('gain' as 'gain' | 'loss'),
      }));
    };

    extended.getDecodedEvents = () => {
      const events: any[] = [];
      for (const call of result.calls) {
        for (const log of call.logs) {
          if (log.decoded) {
            events.push(log.decoded);
          }
        }
      }
      return events;
    };

    return extended;
  }
}
