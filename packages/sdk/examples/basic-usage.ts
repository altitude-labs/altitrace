/**
 * @fileoverview Basic usage examples for the Altitrace SDK
 *
 * This file demonstrates the fundamental operations you can perform
 * with the Altitrace SDK, including simple simulations, error handling,
 * and result processing.
 */

import {
  AltitraceApiError,
  AltitraceClient,
  ValidationError,
} from '@altitrace/sdk'

async function basicSimulationExample(): Promise<void> {
  console.log('🚀 Basic Simulation Example')
  console.log('==========================\n')

  // Create a client instance
  const client = new AltitraceClient({
    baseUrl: 'http://localhost:8080/v1', // Replace with your API URL
    debug: true, // Enable debug logging
  })

  try {
    // Simulate a simple ERC-20 transfer
    console.log('📋 Simulating USDC transfer...')

    const result = await client
      .simulate()
      .call({
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC contract
        data: '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f06e8c0000000000000000000000000000000000000000000000000000000000989680', // transfer(to, 10 USDC)
        gas: '0xD6D8', // ~55,000 gas
      })
      .atBlockTag('latest')
      .withValidation(true)
      .execute()

    // Check simulation results
    console.log('\n📊 Simulation Results:')
    console.log(`Status: ${result.isSuccess() ? '✅ Success' : '❌ Failed'}`)
    console.log(`Simulation ID: ${result.simulationId}`)
    console.log(`Block Number: ${result.blockNumber}`)
    console.log(`Gas Used: ${result.getTotalGasUsed().toLocaleString()}`)

    // Analyze individual calls
    console.log('\n🔍 Call Analysis:')
    result.calls.forEach((call, index) => {
      console.log(`  Call ${index + 1}:`)
      console.log(`    Status: ${call.status}`)
      console.log(
        `    Gas Used: ${Number.parseInt(call.gasUsed, 16).toLocaleString()}`,
      )
      console.log(`    Return Data: ${call.returnData}`)

      if (call.error) {
        console.log(`    Error: ${call.error.reason} (${call.error.errorType})`)
      }
    })

    // Check for events/logs
    if (result.calls.some((call) => call.logs.length > 0)) {
      console.log('\n📝 Events:')
      result.calls.forEach((call, callIndex) => {
        call.logs.forEach((log, logIndex) => {
          console.log(`  Call ${callIndex + 1}, Log ${logIndex + 1}:`)
          console.log(`    Address: ${log.address}`)
          console.log(`    Topics: ${log.topics.length}`)

          if (log.decoded) {
            console.log(`    Event: ${log.decoded.name}`)
            console.log(`    Summary: ${log.decoded.summary}`)
          }
        })
      })
    }
  } catch (error) {
    console.log('\n❌ Error occurred:')

    if (error instanceof ValidationError) {
      console.log(`Validation Error: ${error.message}`)
    } else if (error instanceof AltitraceApiError) {
      console.log(`API Error: ${error.code} - ${error.message}`)
    } else {
      console.log(
        `Unexpected Error: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}

async function healthCheckExample(): Promise<void> {
  console.log('\n🏥 Health Check Example')
  console.log('=======================\n')

  const client = new AltitraceClient()

  try {
    const health = await client.healthCheck()

    console.log('📊 API Health Status:')
    console.log(`Status: ${health.status}`)
    console.log(`Version: ${health.version}`)
    console.log(`Uptime: ${health.uptime.toLocaleString()}ms`)
    console.log(`Cache Status: ${health.cache.status}`)
    console.log(`Cache Latency: ${health.cache.latency_ms}ms`)
  } catch (error) {
    console.log(
      '❌ Health check failed:',
      error instanceof Error ? error.message : String(error),
    )
  }
}

async function simpleCallExample(): Promise<void> {
  console.log('\n🎯 Simple Call Example')
  console.log('======================\n')

  const client = new AltitraceClient()

  try {
    // Use the convenience method for simple simulations
    const result = await client.simulateCall(
      {
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        data: '0x70a08231000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f06e8c', // balanceOf(address)
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
      },
      {
        blockTag: 'latest',
        validation: true,
      },
    )

    console.log('📋 Balance Query Result:')
    console.log(`Success: ${result.isSuccess() ? '✅' : '❌'}`)
    console.log(`Gas Used: ${result.getTotalGasUsed()}`)

    if (result.isSuccess() && result.calls[0]) {
      const returnData = result.calls[0].returnData
      const balance = BigInt(returnData)
      console.log(`Balance (raw): ${balance.toString()}`)
      console.log(`Balance (USDC): ${(Number(balance) / 1e6).toFixed(6)}`)
    }
  } catch (error) {
    console.log(
      '❌ Simple call failed:',
      error instanceof Error ? error.message : String(error),
    )
  }
}

async function errorHandlingExample(): Promise<void> {
  console.log('\n🚫 Error Handling Example')
  console.log('=========================\n')

  const client = new AltitraceClient()

  // Example 1: Validation error
  console.log('1️⃣  Testing validation error...')
  try {
    await client
      .simulate()
      .call({
        to: 'invalid-address', // This will cause a validation error
        data: '0xa9059cbb',
      })
      .execute()
  } catch (error) {
    if (error instanceof ValidationError) {
      console.log(`✅ Caught ValidationError: ${error.message}`)
    }
  }

  // Example 2: Missing required parameters
  console.log('\n2️⃣  Testing missing parameters...')
  try {
    await client
      .simulate()
      .withAssetChanges(true) // This requires an account parameter
      .call({
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        data: '0xa9059cbb',
      })
      .execute()
  } catch (error) {
    if (error instanceof ValidationError) {
      console.log(`✅ Caught ValidationError: ${error.message}`)
    }
  }

  console.log('\n✨ Error handling examples completed')
}

// Run all examples
async function runExamples(): Promise<void> {
  console.log('🎬 Altitrace SDK Basic Usage Examples')
  console.log('=====================================\n')

  await basicSimulationExample()
  await healthCheckExample()
  await simpleCallExample()
  await errorHandlingExample()
}

// Run examples if this file is executed directly
if (import.meta.main) {
  runExamples().catch((_error) => {
    process.exit(1)
  })
}

export {
  basicSimulationExample,
  healthCheckExample,
  simpleCallExample,
  errorHandlingExample,
}
