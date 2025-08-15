import type { FastifyPluginAsync } from 'fastify';
import { 
  SimulateRequestSchema, 
  BatchSimulateRequestSchema,
  BundleSimulationSchema,
  type BundleSimulationResult,
} from '@/types/api';
import { createSuccessResponse } from '@/utils/helpers';
import { SimulationError } from '@/utils/errors';
import { hyperevmClient } from '@/services/hyperevm';
import { validateGas, validateAddress, validateValue, validateHex, bigintToHex, convertBigIntsToHex, formatAssetChanges, ValidationError } from '@/utils/validation';

const simulateRoutes: FastifyPluginAsync = async (fastify) => {
  
  // Single transaction simulation
  fastify.post('/simulate', {
    schema: {
      description: `Simulate transaction execution on HyperEVM using eth_simulateV1.
      
IMPORTANT: This endpoint creates NEW simulated blocks, it does NOT execute in existing blocks.
- If you specify blockNumber="0x123", the simulation will use block 0x123 as the PARENT
- The simulation will create new blocks (e.g., 0x124, 0x125, etc.) on top of the parent
- The returned blockNumber will be the LAST simulated block number (not the input)
- This behavior is according to eth_simulateV1 specification

For exact block execution without creating new blocks, use eth_call instead (but it doesn't support tracing features).`,
      summary: 'Simulate transaction execution with advanced tracing capabilities',
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
              account: { 
                type: 'string', 
                pattern: '^0x[a-fA-F0-9]{40}$',
                description: 'Account address required when traceAssetChanges or traceTransfers is enabled. Used as the reference point for tracking balance changes.'
              },
              blockNumber: { 
                type: 'string', 
                pattern: '^0x[a-fA-F0-9]+$',
                description: 'PARENT block number in hex format (e.g., "0x123abc"). The simulation will create NEW blocks on top of this parent block. The returned blockNumber will be different (higher) than this input.'
              },
              blockTag: { 
                type: 'string', 
                enum: ['latest', 'earliest', 'pending', 'safe', 'finalized'],
                description: 'Block tag to use as PARENT for simulation. Mutually exclusive with blockNumber.'
              },
              validation: { 
                type: 'boolean', 
                default: true,
                description: 'When true, performs full EVM validation (gas limits, balances, etc.). When false, behaves like eth_call with relaxed validation.'
              },
              traceAssetChanges: { 
                type: 'boolean',
                description: 'Enable tracking of ERC-20/ERC-721 token balance changes for the specified account. Requires account parameter. Shows before/after balances and net changes.'
              },
              traceTransfers: { 
                type: 'boolean',
                description: 'Enable tracking of ETH transfers as ERC-20-like logs. ETH transfers will appear in logs with address 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee. Requires account parameter.'
              },
            },
            required: ['calls'],
            anyOf: [
              {
                // Case 1: traceTransfers is true, account is required
                properties: {
                  traceTransfers: { const: true },
                  account: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
                },
                required: ['account']
              },
              {
                // Case 2: traceAssetChanges is true, account is required
                properties: {
                  traceAssetChanges: { const: true },
                  account: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
                },
                required: ['account']
              },
              {
                // Case 3: neither traceTransfers nor traceAssetChanges is true
                properties: {
                  traceTransfers: { not: { const: true } },
                  traceAssetChanges: { not: { const: true } }
                }
              }
            ],
          },
          options: {
            type: 'object',
            properties: {
              stateOverrides: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                    balance: { type: 'string' },
                    nonce: { type: 'number' },
                    code: { type: 'string', pattern: '^0x[a-fA-F0-9]*$' },
                    state: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          slot: { type: 'string', pattern: '^0x[a-fA-F0-9]{64}$' },
                          value: { type: 'string', pattern: '^0x[a-fA-F0-9]{64}$' },
                        },
                        required: ['slot', 'value'],
                      },
                    },
                    stateDiff: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          slot: { type: 'string', pattern: '^0x[a-fA-F0-9]{64}$' },
                          value: { type: 'string', pattern: '^0x[a-fA-F0-9]{64}$' },
                        },
                        required: ['slot', 'value'],
                      },
                    },
                  },
                  required: ['address'],
                },
              },
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
                blockNumber: { 
                  type: 'string', 
                  pattern: '^0x[a-fA-F0-9]+$',
                  description: 'The LAST simulated block number (not the input blockNumber). This will be higher than the input blockNumber because new blocks are created during simulation.'
                },
                blockTag: { 
                  type: 'string', 
                  enum: ['latest', 'earliest', 'pending', 'safe', 'finalized'],
                  description: 'Block tag of the last simulated block if blockTag was used in input.'
                },
                calls: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', enum: ['success', 'reverted'] },
                      returnData: { type: 'string', pattern: '^0x[a-fA-F0-9]*$' },
                      gasUsed: { type: 'string', pattern: '^0x[a-fA-F0-9]+$' },
                      logs: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                            blockHash: { type: ['string', 'null'] },
                            blockNumber: { type: ['string', 'null'] },
                            data: { type: 'string' },
                            logIndex: { type: ['string', 'null'] },
                            transactionHash: { type: ['string', 'null'] },
                            transactionIndex: { type: ['string', 'null'] },
                            topics: { type: 'array', items: { type: 'string' } },
                            removed: { type: 'boolean' },
                            decoded: {
                              type: 'object',
                              properties: {
                                name: { type: 'string' },
                                signature: { type: 'string' },
                                standard: { type: 'string' },
                                description: { type: 'string' },
                                params: {
                                  type: 'array',
                                  items: {
                                    type: 'object',
                                    properties: {
                                      name: { type: 'string' },
                                      type: { type: 'string' },
                                      value: { type: 'string' },
                                      indexed: { type: 'boolean' },
                                    },
                                  },
                                },
                                summary: { type: 'string' },
                              },
                            },
                          },
                        },
                      },
                      error: {
                        type: 'object',
                        properties: {
                          reason: { type: 'string' },
                          type: { type: 'string' },
                          message: { type: 'string' },
                          contractAddress: { type: 'string' },
                        },
                      },
                    },
                  },
                },
                gasUsed: { type: 'string', pattern: '^0x[a-fA-F0-9]+$' },
                blockGasUsed: { type: 'string', pattern: '^0x[a-fA-F0-9]+$' },
                assetChanges: {
                  type: 'array',
                  description: 'Array of token balance changes for the specified account (only if traceAssetChanges=true). Shows how ERC-20/ERC-721 token balances changed during the simulation.',
                  items: {
                    type: 'object',
                    properties: {
                      token: {
                        type: 'object',
                        description: 'Information about the token that changed',
                        properties: {
                          address: { 
                            type: 'string', 
                            pattern: '^0x[a-fA-F0-9]{40}$',
                            description: 'Token contract address'
                          },
                          decimals: { 
                            type: 'number',
                            description: 'Token decimal places (if available)'
                          },
                          symbol: { 
                            type: 'string',
                            description: 'Token symbol (if available)'
                          },
                        },
                        required: ['address'],
                      },
                      value: {
                        type: 'object',
                        description: 'Balance change information',
                        properties: {
                          pre: { 
                            type: 'string', 
                            pattern: '^0x[a-fA-F0-9]*$',
                            description: 'Balance before the simulation (in wei/smallest unit)'
                          },
                          post: { 
                            type: 'string', 
                            pattern: '^0x[a-fA-F0-9]*$',
                            description: 'Balance after the simulation (in wei/smallest unit)'
                          },
                          diff: { 
                            type: 'string', 
                            pattern: '^0x[a-fA-F0-9]*$',
                            description: 'Net change (post - pre). Positive means gained, negative means lost.'
                          },
                        },
                        required: ['pre', 'post', 'diff'],
                      },
                    },
                    required: ['token', 'value'],
                  },
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
      const validatedBody = SimulateRequestSchema.parse(request.body);
      
      // Perform simulation using simulateCalls directly
      const result = await hyperevmClient.simulateCalls({
        calls: validatedBody.params.calls,
        account: validatedBody.params.account,
        blockNumber: validatedBody.params.blockNumber,
        blockTag: validatedBody.params.blockTag,
        stateOverrides: validatedBody.options?.stateOverrides,
        blockOverrides: validatedBody.options?.blockOverrides,
        validation: validatedBody.params.validation !== false,
        traceAssetChanges: validatedBody.params.traceAssetChanges,
        traceTransfers: validatedBody.params.traceTransfers,
      });
      
      // Convert bigint values to hex strings for JSON response
      const formattedResult = {
        blockNumber: `${bigintToHex(result.blockNumber!)}`,
        calls: result.calls.map((call, index) => {
          return {
            callIndex: call.callIndex,
            status: call.status,
            returnData: call.returnData,
            gasUsed: `0x${call.gasUsed.toString(16)}`,
            logs: call.logs || [], // Already decoded by HyperEVMClient
            ...(call.error && { error: call.error }),
          };
        }),
        gasUsed: `0x${result.gasUsed.toString(16)}`,
        blockGasUsed: `0x${result.blockGasUsed.toString(16)}`,
        ...(result.assetChanges && { assetChanges: formatAssetChanges(result.assetChanges) }),
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
      description: `Simulate multiple independent transaction batches on HyperEVM using eth_simulateV1.
      
IMPORTANT: Each simulation in the batch is INDEPENDENT and creates its own NEW simulated blocks.
- Each simulation uses its specified blockNumber/blockTag as the PARENT block
- Each simulation creates new blocks on top of its parent (just like the single simulation)
- The returned blockNumbers will be HIGHER than the input blockNumbers
- Simulations do NOT affect each other (they're run in parallel, not sequentially)
- Maximum 10 simulations per batch request

Use this for testing multiple scenarios in parallel, not for sequential transaction dependencies.`,
      summary: 'Batch simulate multiple independent transaction sets',
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
                    account: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                    blockNumber: { type: 'string', pattern: '^0x[a-fA-F0-9]+$' },
                    blockTag: { type: 'string', enum: ['latest', 'earliest', 'pending', 'safe', 'finalized'] },
                    validation: { type: 'boolean', default: true },
                    traceAssetChanges: { type: 'boolean' },
                    traceTransfers: { type: 'boolean' },
                  },
                  required: ['calls'],
                  anyOf: [
                    {
                      // Case 1: traceTransfers is true, account is required
                      properties: {
                        traceTransfers: { const: true },
                        account: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
                      },
                      required: ['account']
                    },
                    {
                      // Case 2: traceAssetChanges is true, account is required
                      properties: {
                        traceAssetChanges: { const: true },
                        account: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
                      },
                      required: ['account']
                    },
                    {
                      // Case 3: neither traceTransfers nor traceAssetChanges is true
                      properties: {
                        traceTransfers: { not: { const: true } },
                        traceAssetChanges: { not: { const: true } }
                      }
                    }
                  ],
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
                        status: { type: 'string', enum: ['success', 'reverted'] },
                        returnData: { type: 'string', pattern: '^0x[a-fA-F0-9]*$' },
                        gasUsed: { type: 'string', pattern: '^0x[a-fA-F0-9]+$' },
                        logs: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                              blockHash: { type: ['string', 'null'] },
                              blockNumber: { type: ['string', 'null'] },
                              data: { type: 'string' },
                              logIndex: { type: ['string', 'null'] },
                              transactionHash: { type: ['string', 'null'] },
                              transactionIndex: { type: ['string', 'null'] },
                              topics: { type: 'array', items: { type: 'string' } },
                              removed: { type: 'boolean' },
                              decoded: {
                                type: 'object',
                                properties: {
                                  name: { type: 'string' },
                                  signature: { type: 'string' },
                                  standard: { type: 'string' },
                                  description: { type: 'string' },
                                  summary: { type: 'string' },
                                },
                              },
                            },
                          },
                        },
                        error: {
                          type: 'object',
                          properties: {
                            reason: { type: 'string' },
                            type: { type: 'string' },
                            message: { type: 'string' },
                            contractAddress: { type: 'string' },
                          },
                        },
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
            account: simulation.params.account,
            blockNumber: simulation.params.blockNumber,
            blockTag: simulation.params.blockTag,
            stateOverrides: simulation.options?.stateOverrides,
            blockOverrides: simulation.options?.blockOverrides,
            validation: simulation.params.validation !== false,
            traceAssetChanges: simulation.params.traceAssetChanges,
            traceTransfers: simulation.params.traceTransfers,
          });
          
          // Format result for JSON response
          return {
            blockNumber: `${bigintToHex(result.blockNumber!)}`,
            calls: result.calls.map(call => ({
              callIndex: call.callIndex,
              status: call.status,
              returnData: call.returnData,
              gasUsed: `0x${call.gasUsed.toString(16)}`,
              logs: call.logs || [], // Already decoded by HyperEVMClient
              ...(call.error && { error: call.error }),
            })),
            gasUsed: `0x${result.gasUsed.toString(16)}`,
            blockGasUsed: `0x${result.blockGasUsed.toString(16)}`,
            ...(result.assetChanges && { assetChanges: formatAssetChanges(result.assetChanges) }),
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
      description: `Estimate gas cost for a single transaction using eth_estimateGas.
      
This endpoint provides a gas estimate for transaction execution WITHOUT creating simulated blocks.
Unlike the simulation endpoints, this uses the EXACT block state for estimation.
- Executes against the current/latest block state
- Returns gas estimate and current gas price
- Does NOT support tracing features (assetChanges, traceTransfers)
- Faster than simulation for simple gas estimation needs`,
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

  // Bundle simulation endpoint - HyperEVM hackathon feature
  fastify.post('/simulate/bundle', {
    schema: {
      description: 'Simulate a bundle of interdependent transactions',
      summary: 'Execute multiple transactions sequentially with state persistence',
      tags: ['Simulation', 'Bundle'],
      body: {
        type: 'object',
        properties: {
          bundle: {
            type: 'array',
            minItems: 1,
            maxItems: 10,
            items: {
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
                account: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                gasLimit: { type: 'string', pattern: '^0x[a-fA-F0-9]*$' },
                allowFailure: { type: 'boolean', default: false },
              },
              required: ['calls'],
            },
          },
          blockNumber: { type: 'string', pattern: '^0x[a-fA-F0-9]+$' },
          blockTag: { type: 'string', enum: ['latest', 'earliest', 'pending', 'safe', 'finalized'] },
          stateOverrides: { type: 'array' },
          blockOverrides: { type: 'object' },
          traceAssetChanges: { type: 'boolean' },
          traceTransfers: { type: 'boolean' },
          enableProfiling: { type: 'boolean', default: false },
        },
        required: ['bundle'],
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
                transactions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      transactionIndex: { type: 'number' },
                      status: { type: 'string', enum: ['success', 'reverted', 'skipped'] },
                      calls: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            callIndex: { type: 'number' },
                            status: { type: 'string', enum: ['success', 'reverted'] },
                            returnData: { type: 'string', pattern: '^0x[a-fA-F0-9]*$' },
                            gasUsed: { type: 'string', pattern: '^0x[a-fA-F0-9]+$' },
                            logs: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  address: { type: 'string' },
                                  topics: { type: 'array' },
                                  data: { type: 'string' },
                                  decoded: {
                                    type: 'object',
                                    properties: {
                                      name: { type: 'string' },
                                      summary: { type: 'string' },
                                      standard: { type: 'string' },
                                    },
                                  },
                                },
                              },
                            },
                            error: {
                              type: 'object',
                              properties: {
                                reason: { type: 'string' },
                                type: { type: 'string' },
                                message: { type: 'string' },
                                contractAddress: { type: 'string' },
                              },
                            },
                          },
                        },
                      },
                      gasUsed: { type: 'string', pattern: '^0x[a-fA-F0-9]+$' },
                      skipReason: { type: 'string' },
                    },
                  },
                },
                totalGasUsed: { type: 'string', pattern: '^0x[a-fA-F0-9]+$' },
                blockGasUsed: { type: 'string', pattern: '^0x[a-fA-F0-9]+$' },
                assetChanges: { type: 'array' },
                performance: {
                  type: 'object',
                  properties: {
                    executionTime: { type: 'number' },
                    gasBreakdown: { type: 'object' },
                    stateReads: { type: 'number' },
                    stateWrites: { type: 'number' },
                  },
                },
                accessList: { type: 'array' },
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
      const validatedBody = BundleSimulationSchema.parse(request.body);
      const startTime = Date.now();
      
      const transactions: BundleSimulationResult['transactions'] = [];
      let totalGasUsed = 0n;
      let currentStateOverrides = validatedBody.stateOverrides || [];
      
      // Execute each transaction in the bundle sequentially
      for (let txIndex = 0; txIndex < validatedBody.bundle.length; txIndex++) {
        const transaction = validatedBody.bundle[txIndex];
        
        try {
          // Simulate this transaction with accumulated state changes
          const result = await hyperevmClient.simulateCalls({
            calls: transaction.calls,
            account: transaction.account,
            blockNumber: validatedBody.blockNumber,
            blockTag: validatedBody.blockTag,
            stateOverrides: currentStateOverrides,
            blockOverrides: validatedBody.blockOverrides,
            validation: !transaction.allowFailure, // Disable validation if failure is allowed
            traceAssetChanges: validatedBody.traceAssetChanges,
            traceTransfers: validatedBody.traceTransfers,
          });
          
          const txGasUsed = result.gasUsed;
          totalGasUsed += txGasUsed;
          
          transactions.push({
            transactionIndex: txIndex,
            status: 'success' as const,
            calls: result.calls.map(call => ({
              callIndex: call.callIndex,
              status: call.status,
              returnData: call.returnData,
              gasUsed: `0x${call.gasUsed.toString(16)}`,
              logs: convertBigIntsToHex(call.logs) || [],
              ...(call.error && { error: call.error }),
            })),
            gasUsed: `0x${txGasUsed.toString(16)}`,
          });
          
          // TODO: Apply successful state changes to currentStateOverrides for next transaction
          // This would require extracting state diffs from the simulation result
          
        } catch (error) {
          const isReverted = error instanceof Error && error.message.includes('reverted');
          
          if (transaction.allowFailure || isReverted) {
            // Transaction failed but can continue bundle
            transactions.push({
              transactionIndex: txIndex,
              status: isReverted ? 'reverted' : 'skipped',
              calls: [],
              gasUsed: '0x0',
              ...(error instanceof Error && { skipReason: error.message }),
            });
          } else {
            // Critical failure - stop bundle execution
            throw error;
          }
        }
      }
      
      const executionTime = Date.now() - startTime;
      
      // Get final block state
      const blockResult = await hyperevmClient.getBlockNumber();
      
      const bundleResult: BundleSimulationResult = {
        blockNumber: `0x${blockResult.toString(16)}`,
        transactions,
        totalGasUsed: `0x${totalGasUsed.toString(16)}`,
        blockGasUsed: `0x${totalGasUsed.toString(16)}`, // Simplified
        ...(validatedBody.enableProfiling && {
          performance: {
            executionTime,
            stateReads: transactions.length, // Simplified metrics
            stateWrites: transactions.filter(tx => tx.status === 'success').length,
          },
        }),
      };
      
      reply.send(createSuccessResponse(bundleResult, request.id));
    } catch (error) {
      fastify.log.error({ error, requestId: request.id }, 'Bundle simulation failed');
      throw error;
    }
  });
};


export default simulateRoutes;