// [!region imports]
import { createClient } from '@altitrace/sdk'

// [!endregion imports]

// [!region basic-simulation]
const client = createClient.local()

// Simple ETH transfer simulation using convenience method
const transferResult = await client.simulateCall(
  {
    from: '0x742d35Cc6634C0532925a3b8D86C4F5e573F7d5B',
    to: '0xA0b86a33E6441a8F9d6f4c13f8a39c3A7a4e8c',
    value: '0xde0b6b3a7640000',
  },
  {
    blockTag: 'latest',
    validation: true,
  },
)
// [!endregion basic-simulation]

// [!region contract-interaction]
// ERC-20 token transfer simulation
const tokenTransferResult = await client.simulateCall(
  {
    from: '0x742d35Cc6634C0532925a3b8D86C4F5e573F7d5B',
    to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    data: '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b8d86c4f5e573f7d5b0000000000000000000000000000000000000000000000000000000000989680',
  },
  {
    blockTag: 'latest',
    validation: true,
  },
)

if (tokenTransferResult.isSuccess()) {
  // Access detailed call results
  const callResult = tokenTransferResult.calls[0]
  console.log('Return data:', callResult.returnData)
  console.log('Gas used:', callResult.gasUsed)
  console.log('Event logs:', callResult.logs)
}
// [!endregion contract-interaction]

// [!region batch-simulation]
// Simulate multiple related transactions using batch API
const batchSimulations = [
  {
    params: {
      calls: [
        {
          // Step 1: Approve token spending
          from: '0x742d35Cc6634C0532925a3b8D86C4F5e573F7d5B',
          to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          data: '0x095ea7b30000000000000000000000001f9840a85d5af5bf1d1762f925bdaddc4201f984ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        },
      ],
      blockTag: 'latest' as const,
    },
  },
  {
    params: {
      calls: [
        {
          // Step 2: Swap tokens
          from: '0x742d35Cc6634C0532925a3b8D86C4F5e573F7d5B',
          to: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
          data: '0x414bf3890000000000000000000000000000000000000000000000000000000000000000',
          gas: '0x186a0',
        },
      ],
      blockTag: 'latest' as const,
    },
  },
]

const batchResults = await client.simulateBatchAPI(batchSimulations)

// Analyze the complete batch execution
batchResults.forEach((result, index) => {
  if (result.isSuccess()) {
    console.log(`Batch ${index + 1}: ${result.status}, Gas: ${result.gasUsed}`)
  } else {
    console.log(`Batch ${index + 1} failed:`, result.getErrors())
  }
})
// [!endregion batch-simulation]

// [!region builder-pattern]
// Using the builder pattern for complex simulations
const builderResult = await client
  .simulate()
  .call({
    from: '0x742d35Cc6634C0532925a3b8D86C4F5e573F7d5B',
    to: '0xA0b86a33E6441a8F9d6f4c13f8a39c3A7a4e8c',
    value: '0xde0b6b3a7640000',
  })
  .atBlock('latest')
  .execute()

if (builderResult.isSuccess()) {
  console.log('Builder simulation successful:', builderResult.simulationId)
}
// [!endregion builder-pattern]
