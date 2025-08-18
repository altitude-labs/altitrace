/**
 * @fileoverview Simulation request builder
 */

import type {
  SimulationRequest,
  SimulationRequestBuilder,
  SimulationParams,
  SimulationOptions,
  TransactionCall,
  StateOverride,
  BlockOverrides,
  BlockTag,
  ExtendedSimulationResult,
  TransactionCallConfig,
  Address,
  HexString,
} from '@sdk/types/simulation';
import { ValidationUtils } from '@sdk/utils/validation';
import { ValidationError } from '@sdk/core/errors';

/**
 * Implementation of the simulation request builder.
 */
class SimulationBuilderImpl implements SimulationRequestBuilder {
  private params: Partial<SimulationParams> = {
    calls: [],
    validation: true,
    traceAssetChanges: false,
    traceTransfers: false,
  };

  private options: Partial<SimulationOptions> = {};
  private client?: any; // Will be injected

  constructor(client?: any) {
    this.client = client;
  }

  call(call: TransactionCall | TransactionCallConfig): SimulationRequestBuilder {
    const normalizedCall = this.normalizeCall(call);
    this.params.calls = this.params.calls || [];
    this.params.calls.push(normalizedCall);
    return this;
  }

  forAccount(account: string): SimulationRequestBuilder {
    if (!ValidationUtils.isAddress(account)) {
      throw new ValidationError('Invalid account address');
    }
    this.params.account = account;
    return this;
  }

  atBlockNumber(blockNumber: string | number | bigint): SimulationRequestBuilder {
    let hexBlockNumber: string;

    if (typeof blockNumber === 'string') {
      if (blockNumber.startsWith('0x')) {
        if (!ValidationUtils.isHexString(blockNumber)) {
          throw new ValidationError('Invalid block number - must be a hex string');
        }
        hexBlockNumber = blockNumber;
      } else {
        // Assume decimal string
        hexBlockNumber = `0x${parseInt(blockNumber, 10).toString(16)}`;
      }
    } else if (typeof blockNumber === 'number' || typeof blockNumber === 'bigint') {
      hexBlockNumber = `0x${blockNumber.toString(16)}`;
    } else {
      throw new ValidationError('Block number must be a string, number, or bigint');
    }

    this.params.blockNumber = hexBlockNumber;
    delete this.params.blockTag; // Mutually exclusive
    return this;
  }

  atBlockTag(blockTag: BlockTag): SimulationRequestBuilder {
    this.params.blockTag = blockTag;
    delete this.params.blockNumber; // Mutually exclusive
    return this;
  }

  atBlock(blockNumberOrTag: string | number | bigint): SimulationRequestBuilder {
    // If it's a string that looks like a block tag, use atBlockTag
    if (
      typeof blockNumberOrTag === 'string' &&
      ['latest', 'earliest', 'safe', 'finalized'].includes(blockNumberOrTag as BlockTag)
    ) {
      return this.atBlockTag(blockNumberOrTag as BlockTag);
    }

    // Otherwise, treat it as a block number
    return this.atBlockNumber(blockNumberOrTag);
  }

  withAssetChanges(enabled = true): SimulationRequestBuilder {
    this.params.traceAssetChanges = enabled;
    return this;
  }

  withTransfers(enabled = true): SimulationRequestBuilder {
    this.params.traceTransfers = enabled;
    return this;
  }

  withStateOverride(override: StateOverride): SimulationRequestBuilder {
    if (!ValidationUtils.isAddress(override.address)) {
      throw new ValidationError('Invalid state override address');
    }

    if (!this.options.stateOverrides) {
      this.options.stateOverrides = [];
    }
    this.options.stateOverrides.push(override);
    return this;
  }

  withBlockOverrides(overrides: BlockOverrides): SimulationRequestBuilder {
    this.options.blockOverrides = overrides;
    return this;
  }

  withValidation(enabled = true): SimulationRequestBuilder {
    this.params.validation = enabled;
    return this;
  }

