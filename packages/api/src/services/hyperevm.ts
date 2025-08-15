import { 
  BlockTag, 
  createPublicClient, 
  http, 
  type PublicClient, 
  decodeAbiParameters, 
  type SimulateCallsReturnType,
  type Log,
} from 'viem';
import { defineChain } from 'viem';
import { logger } from '@/utils/logger';
import { RpcError, retryWithBackoff, parseViemError, ContractExecutionError } from '@/utils/errors';
import { decodeEventLogs, getDecoderStats } from '@/utils/eventDecoder';
import type { Hex, Address, BlockNumber, LogEntry } from '@/types/api';

const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';

// Define HyperEVM chain
export const hyperEVM = defineChain({
  id: 999,
  name: 'HyperEVM',
  network: 'hyperevm',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: [RPC_URL],
    },
    public: {
      http: [RPC_URL],
    },
  },
});

export class HyperEVMClient {
  private publicClient: PublicClient;

  constructor() {
    // Create HTTP transport with retry logic
    const httpTransport = http(RPC_URL, {
      retryCount: 3,
      retryDelay: 1000,
      timeout: 30000,
    });

    this.publicClient = createPublicClient({
      chain: hyperEVM,
      transport: httpTransport,
    });

    logger.info({ rpcUrl: RPC_URL }, 'HyperEVM client initialized');
  }

  /**
   * Get the latest block number
   */
  async getBlockNumber(): Promise<bigint> {
    try {
      return await retryWithBackoff(() => this.publicClient.getBlockNumber());
    } catch (error) {
      logger.error({ error }, 'Failed to get block number');
      throw new RpcError('Failed to get block number', { originalError: error });
    }
  }

  /**
   * Get block by number or hash
   */
  async getBlock(blockNumber: BlockNumber = 'latest') {
    try {
      if (blockNumber === 'latest' || blockNumber === 'pending' || blockNumber === 'earliest') {
        return await retryWithBackoff(() => this.publicClient.getBlock({ blockTag: blockNumber }));
      }
      
      const blockNum = BigInt(blockNumber);
      return await retryWithBackoff(() => this.publicClient.getBlock({ blockNumber: blockNum }));
    } catch (error) {
      logger.error({ error, blockNumber }, 'Failed to get block');
      throw new RpcError('Failed to get block', { blockNumber, originalError: error });
    }
  }

  /**
   * Get account balance
   */
  async getBalance(address: Address, blockNumber: BlockNumber = 'latest'): Promise<bigint> {
    try {
      if (blockNumber === 'latest' || blockNumber === 'earliest' || blockNumber === 'pending') {
        return await retryWithBackoff(() => 
          this.publicClient.getBalance({ address: address as `0x${string}`, blockTag: blockNumber })
        );
      }
      
      return await retryWithBackoff(() => 
        this.publicClient.getBalance({ address: address as `0x${string}`, blockNumber: BigInt(blockNumber) })
      );
    } catch (error) {
      logger.error({ error, address, blockNumber }, 'Failed to get balance');
      throw new RpcError('Failed to get balance', { address, blockNumber, originalError: error });
    }
  }

  /**
   * Get account nonce
   */
  async getNonce(address: Address, blockNumber: BlockNumber = 'latest'): Promise<number> {
    try {
      if (blockNumber === 'latest' || blockNumber === 'earliest' || blockNumber === 'pending') {
        return await retryWithBackoff(() =>
          this.publicClient.getTransactionCount({ address: address as `0x${string}`, blockTag: blockNumber })
        );
      }
      
      return await retryWithBackoff(() =>
        this.publicClient.getTransactionCount({ address: address as `0x${string}`, blockNumber: BigInt(blockNumber) })
      );
    } catch (error) {
      logger.error({ error, address, blockNumber }, 'Failed to get nonce');
      throw new RpcError('Failed to get nonce', { address, blockNumber, originalError: error });
    }
  }

  /**
   * Get contract code
   */
  async getCode(address: Address, blockNumber: BlockNumber = 'latest'): Promise<Hex> {
    try {
      if (blockNumber === 'latest' || blockNumber === 'earliest' || blockNumber === 'pending') {
        const code = await retryWithBackoff(() =>
          this.publicClient.getCode({ address: address as `0x${string}`, blockTag: blockNumber })
        );
        return (code || '0x') as Hex;
      }
      
      const code = await retryWithBackoff(() =>
        this.publicClient.getCode({ address: address as `0x${string}`, blockNumber: BigInt(blockNumber) })
      );
      return (code || '0x') as Hex;
    } catch (error) {
      logger.error({ error, address, blockNumber }, 'Failed to get code');
      throw new RpcError('Failed to get code', { address, blockNumber, originalError: error });
    }
  }

