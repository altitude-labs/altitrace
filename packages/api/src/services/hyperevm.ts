import { createPublicClient, http, type PublicClient } from 'viem';
import { defineChain } from 'viem';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';
import { RpcError, retryWithBackoff } from '@/utils/errors';
import type { Hex, Address, BlockNumber } from '@/types/api';

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
          this.publicClient.getBytecode({ address: address as `0x${string}`, blockTag: blockNumber })
        );
        return (code || '0x') as Hex;
      }
      
      const code = await retryWithBackoff(() =>
        this.publicClient.getBytecode({ address: address as `0x${string}`, blockNumber: BigInt(blockNumber) })
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

// Singleton instance
export const hyperevmClient = new HyperEVMClient();