  build(): SimulationRequest {
    // Validate required fields
    if (!this.params.calls || this.params.calls.length === 0) {
      throw new ValidationError('At least one transaction call is required');
    }

    // Validate account requirement for tracing
    if ((this.params.traceAssetChanges || this.params.traceTransfers) && !this.params.account) {
      throw new ValidationError(
        'Account is required when asset change or transfer tracing is enabled'
      );
    }

    // Build the final request
    const request: SimulationRequest = {
      params: this.params as SimulationParams,
    };

    // Add options if any are set
    if (Object.keys(this.options).length > 0) {
      request.options = this.options as SimulationOptions;
    }

    return request;
  }

  async execute(): Promise<ExtendedSimulationResult> {
    if (!this.client) {
      throw new ValidationError('Client is required to execute simulation');
    }

    const request = this.build();
    return this.client.executeSimulation(request);
  }

  /**
   * Normalize a transaction call configuration.
   */
  private normalizeCall(call: TransactionCall | TransactionCallConfig): TransactionCall {
    const normalized: TransactionCall = {};

    // Handle addresses
    if (call.from) {
      if (!ValidationUtils.isAddress(call.from)) {
        throw new ValidationError('Invalid "from" address');
      }
      normalized.from = call.from;
    }

    if (call.to) {
      if (!ValidationUtils.isAddress(call.to)) {
        throw new ValidationError('Invalid "to" address');
      }
      normalized.to = call.to;
    }

    // Handle data
    if (call.data) {
      if (!ValidationUtils.isHexString(call.data)) {
        throw new ValidationError('Invalid data - must be a hex string');
      }
      normalized.data = call.data;
    }

    // Handle value
    if (call.value !== undefined) {
      if (typeof call.value === 'bigint') {
        normalized.value = `0x${call.value.toString(16)}`;
      } else if (typeof call.value === 'string') {
        if (!ValidationUtils.isHexString(call.value)) {
          throw new ValidationError('Invalid value - must be a hex string');
        }
        normalized.value = call.value;
      } else {
        throw new ValidationError('Value must be a hex string or bigint');
      }
    }

    // Handle gas
    if (call.gas !== undefined) {
      if (typeof call.gas === 'bigint') {
        normalized.gas = `0x${call.gas.toString(16)}`;
      } else if (typeof call.gas === 'string') {
        if (!ValidationUtils.isHexString(call.gas)) {
          throw new ValidationError('Invalid gas - must be a hex string');
        }
        normalized.gas = call.gas;
      } else {
        throw new ValidationError('Gas must be a hex string or bigint');
      }
    }

    return normalized;
  }
}

/**
 * Create a new simulation request builder.
 * @param client - Optional client instance for executing simulations
 */
export function createSimulationBuilder(client?: any): SimulationRequestBuilder {
  return new SimulationBuilderImpl(client);
}

/**
 * Helper function to create a transaction call configuration.
 */
export function createTransactionCall(config: TransactionCallConfig): TransactionCall {
  const builder = new SimulationBuilderImpl();
  return builder['normalizeCall'](config);
}

/**
 * Helper functions for common transaction patterns.
 */
export const TransactionHelpers = {
  /**
   * Create an ETH transfer call.
   */
  ethTransfer(to: Address, value: bigint | string, from?: Address): TransactionCall {
    return createTransactionCall({
      to,
      from,
      value: typeof value === 'bigint' ? value : value,
      data: '0x',
    });
  },

  /**
   * Create a contract call.
   */
  contractCall(
    to: Address,
    data: HexString,
    from?: Address,
    value?: bigint | string,
    gas?: bigint | string
  ): TransactionCall {
    return createTransactionCall({
      to,
      from,
      data,
      value,
      gas,
    });
  },

  /**
   * Create a contract deployment call.
   */
  contractDeploy(
    bytecode: HexString,
    from?: Address,
    value?: bigint | string,
    gas?: bigint | string
  ): TransactionCall {
    return createTransactionCall({
      from,
      data: bytecode,
      value,
      gas,
      // to is undefined for contract creation
    });
  },
};