  /**
   * Get storage at slot
   */
  async getStorageAt(
    address: Address, 
    slot: Hex, 
    blockNumber: BlockNumber = 'latest'
  ): Promise<Hex> {
    try {
      if (blockNumber === 'latest' || blockNumber === 'earliest' || blockNumber === 'pending') {
        const value = await retryWithBackoff(() =>
          this.publicClient.getStorageAt({ 
            address: address as `0x${string}`, 
            slot: slot as `0x${string}`,
            blockTag: blockNumber 
          })
        );
        return (value || '0x0') as Hex;
      }
      
      const value = await retryWithBackoff(() =>
        this.publicClient.getStorageAt({ 
          address: address as `0x${string}`, 
          slot: slot as `0x${string}`,
          blockNumber: BigInt(blockNumber) 
        })
      );
      return (value || '0x0') as Hex;
    } catch (error) {
      logger.error({ error, address, slot, blockNumber }, 'Failed to get storage');
      throw new RpcError('Failed to get storage', { address, slot, blockNumber, originalError: error });
    }
  }

  /**
   * Simulate a transaction call
   */
  async call(params: {
    to: Address;
    from?: Address;
    data?: Hex;
    value?: Hex;
    gas?: Hex;
    gasPrice?: Hex;
    maxFeePerGas?: Hex;
    maxPriorityFeePerGas?: Hex;
  }, blockNumber: BlockNumber = 'latest'): Promise<Hex> {
    try {
      const baseParams: any = {
        to: params.to as `0x${string}`,
      };

      if (params.from) baseParams.from = params.from as `0x${string}`;
      if (params.data) baseParams.data = params.data as `0x${string}`;
      if (params.value) baseParams.value = BigInt(params.value);
      if (params.gas) baseParams.gas = BigInt(params.gas);
      
      // Handle different transaction types
      if (params.maxFeePerGas || params.maxPriorityFeePerGas) {
        // EIP-1559 transaction
        if (params.maxFeePerGas) baseParams.maxFeePerGas = BigInt(params.maxFeePerGas);
        if (params.maxPriorityFeePerGas) baseParams.maxPriorityFeePerGas = BigInt(params.maxPriorityFeePerGas);
      } else if (params.gasPrice) {
        // Legacy transaction
        baseParams.gasPrice = BigInt(params.gasPrice);
      }
      
      if (blockNumber === 'latest' || blockNumber === 'earliest' || blockNumber === 'pending') {
        baseParams.blockTag = blockNumber;
      } else {
        baseParams.blockNumber = BigInt(blockNumber);
      }
      
      const result = await retryWithBackoff(() => this.publicClient.call(baseParams));
      return (result.data || '0x') as Hex;
    } catch (error) {
      logger.error({ error, params, blockNumber }, 'Transaction call failed');
      throw new RpcError('Transaction call failed', { params, blockNumber, originalError: error });
    }
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(params: {
    to: Address;
    from?: Address;
    data?: Hex;
    value?: Hex;
  }): Promise<bigint> {
    try {
      const gasParams: any = {
        to: params.to as `0x${string}`,
      };
      
      if (params.from) gasParams.account = params.from as `0x${string}`;
      if (params.data) gasParams.data = params.data as `0x${string}`;
      if (params.value) gasParams.value = BigInt(params.value);
      
      return await retryWithBackoff(() => this.publicClient.estimateGas(gasParams));
    } catch (error) {
      logger.error({ error, params }, 'Gas estimation failed');
      throw new RpcError('Gas estimation failed', { params, originalError: error });
    }
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<bigint> {
    try {
      return await retryWithBackoff(() => this.publicClient.getGasPrice());
    } catch (error) {
      logger.error({ error }, 'Failed to get gas price');
      throw new RpcError('Failed to get gas price', { originalError: error });
    }
  }

  /**
   * Simulate multiple calls using Viem's simulateCalls method
   * Enhanced with HyperEVM-specific features and proper typing
   */
  async simulateCalls(params: HyperEVMSimulateCallsParams): Promise<HyperEVMSimulationResult> {
    try {
      const { 
        calls, 
        account,
        blockNumber, 
        blockTag,
        stateOverrides,
        blockOverrides,
        traceAssetChanges,
        traceTransfers,
        validation = true 
      } = params;
      
      // Convert calls to Viem format
      const viemCalls = calls.map(call => ({
        to: call.to as `0x${string}`,
        ...(call.from && { account: call.from as `0x${string}` }),
        ...(call.data && { data: call.data as `0x${string}` }),
        ...(call.value && { value: BigInt(call.value) }),
        ...(call.gas && { gas: BigInt(call.gas) }),
      }));

      // Prepare simulateCalls parameters with proper typing
      const simulateParams: any = {
        calls: viemCalls,
        ...(account && { account: account as `0x${string}` }),
        ...(stateOverrides && { 
          stateOverrides: stateOverrides.map(override => ({
            address: override.address as `0x${string}`,
            ...(override.balance && { balance: override.balance }),
            ...(override.nonce && { nonce: override.nonce }),
            ...(override.code && { code: override.code as `0x${string}` }),
            // Handle state vs stateDiff mutual exclusivity
            ...(override.state && !override.stateDiff && { 
              state: override.state.map(({ slot, value }) => ({
                slot: slot as `0x${string}`,
                value: value as `0x${string}`
              }))
            }),
            ...(override.stateDiff && !override.state && { 
              stateDiff: override.stateDiff.map(({ slot, value }) => ({
                slot: slot as `0x${string}`,
                value: value as `0x${string}`
              }))
            }),
          }))
        }),
        ...(blockOverrides && {
          blockOverrides: {
            ...(blockOverrides.number && { number: BigInt(blockOverrides.number) }),
            ...(blockOverrides.timestamp && { timestamp: BigInt(blockOverrides.timestamp) }),
            ...(blockOverrides.gasLimit && { gasLimit: BigInt(blockOverrides.gasLimit) }),
            ...(blockOverrides.baseFee && { baseFeePerGas: BigInt(blockOverrides.baseFee) }),
            ...(blockOverrides.prevRandao && { prevRandao: blockOverrides.prevRandao as `0x${string}` }),
          }
        }),
        ...(traceAssetChanges !== undefined && { traceAssetChanges }),
        ...(traceTransfers !== undefined && { traceTransfers }),
        ...(validation !== undefined && { validation }),
      };

      // Set block parameter - blockTag takes precedence, then blockNumber
      if (blockTag) {
        // blockTag can be 'latest', 'earliest', 'pending', 'safe', 'finalized'
        simulateParams.blockTag = blockTag;
      } else if (blockNumber) {
        // blockNumber is ALWAYS a hex number (like "0x123abc")
        simulateParams.blockNumber = BigInt(blockNumber);
      }
      // If neither blockTag nor blockNumber is specified, Viem defaults to 'latest'

      // Execute simulateCalls via Viem with proper typing
      const result = await retryWithBackoff(() => 
        this.publicClient.simulateCalls(simulateParams)
      );
      
      if (result.assetChanges) {
        logger.debug({ assetChanges: result.assetChanges }, 'Asset changes detected');
      }
      
      // For single call: throw error if validation enabled and call failed
      // For multiple calls: always return results for each call
      const hasSingleCall = result.results.length === 1;
      
      if (validation && hasSingleCall) {
        const callResult = result.results[0];
        if (callResult.status === 'failure' && callResult.error) {
          // Throw the error to be handled by our error parsing for single calls
          throw callResult.error;
        }
      }

      // Format response to match our HyperEVM API structure
      return {
        blockNumber: result.block.number || undefined,
        calls: result.results.map((callResult: any, index: number) => {
          const status = callResult.status === 'success' ? 'success' as const : 'reverted' as const;
          const returnData = callResult.result || callResult.data || '0x';
          
          // Parse revert reason from return data if call failed
          let parsedError;
          if (status === 'reverted') {
            parsedError = parseRevertData(returnData);
            
            // Also try to extract from error object if available
            if (!parsedError && callResult.error) {
              const error = callResult.error as any;
              parsedError = {
                reason: extractRevertReasonFromCallResult(error),
                type: 'Unknown error',
                message: error.shortMessage || error.message,
                contractAddress: error.contractAddress,
              };
            }
          }
          
          // Decode event logs for human readability
          const rawLogs = (callResult.logs || []) as Log[];
          const formattedLogs: LogEntry[] = rawLogs.map(log => ({
            address: log.address,
            blockHash: log.blockHash,
            blockNumber: log.blockNumber?.toString() || null,
            data: log.data,
            logIndex: log.logIndex?.toString() || null,
            transactionHash: log.transactionHash,
            transactionIndex: log.transactionIndex?.toString() || null,
            topics: log.topics,
            removed: log.removed || false,
          }));
          
          const decodedLogs = decodeEventLogs(formattedLogs);
          
          // Log decoder statistics for monitoring
          if (decodedLogs.length > 0) {
            const stats = getDecoderStats(decodedLogs);
            logger.debug({
              callIndex: index,
              decoderStats: stats,
            }, 'Event decoding completed');
          }
          
          const callResponse = {
            callIndex: index,
            status,
            returnData: String(returnData),
            gasUsed: callResult.gasUsed || 0n,
            logs: decodedLogs,
            ...(parsedError && { error: parsedError }),
          };
          
          return callResponse;
        }),
        gasUsed: result.results.reduce((total: bigint, call) => total + (call.gasUsed || 0n), 0n),
        blockGasUsed: result.results.reduce((total: bigint, call) => total + (call.gasUsed || 0n), 0n),
        ...(result.assetChanges && { assetChanges: result.assetChanges }),
      };
    } catch (error) {
      logger.error({ error, params }, 'simulateCalls failed');
      
      // Parse Viem errors to provide meaningful error messages
      const parsedError = parseViemError(error);
      throw parsedError;
    }
  }

  /**
   * Check connection health
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.getBlockNumber();
      return true;
    } catch (error) {
      logger.warn({ error }, 'HyperEVM health check failed');
      return false;
    }
  }

}

/**
 * HyperEVM-specific simulation parameters extending viem's SimulateCallsParameters
 */
type HyperEVMSimulateCallsParams = {
  calls: Array<{
    to: Address;
    from?: Address;
    data?: Hex;
    value?: Hex;
    gas?: Hex;
  }>;
  account?: Address;
  blockNumber?: BlockNumber;
  blockTag?: BlockTag;
  stateOverrides?: Array<{
    address: Address;
    balance?: bigint;
    nonce?: number;
    code?: Hex;
    state?: Array<{ slot: Hex; value: Hex }>;
    stateDiff?: Array<{ slot: Hex; value: Hex }>;
  }>;
  blockOverrides?: {
    number?: Hex;
    timestamp?: Hex;
    gasLimit?: Hex;
    baseFee?: Hex;
    prevRandao?: Hex;
  };
  traceAssetChanges?: boolean;
  traceTransfers?: boolean;
  validation?: boolean;
};

/**
 * HyperEVM simulation result with enhanced typing
 */
type HyperEVMSimulationResult = {
  blockNumber: bigint | undefined;
  calls: Array<{
    callIndex: number;
    status: 'success' | 'reverted';
    returnData: string;
    gasUsed: bigint;
    logs: LogEntry[];
    error?: {
      reason: string;
      type: string;
      message?: string;
      contractAddress?: string;
    };
  }>;
  gasUsed: bigint;
  blockGasUsed: bigint;
  assetChanges?: SimulateCallsReturnType['assetChanges'];
};

/**
 * Parse revert data to extract error message with enhanced typing
 */
function parseRevertData(returnData: string): { reason: string; type: string } | null {
  if (!returnData || returnData === '0x' || returnData.length < 10) {
    return null;
  }

  try {
    // Check for standard Error(string) - 0x08c379a0
    if (returnData.startsWith('0x08c379a0')) {
      const errorData = `0x${returnData.slice(10)}`; // Remove function selector
      const decoded = decodeAbiParameters([{ type: 'string' }], errorData as `0x${string}`);
      return {
        reason: decoded[0] as string,
        type: 'Error(string)',
      };
    }

    // Check for Panic(uint256) - 0x4e487b71
    if (returnData.startsWith('0x4e487b71')) {
      const errorData = `0x${returnData.slice(10)}`;
      const decoded = decodeAbiParameters([{ type: 'uint256' }], errorData as `0x${string}`);
      const panicCode = decoded[0] as bigint;
      return {
        reason: getPanicReason(panicCode),
        type: 'Panic(uint256)',
      };
    }

    // For custom errors, just return the raw data
    return {
      reason: returnData,
      type: 'Custom error',
    };
  } catch (error) {
    // If decoding fails, return null
    return null;
  }
}

/**
 * Get human-readable panic reason from panic code
 * Based on OpenZeppelin's Panic library constants (https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/Panic.sol)
 */
function getPanicReason(code: bigint): string {
  const panicCodes: Record<string, string> = {
    '0': 'Generic / unspecified error',
    '1': 'Assert failed (used by assert() builtin)',
    '17': 'Arithmetic underflow or overflow', 
    '18': 'Division or modulo by zero',
    '33': 'Enum conversion error',
    '34': 'Invalid encoding in storage',
    '49': 'Empty array pop',
    '50': 'Array out of bounds access',
    '65': 'Resource error (too large allocation or too large array)',
    '81': 'Calling invalid internal function',
  };

  return panicCodes[code.toString()] || `Panic code: ${code}`;
}

/**
 * Extract revert reason from call result error with proper typing
 */
function extractRevertReasonFromCallResult(error: any): string {
  // Try the reason field first
  if (error.reason) {
    const reasonMatch = error.reason.match(/(?:execution reverted: )?(.+)/);
    return reasonMatch ? reasonMatch[1] : error.reason;
  }

  // Try shortMessage
  if (error.shortMessage) {
    const shortMatch = error.shortMessage.match(/execution reverted: (.+)/);
    if (shortMatch) {
      return shortMatch[1];
    }
  }

  // Try cause.reason (nested error)
  if (error.cause && error.cause.reason) {
    const causeMatch = error.cause.reason.match(/(?:execution reverted: )?(.+)/);
    return causeMatch ? causeMatch[1] : error.cause.reason;
  }

  return 'Unknown revert reason';
}

// Singleton instance
export const hyperevmClient = new HyperEVMClient();