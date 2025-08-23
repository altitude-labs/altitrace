// [!region imports]
import { createClient } from '@altitrace/sdk'
// [!endregion imports]

// [!region basic-access-list]
const client = createClient.local()

// Generate access list for a transaction using convenience method
const accessListResult = await client.generateAccessList(
  {
    from: '0x742d35Cc6634C0532925a3b8D86C4F5e573F7d5B',
    to: '0x5555555555555555555555555555555555555555',
    data: '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b8d86c4f5e573f7d5b0000000000000000000000000000000000000000000000000000000000989680',
  },
  {
    block: 'latest',
  },
)

if (accessListResult.isSuccess()) {
  console.log('Access list:', accessListResult.accessList)
  console.log('Gas used:', accessListResult.gasUsed)

  // Use the optimized access list in a simulation
  const optimizedResult = await client.simulateCallWithAccessList(
    {
      from: '0x742d35Cc6634C0532925a3b8D86C4F5e573F7d5B',
      to: '0x5555555555555555555555555555555555555555',
      data: '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b8d86c4f5e573f7d5b0000000000000000000000000000000000000000000000000000000000989680',
    },
    accessListResult.accessList,
  )

  console.log('Optimized simulation result:', optimizedResult.isSuccess())
}
// [!endregion basic-access-list]

// [!region builder-access-list]
// Using the builder pattern for access list generation
const accessListBuilder = await client
  .accessList()
  .withTransaction({
    from: '0x742d35Cc6634C0532925a3b8D86C4F5e573F7d5B',
    to: '0x5555555555555555555555555555555555555555',
    data: '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b8d86c4f5e573f7d5b0000000000000000000000000000000000000000000000000000000000989680',
  })
  .atBlock('latest')
  .withTimeout(30000)
  .execute()

if (accessListBuilder.isSuccess()) {
  console.log('Builder access list:', accessListBuilder.accessList)
}
// [!endregion builder-access-list]

// [!region access-list-analysis]
// Analyze access list for gas optimization
const analysisResult = await client.generateAccessList({
  from: '0x742d35Cc6634C0532925a3b8D86C4F5e573F7d5B',
  to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC contract
  data: '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b8d86c4f5e573f7d5b0000000000000000000000000000000000000000000000000000000000989680',
})

if (analysisResult.isSuccess()) {
  const accessList = analysisResult.accessList

  // Analyze access patterns
  const addressCount = accessList.length
  const totalStorageSlots = accessList.reduce(
    (sum: number, item: any) => sum + item.storageKeys.length,
    0,
  )

  console.log(`Accessed ${addressCount} addresses`)
  console.log(`Total storage slots: ${totalStorageSlots}`)

  // Compare with and without access list
  const withoutAccessList = await client.simulateCall({
    from: '0x742d35Cc6634C0532925a3b8D86C4F5e573F7d5B',
    to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    data: '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b8d86c4f5e573f7d5b0000000000000000000000000000000000000000000000000000000000989680',
  })

  const withAccessList = await client.simulateCall({
    from: '0x742d35Cc6634C0532925a3b8D86C4F5e573F7d5B',
    to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    data: '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b8d86c4f5e573f7d5b0000000000000000000000000000000000000000000000000000000000989680',
    accessList: analysisResult.accessList,
  })

  if (withoutAccessList.isSuccess() && withAccessList.isSuccess()) {
    const gasSavings =
      Number.parseInt(withoutAccessList.gasUsed, 16) -
      Number.parseInt(withAccessList.gasUsed, 16)
    console.log(`Gas savings: ${gasSavings} units`)
  }
}
// [!endregion access-list-analysis]
