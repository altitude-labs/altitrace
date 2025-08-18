/**
 * @fileoverview Test suite for AltitraceClient
 * 
 * Comprehensive tests for the main SDK client functionality,
 * including simulation execution, error handling, and configuration.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from 'bun:test';
import { AltitraceClient } from '@sdk/client/altitrace-client';
import type { SimulationResult, ApiResponse, RetryConfig } from '@sdk/types/simulation';
import { AltitraceApiError, ValidationError, AltitraceNetworkError } from '@sdk/core/errors';

// Mock fetch for testing
const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockClear();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('AltitraceClient', () => {
  describe('constructor', () => {
    it('should create client with default configuration', () => {
      const client = new AltitraceClient();
      const config = client.getConfig();
      
      expect(config.baseUrl).toBe('http://localhost:8080/v1');
      expect(config.timeout).toBe(30_000);
      expect(config.debug).toBe(false);
    });

    it('should create client with custom configuration', () => {
      const retryConfig: RetryConfig = {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 5000,
        backoffMultiplier: 2,
        retryableStatusCodes: new Set([429, 502]),
        shouldRetry: (error, attempt) => {
          // Custom retry logic
          return error instanceof AltitraceNetworkError && attempt < 3;
        },
      };
        
      const client = new AltitraceClient({
        baseUrl: 'https://api.altitrace.com/v1',
        timeout: 60_000,
        retryConfig,
        debug: true,
      });
      
      const config = client.getConfig();
      expect(config.baseUrl).toBe('https://api.altitrace.com/v1');
      expect(config.timeout).toBe(60_000);
      expect(config.retryConfig?.maxAttempts).toBe(3);
      expect(config.debug).toBe(true);
    });

    it('should throw ValidationError for invalid base URL', () => {
      expect(() => {
        new AltitraceClient({
          baseUrl: 'invalid-url',
        });
      }).toThrow('Base URL must start with http:// or https://');
    });

    it('should throw ValidationError for invalid timeout', () => {
      expect(() => {
        new AltitraceClient({
          timeout: -1000,
        });
      }).toThrow('Timeout must be a positive number');
    });
  });

  describe('simulate builder', () => {
    let client: AltitraceClient;

    beforeEach(() => {
      client = new AltitraceClient();
    });

    it('should create simulation builder', () => {
      const builder = client.simulate();
      expect(builder).toBeDefined();
      expect(typeof builder.call).toBe('function');
      expect(typeof builder.execute).toBe('function');
    });

    it('should execute simple simulation', async () => {
      const mockResult: SimulationResult = {
        simulationId: 'test-123',
        blockNumber: '0x123abc',
        status: 'success',
        calls: [{
          callIndex: 0,
          status: 'success',
          returnData: '0x0000000000000000000000000000000000000000000000000000000000000001',
          gasUsed: '0x5208',
          logs: [],
        }],
        gasUsed: '0x5208',
        blockGasUsed: '0x5208',
      };

      const mockResponse: ApiResponse<SimulationResult> = {
        success: true,
        data: mockResult,
        metadata: {
          requestId: 'req-123',
          timestamp: new Date().toISOString(),
          executionTime: 100,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
        headers: new Headers(),
      });

      const result = await client.simulate()
        .call({
          to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          data: '0xa9059cbb',
        })
        .atBlockTag('latest')
        .execute();

      expect(result.simulationId).toBe('test-123');
      expect(result.isSuccess()).toBe(true);
      expect(result.getTotalGasUsed()).toBe(BigInt(21_000));
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors', async () => {
      const mockErrorResponse: ApiResponse<never> = {
        success: false,
        error: {
          code: 'SIMULATION_FAILED',
          message: 'Transaction reverted',
          suggestion: 'Check transaction parameters',
        },
        metadata: {
          requestId: 'req-123',
          timestamp: new Date().toISOString(),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockErrorResponse),
        headers: new Headers(),
      });

      expect(
        client.simulate()
          .call({
            to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            data: '0xa9059cbb',
          })
          .execute()
      ).rejects.toThrow(AltitraceApiError);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      expect(
        client.simulate()
          .call({
            to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            data: '0xa9059cbb',
          })
          .execute()
      ).rejects.toThrow(AltitraceNetworkError);
    });

    it('should validate transaction calls', async () => {
      expect(
        client.simulate()
          .call({
            to: 'invalid-address',
            data: '0xa9059cbb',
          })
          .execute()
      ).rejects.toThrow(ValidationError);
    });

    it('should require at least one call', async () => {
      expect(() => {
        client.simulate().build();
      }).toThrow('At least one call is required');
    });
  });

  describe('executeSimulation', () => {
    let client: AltitraceClient;

    beforeEach(() => {
      client = new AltitraceClient();
    });

    it('should execute pre-built simulation request', async () => {
      const request = {
        params: {
          calls: [{
            to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            data: '0xa9059cbb',
          }],
          validation: true,
          traceAssetChanges: false,
          traceTransfers: false,
        },
      };

      const mockResult: SimulationResult = {
        simulationId: 'test-123',
        blockNumber: '0x123abc',
        status: 'success',
        calls: [{
          callIndex: 0,
          status: 'success',
          returnData: '0x01',
          gasUsed: '0x5208',
          logs: [],
        }],
        gasUsed: '0x5208',
        blockGasUsed: '0x5208',
      };

      const mockResponse: ApiResponse<SimulationResult> = {
        success: true,
        data: mockResult,
        metadata: {
          requestId: 'req-123',
          timestamp: new Date().toISOString(),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
        headers: new Headers(),
      });

      const result = await client.executeSimulation(request);
      expect(result.simulationId).toBe('test-123');
      expect(result.isSuccess()).toBe(true);
    });

    it('should validate simulation request', async () => {
      const invalidRequest = {
        params: {
          calls: [],
          validation: true,
          traceAssetChanges: false,
          traceTransfers: false,
        },
      };

      expect(
        client.executeSimulation(invalidRequest)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('simulateBatch', () => {
    let client: AltitraceClient;

    beforeEach(() => {
      client = new AltitraceClient();
    });

    it('should execute batch simulation', async () => {
      const config = {
        simulations: [
          {
            params: {
              calls: [{
                to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                data: '0xa9059cbb',
              }],
              validation: true,
              traceAssetChanges: false,
              traceTransfers: false,
            },
          },
          {
            params: {
              calls: [{
                to: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
                data: '0xa9059cbb',
              }],
              validation: true,
              traceAssetChanges: false,
              traceTransfers: false,
            },
          },
        ],
      };

      const mockResults: SimulationResult[] = [
        {
          simulationId: 'test-1',
          blockNumber: '0x123abc',
          status: 'success',
          calls: [{
            callIndex: 0,
            status: 'success',
            returnData: '0x01',
            gasUsed: '0x5208',
            logs: [],
          }],
          gasUsed: '0x5208',
          blockGasUsed: '0x5208',
        },
        {
          simulationId: 'test-2',
          blockNumber: '0x123abc',
          status: 'reverted',
          calls: [{
            callIndex: 0,
            status: 'reverted',
            returnData: '0x',
            gasUsed: '0x5208',
            logs: [],
            error: {
              reason: 'Insufficient balance',
              errorType: 'execution-reverted',
            },
          }],
          gasUsed: '0x5208',
          blockGasUsed: '0x5208',
        },
      ];

      const mockResponse: ApiResponse<SimulationResult[]> = {
        success: true,
        data: mockResults,
        metadata: {
          requestId: 'req-batch-123',
          timestamp: new Date().toISOString(),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
        headers: new Headers(),
      });

      const result = await client.simulateBatch(config);
      expect(result.results).toHaveLength(2);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
    });

    it('should validate batch configuration', async () => {
      const invalidConfig = {
        simulations: [], // Empty array
      };

      expect(
        client.simulateBatch(invalidConfig)
      ).rejects.toThrow(ValidationError);
    });

    it('should validate individual simulations in batch', async () => {
      const invalidConfig = {
        simulations: [
          {
            params: {
              calls: [{
                to: 'invalid-address', // Invalid address
                data: '0xa9059cbb',
              }],
              validation: true,
              traceAssetChanges: false,
              traceTransfers: false,
            },
          },
        ],
      };

      expect(
        client.simulateBatch(invalidConfig)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('simulateCall', () => {
    let client: AltitraceClient;

    beforeEach(() => {
      client = new AltitraceClient();
    });

    it('should execute simple call simulation', async () => {
      const mockResult: SimulationResult = {
        simulationId: 'test-simple',
        blockNumber: '0x123abc',
        status: 'success',
        calls: [{
          callIndex: 0,
          status: 'success',
          returnData: '0x01',
          gasUsed: '0x5208',
          logs: [],
        }],
        gasUsed: '0x5208',
        blockGasUsed: '0x5208',
      };

      const mockResponse: ApiResponse<SimulationResult> = {
        success: true,
        data: mockResult,
        metadata: {
          requestId: 'req-simple-123',
          timestamp: new Date().toISOString(),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
        headers: new Headers(),
      });

      const result = await client.simulateCall({
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        data: '0xa9059cbb',
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
      }, {
        blockTag: 'latest',
        validation: true,
      });

      expect(result.simulationId).toBe('test-simple');
      expect(result.isSuccess()).toBe(true);
    });
  });

  describe('healthCheck', () => {
    let client: AltitraceClient;

    beforeEach(() => {
      client = new AltitraceClient();
    });

    it('should return health status', async () => {
      const mockHealth = {
        status: 'healthy',
        version: '1.0.0',
        uptime: 12345,
        cache: {
          status: 'healthy',
          latency_ms: 10,
        },
      };

      const mockResponse: ApiResponse<typeof mockHealth> = {
        success: true,
        data: mockHealth,
        metadata: {
          requestId: 'req-health-123',
          timestamp: new Date().toISOString(),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
        headers: new Headers(),
      });

      const health = await client.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.version).toBe('1.0.0');
      expect(health.uptime).toBe(12345);
    });

    it('should handle health check errors', async () => {
      const mockErrorResponse: ApiResponse<never> = {
        success: false,
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: 'Service unavailable',
        },
        metadata: {
          requestId: 'req-health-error-123',
          timestamp: new Date().toISOString(),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockErrorResponse),
        headers: new Headers(),
      });

      await expect(
        client.healthCheck()
      ).rejects.toThrow(AltitraceApiError);
    });
  });

  describe('configuration validation', () => {
    it('should validate required account for asset tracing', async () => {
      const client = new AltitraceClient();

      expect(
        client.simulate()
          .call({
            to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            data: '0xa9059cbb',
          })
          .withAssetChanges(true)
          .execute()
      ).rejects.toThrow('Account parameter is required when traceAssetChanges or traceTransfers is enabled');
    });

    it('should validate block number and tag exclusivity', async () => {
      const client = new AltitraceClient();

      expect(() => {
        client.simulate()
          .call({
            to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            data: '0xa9059cbb',
          })
          .atBlock('0x123')
          .atBlockTag('latest')
          .build();
      }).toThrow('Cannot specify both blockNumber and blockTag - they are mutually exclusive');
    });
  });

  describe('retry logic', () => {
    let client: AltitraceClient;

    beforeEach(() => {
      client = new AltitraceClient({
        timeout: 1000,
      });
    });

    it('should retry on network errors', async () => {
      // First two calls fail, third succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({
            success: true,
            data: {
              simulationId: 'retry-success',
              blockNumber: '0x123abc',
              status: 'success',
              calls: [{
                callIndex: 0,
                status: 'success',
                returnData: '0x01',
                gasUsed: '0x5208',
                logs: [],
              }],
              gasUsed: '0x5208',
              blockGasUsed: '0x5208',
            },
            metadata: {
              requestId: 'retry-req',
              timestamp: new Date().toISOString(),
            },
          }),
          headers: new Headers(),
        });

      const result = await client.simulate()
        .call({
          to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          data: '0xa9059cbb',
        })
        .execute();

      expect(result.simulationId).toBe('retry-success');
      expect(mockFetch).toHaveBeenCalledTimes(3); // Two retries + final success
    });

    it('should fail after exhausting retries', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      await expect(
        client.simulate()
          .call({
            to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            data: '0xa9059cbb',
          })
          .execute()
      ).rejects.toThrow(AltitraceNetworkError);

      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });
});