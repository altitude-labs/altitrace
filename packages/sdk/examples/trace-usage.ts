/**
 * @fileoverview Examples of using the Altitrace SDK trace functionality
 */

import { BundleHelpers } from '../src/builders/helpers/bundle-helpers'
import { StateContextHelpers } from '../src/builders/helpers/state-context-helpers'
import { createTraceBuilder } from '../src/builders/trace-builder'
import { AltitraceClient } from '../src/index'

async function main() {
  // Initialize client
  const client = new AltitraceClient({
    baseUrl: 'http://localhost:8080/v1',
    debug: true,
  })

  // Example 1: Trace a transaction with call tracer
  console.log('\n=== Example 1: Trace Transaction with Call Tracer ===')
  try {
    const txTrace = await client.traceTransaction(
      '0xbc4a51bbcbe7550446c151d0d53ee14d5318188e2af1726e28a481b075fc7b4c',
      { callTracer: true },
    )

    console.log('Transaction trace success:', txTrace.isSuccess())
    console.log('Total gas used:', txTrace.getTotalGasUsed().toString())
    console.log('Call count:', txTrace.getCallCount())
    console.log('Max depth:', txTrace.getMaxDepth())
  } catch (_error) {}

  // Example 2: Trace a call with prestate tracer
  console.log('\n=== Example 2: Trace Call with Prestate Tracer ===')
  try {
    const callTrace = await client.traceCall(
      {
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        data: '0x70a08231000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f06e8c', // balanceOf
      },
      {
        block: 'latest',
        prestateTracer: true,
      },
    )

    console.log('Call trace success:', callTrace.isSuccess())
    console.log('Accessed accounts:', callTrace.getAccessedAccounts())
  } catch (_error) {}

  // Example 3: Using the builder pattern for complex traces
  console.log('\n=== Example 3: Builder Pattern with Multiple Tracers ===')
  try {
    const builder = createTraceBuilder(client)

    const complexTrace = await builder
      .transaction(
        '0xbc4a51bbcbe7550446c151d0d53ee14d5318188e2af1726e28a481b075fc7b4c',
      )
      .withCallTracer({ onlyTopCall: false, withLogs: true })
      .withPrestateTracer({
        diffMode: true,
        disableCode: false,
        disableStorage: false,
      })
      .with4ByteTracer()
      .execute()

    console.log('Trace results:')
    console.log('- Has call tracer:', !!complexTrace.callTracer)
    console.log('- Has prestate tracer:', !!complexTrace.prestateTracer)
    console.log('- Has 4byte tracer:', !!complexTrace['4byteTracer'])
    console.log('- Function signatures:', complexTrace.getFunctionSignatures())
  } catch (_error) {}

  // Example 4: Trace call with state overrides
  console.log('\n=== Example 4: Trace Call with State Overrides ===')
  try {
    const traceWithOverrides = await client
      .trace()
      .call({
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        data: '0xa9059cbb000000000000000000000000000000000000000000000000000000000000dead00000000000000000000000000000000000000000000000000000000000f4240', // transfer 1 USDC
      })
      .atBlock('latest')
      .withCallTracer()
      .withStateOverrides({
        '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c': {
          balance: '0x1000000000000000000', // 1 ETH
        },
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': {
          stateDiff: {
            // Override USDC balance slot for the sender
            '0x0000000000000000000000000000000000000000000000000000000000000001':
              '0x0000000000000000000000000000000000000000000000000000000001000000',
          },
        },
      })
      .execute()

    console.log('Trace with overrides success:', traceWithOverrides.isSuccess())
    if (!traceWithOverrides.isSuccess()) {
      console.log('Errors:', traceWithOverrides.getErrors())
    }
  } catch (_error) {}

  // Example 5: Trace with struct logger (verbose)
  console.log('\n=== Example 5: Trace with Struct Logger ===')
  try {
    const structLogTrace = await client
      .trace()
      .call({
        to: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        data: '0x18160ddd', // totalSupply()
      })
      .withStructLogger({
        disableMemory: true,
        disableStack: false,
        disableStorage: true,
        disableReturnData: false,
        cleanStructLogs: false, // Keep struct logs
      })
      .execute()

    if (structLogTrace.structLogger?.structLogs) {
      console.log('Total opcodes:', structLogTrace.structLogger.totalOpcodes)
      console.log(
        'First 5 opcodes:',
        structLogTrace.structLogger.structLogs.slice(0, 5).map((log) => log.op),
      )
    }
  } catch (_error) {}

  // Example 6: Analyze trace results
  console.log('\n=== Example 6: Analyze Trace Results ===')
  async function analyzeTransaction(txHash: string): Promise<void> {
    try {
      const trace = await client
        .trace()
        .transaction(txHash)
        .withCallTracer({ onlyTopCall: false, withLogs: true })
        .with4ByteTracer()
        .execute()

      // Extract useful information
      const analysis = {
        success: trace.isSuccess(),
        gasUsed: trace.getTotalGasUsed().toString(),
        callCount: trace.getCallCount(),
        maxDepth: trace.getMaxDepth(),
        errors: trace.getErrors(),
        logs: trace.getAllLogs().length,
        uniqueAddresses: new Set(trace.getAccessedAccounts()).size,
        functionSignatures: trace.getFunctionSignatures(),
      }

      console.log('Transaction Analysis:', JSON.stringify(analysis, null, 2))

      // Analyze call tree if available
      if (trace.callTracer?.rootCall) {
        console.log('\nCall Tree Analysis:')
        analyzeCallFrame(trace.callTracer.rootCall, 0)
      }
    } catch (_error) {}
  }

  function analyzeCallFrame(frame: any, depth: number): void {
    const indent = '  '.repeat(depth)
    console.log(`${indent}${frame.callType} ${frame.to || 'CREATE'}`)
    console.log(
      `${indent}  Gas: ${BigInt(frame.gas).toString()} → ${BigInt(frame.gasUsed).toString()}`,
    )

    if (frame.error) {
      console.log(`${indent}  ❌ Error: ${frame.error}`)
    }

    if (frame.calls && frame.calls.length > 0) {
      for (const subcall of frame.calls) {
        analyzeCallFrame(subcall, depth + 1)
      }
    }
  }

  // Run analysis on a sample transaction
  await analyzeTransaction(
    '0xbc4a51bbcbe7550446c151d0d53ee14d5318188e2af1726e28a481b075fc7b4c',
  )

  // Example 7: Trace multiple calls with callMany
  console.log('\n=== Example 7: Trace Multiple Calls with CallMany ===')
  try {
    // Create multiple bundles with different transactions
    const bundles = BundleHelpers.createBundles([
      [
        {
          to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
          data: '0x18160ddd', // totalSupply()
        },
      ],
      [
        {
          to: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
          data: '0x18160ddd', // totalSupply()
        },
      ],
    ])

    const callManyResults = await client
      .trace()
      .callMany(bundles)
      .atLatest()
      .withCallTracer({ onlyTopCall: true, withLogs: false })
      .execute()

    console.log(`Traced ${callManyResults.length} bundles`)
    callManyResults.forEach((result, index) => {
      console.log(`Bundle ${index + 1}:`)
      console.log(`  Success: ${result.isSuccess()}`)
      console.log(`  Gas used: ${result.getTotalGasUsed().toString()}`)
    })
  } catch (_error) {}

  // Example 8: Advanced callMany with state context and multiple tracers
  console.log('\n=== Example 8: Advanced CallMany with State Context ===')
  try {
    // Create a bundle with multiple transactions in sequence
    const sequentialBundle = BundleHelpers.createBundle([
      {
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        data: '0x70a08231000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f06e8c', // balanceOf
      },
      {
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
        to: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        data: '0x70a08231000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f06e8c', // balanceOf
      },
    ])

    const advancedCallMany = await client
      .trace()
      .callMany([sequentialBundle])
      .withStateContext(StateContextHelpers.atBlock('latest'))
      .withCallTracer({ onlyTopCall: false, withLogs: true })
      .withPrestateTracer({ diffMode: true })
      .with4ByteTracer()
      .execute()

    console.log('Advanced CallMany Results:')
    advancedCallMany.forEach((result, index) => {
      console.log(`Result ${index + 1}:`)
      console.log(`  Has call tracer: ${!!result.callTracer}`)
      console.log(`  Has prestate tracer: ${!!result.prestateTracer}`)
      console.log(`  Has 4byte tracer: ${!!result['4byteTracer']}`)
      console.log(`  Accessed accounts: ${result.getAccessedAccounts().length}`)
      console.log(
        `  Function signatures: ${result.getFunctionSignatures().join(', ')}`,
      )
    })
  } catch (_error) {}

  // Example 9: CallMany with different state contexts
  console.log('\n=== Example 9: CallMany with Different State Contexts ===')
  try {
    const blockNumber = 18500000

    // Create bundles for different scenarios
    const scenarios = [
      BundleHelpers.singleTransaction({
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        data: '0x18160ddd',
      }),
      BundleHelpers.singleTransaction({
        to: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        data: '0x18160ddd',
      }),
    ]

    // Using builder pattern with specific block and transaction index
    const contextualTrace = await client
      .trace()
      .callMany(scenarios)
      .atBlock(blockNumber)
      .withTransactionIndex(5) // After 5th transaction in the block
      .withCallTracer()
      .execute()

    console.log(`Traced at block ${blockNumber}, after transaction 5`)
    contextualTrace.forEach((result, index) => {
      console.log(
        `Scenario ${index + 1}: ${result.isSuccess() ? 'Success' : 'Failed'}`,
      )
    })
  } catch (_error) {}

  // Example 10: Using convenience method for quick callMany
  console.log('\n=== Example 10: Quick CallMany with Convenience Method ===')
  try {
    const quickBundles = [
      {
        transactions: [
          {
            to: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
            data: '0x18160ddd',
          },
        ],
      },
      {
        transactions: [
          {
            to: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
            data: '0x18160ddd',
          },
        ],
      },
    ]

    const quickResults = await client.traceCallMany(quickBundles, {
      stateContext: StateContextHelpers.latest(),
      callTracer: true,
      fourByteTracer: true,
    })

    console.log('Quick CallMany Results:')
    quickResults.forEach((result, index) => {
      console.log(
        `Token ${index + 1}: Gas ${result.getTotalGasUsed().toString()}, ` +
          `Signatures: ${result.getFunctionSignatures().length}`,
      )
    })
  } catch (_error) {}
}

// Run examples
main().catch((_error) => {
  process.exit(1)
})
