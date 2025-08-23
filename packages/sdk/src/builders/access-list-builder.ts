/**
 * @fileoverview Access list builder for fluent API construction
 */

import type {
  AccessListExecutionOptions,
  AccessListRequest,
  AccessListRequestBuilder,
  ExtendedAccessListResponse,
  TransactionCall,
} from '@sdk/types'
import type { AccessListClient } from '../client/access-list-client'

/**
 * Builder for constructing access list requests with a fluent API.
 */
export class AccessListBuilder implements AccessListRequestBuilder {
  private params?: TransactionCall
  private blockParam?: string
  private executionOptions?: AccessListExecutionOptions

  constructor(private client: AccessListClient) {}

  /**
   * Set the transaction call parameters for the access list.
   */
  withTransaction(call: TransactionCall): AccessListRequestBuilder {
    this.params = call
    return this
  }

  /**
   * Set the block to generate the access list against.
   */
  atBlock(
    blockNumberOrTag: string | number | bigint,
  ): AccessListRequestBuilder {
    if (typeof blockNumberOrTag === 'string') {
      this.blockParam = blockNumberOrTag
    } else {
      this.blockParam = `0x${blockNumberOrTag.toString(16)}`
    }
    return this
  }

  /**
   * Set execution options for the access list request.
   */
  withExecutionOptions(
    options: AccessListExecutionOptions,
  ): AccessListRequestBuilder {
    this.executionOptions = options
    return this
  }

  /**
   * Set custom timeout for the request.
   */
  withTimeout(timeout: number): AccessListRequestBuilder {
    this.executionOptions = {
      ...this.executionOptions,
      timeout,
    }
    return this
  }

  /**
   * Set custom headers for the request.
   */
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

  /**
   * Enable or disable request retries.
   */
  withRetry(enabled: boolean): AccessListRequestBuilder {
    this.executionOptions = {
      ...this.executionOptions,
      retry: enabled,
    }
    return this
  }

  /**
   * Execute the access list request and return the response.
   */
  async execute(): Promise<ExtendedAccessListResponse> {
    if (!this.params) {
      throw new Error('Transaction call is required')
    }

    const request: AccessListRequest = {
      params: this.params,
      ...(this.blockParam && { block: this.blockParam }),
    }

    return this.client.executeAccessListRequest(request, this.executionOptions)
  }

  /**
   * Build the access list request without executing it.
   */
  build(): AccessListRequest {
    if (!this.params) {
      throw new Error('Transaction call is required')
    }

    return {
      params: this.params,
      ...(this.blockParam && { block: this.blockParam }),
    }
  }
}
