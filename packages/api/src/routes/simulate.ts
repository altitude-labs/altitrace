import type { FastifyPluginAsync } from 'fastify';
import { 
  SimulateRequestSchema, 
  BatchSimulateRequestSchema,
  type SimulateRequest,
  type SimulationResult,
  type Call 
} from '@/types/api';
import { createSuccessResponse } from '@/utils/helpers';
import { SimulationError } from '@/utils/errors';
import { hyperevmClient } from '@/services/hyperevm';
import { validateGas, validateAddress, validateValue, validateHex, bigintToHex, ValidationError } from '@/utils/validation';

const simulateRoutes: FastifyPluginAsync = async (fastify) => {
  
  // Single transaction simulation
  fastify.post('/simulate', {
    schema: {
      description: 'Simulate a single transaction',
      summary: 'Simulate transaction execution on HyperEVM',
      tags: ['Simulation'],
      body: {
        type: 'object',
        properties: {
          params: {
            type: 'object',
            properties: {
              calls: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  properties: {
                    to: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                    from: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                    data: { type: 'string', pattern: '^0x[a-fA-F0-9]*$' },
                    value: { type: 'string', pattern: '^0x[a-fA-F0-9]*$', default: '0x0' },
                    gas: { type: 'string', pattern: '^0x[a-fA-F0-9]*$' },
                  },
                  required: ['to'],
                },
              },
              blockNumber: { 
                anyOf: [
                  { type: 'string', pattern: '^0x[a-fA-F0-9]+$' },
                  { type: 'string', enum: ['latest', 'earliest', 'pending'] }
                ],
                default: 'latest'
              },
              validation: { type: 'boolean', default: true },
            },
            required: ['calls'],
          },
          options: {
            type: 'object',
            properties: {
              stateOverrides: { type: 'object' },
              blockOverrides: { type: 'object' },
              traceConfig: { type: 'object' },
            },
          },
        },
        required: ['params'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                blockNumber: { type: 'string', pattern: '^0x[a-fA-F0-9]+$' },
                calls: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      returnData: { type: 'string', pattern: '^0x[a-fA-F0-9]*$' },
                      gasUsed: { type: 'string', pattern: '^0x[a-fA-F0-9]+$' },
                      logs: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                            topics: { type: 'array', items: { type: 'string' } },
                            data: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
                gasUsed: { type: 'string', pattern: '^0x[a-fA-F0-9]+$' },
                blockGasUsed: { type: 'string', pattern: '^0x[a-fA-F0-9]+$' },
              },
            },
            timestamp: { type: 'string' },
            requestId: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      // Validate request body
      const validatedBody = SimulateRequestSchema.parse(request.body);
      
      // Perform simulation using simulateCalls directly
      const result = await hyperevmClient.simulateCalls({
        calls: validatedBody.params.calls,
        blockNumber: validatedBody.params.blockNumber || 'latest',
        stateOverrides: validatedBody.options?.stateOverrides,
        blockOverrides: validatedBody.options?.blockOverrides,
        validation: validatedBody.params.validation !== false,
      });
      
      // Convert bigint values to hex strings for JSON response
      const formattedResult = {
        blockNumber: `0x${result.blockNumber.toString(16)}`,
        calls: result.calls.map(call => ({
          status: call.status,
          returnData: call.returnData,
          gasUsed: `0x${call.gasUsed.toString(16)}`,
          logs: call.logs || [],
          ...(call.error && { error: call.error }),
        })),
        gasUsed: `0x${result.gasUsed.toString(16)}`,
        blockGasUsed: `0x${result.blockGasUsed.toString(16)}`,
      };
      
      reply.send(createSuccessResponse(formattedResult, request.id));
    } catch (error) {
      fastify.log.error({ error, requestId: request.id }, 'Simulation failed');
      throw error;
    }
  });

  // Batch transaction simulation
  fastify.post('/simulate/batch', {
    schema: {
      description: 'Simulate multiple transaction batches',
      summary: 'Batch simulate multiple sets of transactions',
      tags: ['Simulation'],
      body: {
        type: 'object',
        properties: {
          simulations: {
            type: 'array',
            minItems: 1,
            maxItems: 10, // Reduced max for simulateCalls approach
            items: {
              type: 'object',
              properties: {
                params: {
                  type: 'object',
                  properties: {
                    calls: {
                      type: 'array',
                      minItems: 1,
                      items: {
                        type: 'object',
                        properties: {
                          to: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                          from: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                          data: { type: 'string', pattern: '^0x[a-fA-F0-9]*$' },
                          value: { type: 'string', pattern: '^0x[a-fA-F0-9]*$', default: '0x0' },
                          gas: { type: 'string', pattern: '^0x[a-fA-F0-9]*$' },
                        },
                        required: ['to'],
                      },
                    },
                    blockNumber: { 
                      anyOf: [
                        { type: 'string', pattern: '^0x[a-fA-F0-9]+$' },
                        { type: 'string', enum: ['latest', 'earliest', 'pending'] }
                      ],
                      default: 'latest'
                    },
                    validation: { type: 'boolean', default: true },
                  },
                  required: ['calls'],
                },
                options: { type: 'object' },
              },
              required: ['params'],
            },
          },
        },
        required: ['simulations'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  blockNumber: { type: 'string', pattern: '^0x[a-fA-F0-9]+$' },
                  calls: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        returnData: { type: 'string', pattern: '^0x[a-fA-F0-9]*$' },
                        gasUsed: { type: 'string', pattern: '^0x[a-fA-F0-9]+$' },
                      },
                    },
                  },
                  gasUsed: { type: 'string', pattern: '^0x[a-fA-F0-9]+$' },
                  blockGasUsed: { type: 'string', pattern: '^0x[a-fA-F0-9]+$' },
                },
              },
            },
            timestamp: { type: 'string' },
            requestId: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      // Validate request body
      const validatedBody = BatchSimulateRequestSchema.parse(request.body);
      
      // Perform batch simulation - each simulation runs independently
      const results = await Promise.all(
        validatedBody.simulations.map(async (simulation) => {
          const result = await hyperevmClient.simulateCalls({
            calls: simulation.params.calls,
            blockNumber: simulation.params.blockNumber || 'latest',
            stateOverrides: simulation.options?.stateOverrides,
            blockOverrides: simulation.options?.blockOverrides,
            validation: simulation.params.validation !== false,
          });
          
          // Format result for JSON response
          return {
            blockNumber: `0x${result.blockNumber.toString(16)}`,
            calls: result.calls.map(call => ({
              status: call.status,
              returnData: call.returnData,
              gasUsed: `0x${call.gasUsed.toString(16)}`,
              logs: call.logs || [],
              ...(call.error && { error: call.error }),
            })),
            gasUsed: `0x${result.gasUsed.toString(16)}`,
            blockGasUsed: `0x${result.blockGasUsed.toString(16)}`,
          };
        })
      );
      
      reply.send(createSuccessResponse(results, request.id));
    } catch (error) {
      fastify.log.error({ error, requestId: request.id }, 'Batch simulation failed');
      throw error;
    }
  });

  // Gas estimation endpoint
  fastify.post('/gas/estimate', {
    schema: {
      description: 'Estimate gas for a transaction',
      summary: 'Estimate gas cost for transaction execution',
      tags: ['Gas'],
      body: {
        type: 'object',
        properties: {
          to: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          from: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          data: { type: 'string', pattern: '^0x[a-fA-F0-9]*$' },
          value: { type: 'string', pattern: '^0x[a-fA-F0-9]*$' },
        },
        required: ['to'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                gasEstimate: { type: 'string' },
                gasPrice: { type: 'string' },
              },
            },
            timestamp: { type: 'string' },
            requestId: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { to, from, data, value } = request.body as any;
      
      // Validate parameters
      const cleanedParams = {
        to: validateAddress(to, 'to'),
        ...(from && { from: validateAddress(from, 'from') }),
        ...(data && { data: validateHex(data, 'data') }),
        ...(value && { value: validateValue(value, 'value') }),
      };
      
      const [gasEstimate, gasPrice] = await Promise.all([
        hyperevmClient.estimateGas(cleanedParams),
        hyperevmClient.getGasPrice(),
      ]);
      
      const result = {
        gasEstimate: bigintToHex(gasEstimate),
        gasPrice: bigintToHex(gasPrice),
      };
      
      reply.send(createSuccessResponse(result, request.id));
    } catch (error: any) {
      // Handle validation errors with detailed information
      if (error instanceof ValidationError) {
        const validationError = new SimulationError(`Invalid parameter '${error.field}': ${error.message}`, { 
          field: error.field,
          value: error.value,
          validationCode: error.code,
          code: 'INVALID_PARAMS'
        });
        fastify.log.error({ error: validationError, requestId: request.id }, 'Parameter validation failed');
        throw validationError;
      }
      
      fastify.log.error({ error, requestId: request.id }, 'Gas estimation failed');
      throw error;
    }
  });
};


export default simulateRoutes;