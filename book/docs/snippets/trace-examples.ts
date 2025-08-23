// [!region imports]
import { createClient } from '@altitrace/sdk'
// [!endregion imports]

// [!region basic-trace]
const client = createClient.local()

// Basic call trace using convenience method
const traceResult = await client.traceCall(
  {
    from: '0x742d35Cc6634C0532925a3b8D86C4F5e573F7d5B',
    to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    data: '0x70a08231000000000000000000000000742d35cc6634c0532925a3b8d86c4f5e573f7d5b', // balanceOf
  },
  {
    block: 'latest',
    callTracer: true,
    prestateTracer: true,
  },
)

if (traceResult.isSuccess()) {
  console.log('Trace successful')

  // Access call tracer results
  if (traceResult.callTracer) {
    console.log('Root call:', traceResult.callTracer.rootCall.callType)
    console.log('Total calls:', traceResult.callTracer.totalCalls)
    console.log('Max depth:', traceResult.callTracer.maxDepth)
  }

  // Access prestate tracer results
  if (traceResult.prestateTracer) {
    console.log('Prestate data available')
  }
} else {
  console.error('Trace failed:', traceResult.getErrors())
}
// [!endregion basic-trace]

// [!region builder-trace]
// Using the builder pattern for complex tracing
const builderTrace = await client
  .trace()
  .call({
    from: '0x742d35Cc6634C0532925a3b8D86C4F5e573F7d5B',
    to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    data: '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b8d86c4f5e573f7d5b0000000000000000000000000000000000000000000000000000000000989680',
  })
  .atBlock('latest')
  .withCallTracer({
    onlyTopCall: false,
    withLogs: true,
  })
  .withPrestateTracer({
    diffMode: true,
    disableCode: false,
    disableStorage: false,
  })
  .execute()

if (builderTrace.isSuccess()) {
  console.log('Builder trace successful')
}
// [!endregion builder-trace]

// [!region advanced-trace]
// Advanced tracing with all tracers enabled
const advancedTrace = await client.traceCall(
  {
    from: '0x742d35Cc6634C0532925a3b8D86C4F5e573F7d5B',
    to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    data: '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b8d86c4f5e573f7d5b0000000000000000000000000000000000000000000000000000000000989680',
  },
  {
    block: 'latest',
    callTracer: true,
    prestateTracer: true,
    structLogger: true,
    fourByteTracer: true,
  },
)

if (advancedTrace.isSuccess()) {
  // Call tracer analysis
  if (advancedTrace.callTracer) {
    console.log('Call structure:', advancedTrace.callTracer.rootCall.callType)
    console.log('Sub-calls:', advancedTrace.callTracer.totalCalls)
  }

  // 4-byte tracer analysis
  if (advancedTrace['4byteTracer']) {
    console.log(
      'Function signatures:',
      Object.keys(advancedTrace['4byteTracer'].identifiers || {}),
    )
    console.log(
      'Total identifiers:',
      advancedTrace['4byteTracer'].totalIdentifiers,
    )
  }

  // Struct logger analysis
  if (advancedTrace.structLogger) {
    console.log(
      'Execution steps:',
      advancedTrace.structLogger.structLogs?.length,
    )
    console.log('Total gas:', advancedTrace.structLogger.totalGas)
  }
}
// [!endregion advanced-trace]

// [!region transaction-trace]
// Trace an existing transaction by hash
const txTrace = await client.traceTransaction(
  '0xbc4a51bbcbe7550446c151d0d53ee14d5318188e2af1726e28a481b075fc7b4c',
  {
    callTracer: true,
    fourByteTracer: true,
    structLogger: true,
  },
)

if (txTrace.isSuccess()) {
  console.log('Transaction trace successful')

  // Access transaction receipt information
  if (txTrace.receipt) {
    console.log('Gas used:', txTrace.receipt.gasUsed)
    console.log('Status:', txTrace.receipt.status)
    console.log('Log count:', txTrace.receipt.logsCount)
  }
}
// [!endregion transaction-trace]

// [!region trace-many]
// Trace multiple calls with state context
const manyTraces = await client.traceCallMany(
  [
    {
      transactions: [
        {
          from: '0x742d35Cc6634C0532925a3b8D86C4F5e573F7d5B',
          to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          data: '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b8d86c4f5e573f7d5b0000000000000000000000000000000000000000000000000000000000989680', // First transaction
        },
        {
          from: '0x742d35Cc6634C0532925a3b8D86C4F5e573F7d5B',
          to: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
          data: '0x414bf389' + '00'.repeat(100), // Second transaction (depends on first)
        },
      ],
    },
  ],
  {
    stateContext: {
      block: 'latest',
    },
    fourByteTracer: true,
    callTracer: true,
  },
)
// [!endregion trace-many]
