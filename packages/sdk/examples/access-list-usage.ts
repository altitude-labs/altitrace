/**
 * @fileoverview Access list usage examples for the Altitrace SDK
 */

import { AltitraceClient } from '../src/client/altitrace-client'
import type { TransactionCall } from '../src/types'

// Create a client instance
const client = new AltitraceClient({
  baseUrl: 'http://localhost:8080/v1',
  debug: true,
})

/**
 * Example 1: Simple access list generation using convenience method
 */
async function simpleAccessListExample() {
  const call: TransactionCall = {
    to: '0x680F1BCFF944af147F17cdF606e7c62fb03e5566', // Example contract address
    from: '0x295967DFb079Edd765b1eB1C3C2f3d82d8770b61', // Example sender
    data: '0xa9059cbb00000000000000000000000006a0b945f17c32f8c179542cf97444b73936cb2a0000000000000000000000000000000000000000000000000000000000000457', // ERC-20 transfer
    value: '0x0',
  }

  try {
    const accessListResponse = await client.generateAccessList(call)

    console.log('Access List Generated:')
    console.log('Success:', accessListResponse.isSuccess())
    console.log('Gas Used:', accessListResponse.getTotalGasUsed().toString())
    console.log('Accounts:', accessListResponse.getAccountCount())
    console.log('Storage Slots:', accessListResponse.getStorageSlotCount())

    if (accessListResponse.isSuccess()) {
      const summary = accessListResponse.getAccessListSummary()
      summary.forEach((account, index) => {
        console.log(`Account ${index + 1}:`, account.address)
        console.log(`  Storage Slots (${account.storageSlotCount}):`, account.storageSlots)
      })
    }
  } catch (error) {
    console.error('Access list generation failed:', error)
  }
}

/**
 * Example 2: Using the builder pattern for access list generation
 */
async function builderPatternExample() {
  const call: TransactionCall = {
    to: '0x680F1BCFF944af147F17cdF606e7c62fb03e5566',
    from: '0x295967DFb079Edd765b1eB1C3C2f3d82d8770b61',
    data: '0xa9059cbb00000000000000000000000006a0b945f17c32f8c179542cf97444b73936cb2a0000000000000000000000000000000000000000000000000000000000000457',
    value: '0x0',
    gas: '0x5208', // Custom gas limit
  }

  try {
    const accessListResponse = await client
      .accessList()
      .withTransaction(call)
      .withTimeout(30_000) // 30 second timeout
      .withRetry(true) // Enable retries
      .execute()

    console.log('Builder Pattern Access List:')
    console.log('Success:', accessListResponse.isSuccess())
    console.log('Error:', accessListResponse.error || 'None')

    if (accessListResponse.isSuccess()) {
      // Check if specific account is in access list
      const tokenAddress = '0x742fA3543A0A9fE8A6Aa93Cd9DF0AE2c31c62e49'
      if (accessListResponse.hasAccount(tokenAddress)) {
        const slots = accessListResponse.getAccountStorageSlots(tokenAddress)
        console.log(`Token contract storage slots accessed:`, slots)
      }
    }
  } catch (error) {
    console.error('Builder pattern access list failed:', error)
  }
}

/**
 * Example 3: Contract interaction with access list optimization
 */
async function contractInteractionExample() {
  // First, generate access list for the transaction
  const call: TransactionCall = {
    to: '0x742fA3543A0A9fE8A6Aa93Cd9DF0AE2c31c62e49', // DEX contract
    from: '0x8ba1f109551bD432803012645Hac136c30c48Bf',
    data: '0x38ed1739000000000000000000000000000000000000000000000000016345785d8a00000000000000000000000000000000000000000000000000000000000000000001', // Swap function
    value: '0x0',
  }

  try {
    // Generate access list
    const accessListResponse = await client.generateAccessList(call)

    if (accessListResponse.isSuccess()) {
      console.log('Access list for DEX swap:')
      console.log('Accounts that will be accessed:', accessListResponse.getAccountCount())
      console.log('Total storage slots:', accessListResponse.getStorageSlotCount())
      console.log('Estimated gas savings with access list:', accessListResponse.getTotalGasUsed())

      // Use the access list in actual transaction
      console.log('Access list:', accessListResponse.accessList)

      // You can now use this access list when submitting the actual transaction
      // to reduce gas costs on networks that support EIP-2930
    }
  } catch (error) {
    console.error('Contract interaction access list failed:', error)
  }
}

/**
 * Example 4: Batch access list generation for multiple transactions
 */
async function batchAccessListExample() {
  const calls: TransactionCall[] = [
    {
      to: '0x742fA3543A0A9fE8A6Aa93Cd9DF0AE2c31c62e49',
      data: '0xa9059cbb000000000000000000000000742fA3543A0A9fE8A6Aa93Cd9DF0AE2c31c62e49000000000000000000000000000000000000000000000000016345785d8a0000',
      value: '0x0',
    },
    {
      to: '0x8ba1f109551bD432803012645Hac136c30c48Bf',
      data: '0x095ea7b3000000000000000000000000742fA3543A0A9fE8A6Aa93Cd9DF0AE2c31c62e49ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      value: '0x0',
    },
  ]

  try {
    const accessListPromises = calls.map(call => client.generateAccessList(call))
    const accessListResponses = await Promise.all(accessListPromises)

    console.log('Batch Access List Results:')
    accessListResponses.forEach((response, index) => {
      console.log(`Transaction ${index + 1}:`)
      console.log('  Success:', response.isSuccess())
      console.log('  Accounts:', response.getAccountCount())
      console.log('  Storage Slots:', response.getStorageSlotCount())
      console.log('  Gas Used:', response.getTotalGasUsed().toString())
    })
  } catch (error) {
    console.error('Batch access list generation failed:', error)
  }
}

// Export examples for testing
export {
  simpleAccessListExample,
  builderPatternExample,
  contractInteractionExample,
  batchAccessListExample,
}

// Run examples if this file is executed directly
if (require.main === module) {
  console.log('Running access list examples...')
  
  Promise.all([
    simpleAccessListExample(),
    builderPatternExample(),
    contractInteractionExample(),
    batchAccessListExample(),
  ]).then(() => {
    console.log('All examples completed!')
  }).catch((error) => {
    console.error('Examples failed:', error)
  })
}