/**
 * @fileoverview Trace request builder for fluent API
 *
 * This module provides builder functions for creating trace requests
 * with a clean, chainable API. It supports multiple tracer types and
 * comprehensive configuration options.
 */

import type { AltitraceClient } from '@sdk/client/altitrace-client'
import type { TraceRequestBuilder } from '@sdk/types/trace'

/**
 * Create a new trace request builder.
 *
 * @param client - The Altitrace client instance
 * @returns A new trace request builder
 *
 * @example Basic Usage
 * ```typescript
 * const client = new AltitraceClient();
 * const builder = createTraceBuilder(client);
 *
 * // Trace a transaction with call tracer
 * const txTrace = await builder
 *   .transaction('0x123...')
 *   .withCallTracer({ onlyTopCall: false, withLogs: true })
 *   .execute();
 *
 * // Trace a call with multiple tracers
 * const callTrace = await builder
 *   .call({
 *     to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
 *     data: '0x70a08231...',
 *   })
 *   .atBlock('latest')
 *   .withCallTracer()
 *   .withPrestateTracer({ diffMode: true })
 *   .with4ByteTracer()
 *   .execute();
 *
 * // Trace multiple calls with state context
 * const bundles = BundleHelpers.createBundles([
 *   [{ to: '0x123...', data: '0x...' }],
 *   [{ to: '0x456...', data: '0x...' }],
 * ]);
 * const callManyTrace = await builder
 *   .callMany(bundles)
 *   .atBlock('latest')
 *   .withCallTracer()
 *   .execute();
 * ```
 *
 * @example Advanced Usage with Overrides
 * ```typescript
 * // Trace with state and block overrides
 * const advancedTrace = await builder
 *   .call({
 *     from: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
 *     to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
 *     data: '0xa9059cbb...',
 *   })
 *   .atBlock(18500000)
 *   .withCallTracer({ withLogs: true })
 *   .withStateOverrides({
 *     '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c': {
 *       balance: '0x1000000000000000000', // 1 ETH
 *     }
 *   })
 *   .withBlockOverrides({
 *     baseFee: '0x3b9aca00', // 1 gwei
 *     gasLimit: 30000000,
 *   })
 *   .execute();
 * ```
 *
 * @example Struct Logger with Custom Configuration
 * ```typescript
 * // Detailed execution trace with struct logger
 * const detailedTrace = await builder
 *   .call({
 *     to: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
 *     data: '0x18160ddd', // totalSupply()
 *   })
 *   .withStructLogger({
 *     disableMemory: false,    // Include memory
 *     disableStack: false,     // Include stack
 *     disableStorage: false,   // Include storage
 *     disableReturnData: false,
 *     cleanStructLogs: false,  // Keep detailed logs
 *   })
 *   .execute();
 *
 * // Analyze the execution
 * console.log(`Total opcodes: ${detailedTrace.structLogger.totalOpcodes}`);
 * console.log(`Gas used: ${detailedTrace.getTotalGasUsed()}`);
 * ```
 */
export function createTraceBuilder(
  client: AltitraceClient,
): TraceRequestBuilder {
  return client.trace()
}

// Helpers are now available as individual modules to avoid barrel file issues:
// - './helpers/trace-helpers' exports TraceHelpers
// - './helpers/state-override-helpers' exports StateOverrideHelpers
// - './helpers/block-override-helpers' exports BlockOverrideHelpers
// - './helpers/bundle-helpers' exports BundleHelpers
// - './helpers/state-context-helpers' exports StateContextHelpers and TxIndexHelpers
