/**
 * @fileoverview Advanced usage examples for the Altitrace SDK
 * 
 * This file demonstrates advanced features like state overrides,
 * batch simulations, asset tracking, and integration with Viem.
 */

import { 
  AltitraceClient,
  ResponseProcessor,
  GasUtils,
  WeiUtils,
  viemToTransactionCall,
  createClient,
  COMMON_ADDRESSES,
  GAS_LIMITS,
} from '@altitrace/sdk';

async function stateOverrideExample(): Promise<void> {
  console.log('🔧 State Override Example');
  console.log('=========================\n');

  const client = createClient.local({ debug: true });

  try {
    console.log('📋 Simulating with state overrides...');
    
    const result = await client.simulate()
      .call({
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        data: '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f06e8c0000000000000000000000000000000000000000000000000000000000989680', // transfer 10 USDC
        gas: GAS_LIMITS.ERC20_TRANSFER,
      })
      // Override the sender's USDC balance to ensure they have enough
      .withStateOverride({
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
        balance: '0x1000000000000000000', // 1 ETH for gas
      })
      // Override USDC balance in the contract's storage
      .withStateOverride({
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC contract
        stateDiff: [
          {
            // Storage slot for balance of 0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c
            slot: '0x' + 
                  '742d35cc6634c0532925a3b844bc9e7595f06e8c'.padStart(64, '0').slice(-40) +
                  '0000000000000000000000000000000000000000000000000000000000000009',
            value: '0x' + (1000 * 1e6).toString(16).padStart(64, '0'), // 1000 USDC
          }
        ],
      })
      .atBlockTag('latest')
      .execute();

    console.log('📊 Results with State Override:');
    console.log(`Status: ${result.isSuccess() ? '✅ Success' : '❌ Failed'}`);
    console.log(`Gas Used: ${result.getTotalGasUsed().toLocaleString()}`);

    if (result.isFailed()) {
      console.log('❌ Errors:');
      result.getErrors().forEach(error => {
        console.log(`  - ${error.reason} (${error.errorType})`);
      });
    }

  } catch (error) {
    console.log('❌ State override example failed:', error instanceof Error ? error.message : String(error));
  }
}

async function assetTrackingExample(): Promise<void> {
  console.log('\n💰 Asset Tracking Example');
  console.log('=========================\n');

  const client = createClient.local();
  const userAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c';

  try {
    console.log('📋 Simulating with asset tracking...');
    
    const result = await client.simulate()
      .call({
        from: userAddress,
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        data: '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f06e8c0000000000000000000000000000000000000000000000000000000000989680',
        gas: GAS_LIMITS.ERC20_TRANSFER,
      })
      .forAccount(userAddress)
      .withAssetChanges(true)
      .withTransfers(true)
      .withStateOverride({
        address: userAddress,
        balance: WeiUtils.fromEth('1'), // Ensure enough ETH for gas
      })
      .execute();

    console.log('📊 Asset Tracking Results:');
    console.log(`Status: ${result.isSuccess() ? '✅ Success' : '❌ Failed'}`);

    // Get asset changes summary
    const changes = result.getAssetChangesSummary();
    if (changes && changes.length > 0) {
      console.log('\n💸 Asset Changes:');
      changes.forEach(change => {
        const symbol = change.symbol || 'Unknown';
        const changeAmount = change.isGain ? `+${change.change}` : change.change;
        const formatted = change.decimals 
          ? (BigInt(change.change) / BigInt(10 ** change.decimals)).toString()
          : change.change;
        
        console.log(`  ${symbol}: ${changeAmount} (${formatted} ${symbol})`);
        console.log(`    Before: ${change.balanceBefore}`);
        console.log(`    After: ${change.balanceAfter}`);
      });
    } else {
      console.log('📋 No asset changes detected');
    }

    // Analyze decoded events
    const events = result.getDecodedEvents();
    if (events.length > 0) {
      console.log('\n📝 Decoded Events:');
      events.forEach((event, index) => {
        console.log(`  Event ${index + 1}: ${event.name}`);
        console.log(`    Summary: ${event.summary}`);
        console.log(`    Standard: ${event.standard || 'Unknown'}`);
      });
    }

  } catch (error) {
    console.log('❌ Asset tracking example failed:', error instanceof Error ? error.message : String(error));
  }
}

async function batchSimulationExample(): Promise<void> {
  console.log('\n📦 Batch Simulation Example');
  console.log('===========================\n');

  const client = createClient.local();

  try {
    console.log('📋 Running batch simulation...');

    // Create multiple simulation requests
    const batchConfig = {
      simulations: [
        {
          params: {
            calls: [{
              to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC balance check
              data: '0x70a08231000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f06e8c',
              from: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
            }],
            validation: true,
            traceAssetChanges: false,
            traceTransfers: false,
          },
        },
        {
          params: {
            calls: [{
              to: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT balance check
              data: '0x70a08231000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f06e8c',
              from: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
            }],
            validation: true,
            traceAssetChanges: false,
            traceTransfers: false,
          },
        },
        {
          params: {
            calls: [{
              to: '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI balance check
              data: '0x70a08231000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f06e8c',
              from: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
            }],
            validation: true,
            traceAssetChanges: false,
            traceTransfers: false,
          },
        },
      ],
      concurrency: 3,
      failFast: false,
    };

    const batchResult = await client.simulateBatch(batchConfig);

    console.log('📊 Batch Results Summary:');
    console.log(`Total Simulations: ${batchResult.results.length}`);
    console.log(`Successful: ${batchResult.successCount}`);
    console.log(`Failed: ${batchResult.failureCount}`);
    console.log(`All Succeeded: ${batchResult.allSucceeded ? '✅' : '❌'}`);
    console.log(`Any Succeeded: ${batchResult.anySucceeded ? '✅' : '❌'}`);
    console.log(`Total Execution Time: ${batchResult.totalExecutionTime}ms`);

    console.log('\n📋 Individual Results:');
    const tokenNames = ['USDC', 'USDT', 'DAI'];
    batchResult.results.forEach((result, index) => {
      const tokenName = tokenNames[index] || `Token ${index + 1}`;
      console.log(`  ${tokenName}:`);
      console.log(`    Status: ${result.isSuccess() ? '✅ Success' : '❌ Failed'}`);
      console.log(`    Gas Used: ${result.getTotalGasUsed().toLocaleString()}`);
      
      if (result.isSuccess() && result.calls[0]) {
        const balance = BigInt(result.calls[0].returnData);
        console.log(`    Balance: ${balance.toString()}`);
      }
    });

  } catch (error) {
    console.log('❌ Batch simulation failed:', error instanceof Error ? error.message : String(error));
  }
}

async function gasAnalysisExample(): Promise<void> {
  console.log('\n⛽ Gas Analysis Example');
  console.log('======================\n');

  const client = createClient.local();

  try {
    console.log('📋 Analyzing gas usage patterns...');
    
    const result = await client.simulate()
      .call({
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        data: '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f06e8c0000000000000000000000000000000000000000000000000000000000989680',
        gas: GAS_LIMITS.ERC20_TRANSFER,
      })
      .atBlockTag('latest')
      .execute();

    if (result.isSuccess()) {
      // Extract gas usage breakdown
      const gasBreakdown = ResponseProcessor.extractGasUsage(result);
      
      console.log('📊 Gas Analysis:');
      console.log(`Total Gas Used: ${gasBreakdown.totalGasUsed.toLocaleString()}`);
      console.log(`Block Gas Used: ${gasBreakdown.blockGasUsed.toLocaleString()}`);
      
      console.log('\n🔍 Per-Call Gas Usage:');
      gasBreakdown.callGasUsage.forEach(usage => {
        console.log(`  Call ${usage.callIndex + 1}:`);
        console.log(`    Gas Used: ${usage.gasUsed.toLocaleString()}`);
        console.log(`    Status: ${usage.status}`);
      });

      // Detailed breakdown if available
      if (gasBreakdown.breakdown) {
        console.log('\n🧮 Detailed Gas Breakdown:');
        console.log(`  Intrinsic: ${gasBreakdown.breakdown.intrinsic.toLocaleString()}`);
        console.log(`  Computation: ${gasBreakdown.breakdown.computation.toLocaleString()}`);
        console.log(`  Storage Reads: ${gasBreakdown.breakdown.storage.reads.toLocaleString()}`);
        console.log(`  Storage Writes: ${gasBreakdown.breakdown.storage.writes.toLocaleString()}`);
        console.log(`  Memory: ${gasBreakdown.breakdown.memory.toLocaleString()}`);
        console.log(`  Logs: ${gasBreakdown.breakdown.logs.toLocaleString()}`);
        console.log(`  External Calls: ${gasBreakdown.breakdown.calls.toLocaleString()}`);
      }

      // Gas utilities demonstration
      console.log('\n🔧 Gas Utilities:');
      const gasUsedHex = result.gasUsed;
      const gasUsedNumber = GasUtils.toNumber(gasUsedHex as any);
      const gasLimit = GAS_LIMITS.ERC20_TRANSFER;
      const percentage = GasUtils.calculatePercentage(gasUsedHex as any, gasLimit as any);
      
      console.log(`  Gas Used (hex): ${gasUsedHex}`);
      console.log(`  Gas Used (number): ${gasUsedNumber.toLocaleString()}`);
      console.log(`  Gas Limit: ${gasLimit}`);
      console.log(`  Usage Percentage: ${percentage.toFixed(2)}%`);
    }

  } catch (error) {
    console.log('❌ Gas analysis failed:', error instanceof Error ? error.message : String(error));
  }
}

async function viemIntegrationExample(): Promise<void> {
  console.log('\n🔗 Viem Integration Example');
  console.log('===========================\n');

  // Note: This example assumes you have viem installed
  // In a real project, you would import from 'viem'
  console.log('📋 This example shows Viem integration patterns...');
  console.log('(Install viem package to run this with real Viem types)');

  const client = createClient.local();

  try {
    // Mock Viem transaction (in real usage, this would come from Viem)
    const mockViemTransaction = {
      from: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c' as const,
      to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const,
      value: 0n,
      data: '0x70a08231000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f06e8c' as const,
      gas: 50000n,
    };

    console.log('🔄 Converting Viem transaction to SDK format...');
    
    // Convert Viem transaction to SDK transaction call
    const call = viemToTransactionCall(mockViemTransaction);
    
    console.log('📋 Converted transaction:');
    console.log(`  From: ${call.from}`);
    console.log(`  To: ${call.to}`);
    console.log(`  Data: ${call.data}`);
    console.log(`  Gas: ${call.gas}`);
    console.log(`  Value: ${call.value || '0x0'}`);

    // Use the converted call in simulation
    const result = await client.simulate()
      .call(call)
      .atBlockTag('latest')
      .execute();

    console.log('\n📊 Simulation Results:');
    console.log(`Status: ${result.isSuccess() ? '✅ Success' : '❌ Failed'}`);
    console.log(`Gas Used: ${result.getTotalGasUsed().toLocaleString()}`);

    // Demonstrate utility functions
    console.log('\n🔧 Utility Functions:');
    if (call.value) {
      console.log(`Value formatted: ${WeiUtils.format(call.value as any)}`);
    }
    if (call.gas) {
      const gasNumber = GasUtils.toNumber(call.gas as any);
      console.log(`Gas limit: ${gasNumber.toLocaleString()}`);
    }

  } catch (error) {
    console.log('❌ Viem integration example failed:', error instanceof Error ? error.message : String(error));
  }
}

async function blockOverrideExample(): Promise<void> {
  console.log('\n🕰️  Block Override Example');
  console.log('=========================\n');

  const client = createClient.local();

  try {
    console.log('📋 Simulating with block overrides...');
    
    const result = await client.simulate()
      .call({
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        data: '0x70a08231000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f06e8c',
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
      })
      .withBlockOverrides({
        time: Date.now() / 1000 + 3600, // 1 hour in the future
        number: '0x1000000', // Block number override
        baseFee: '0x3B9ACA00', // 1 gwei base fee
        gasLimit: 30000000, // 30M gas limit
      })
      .execute();

    console.log('📊 Results with Block Override:');
    console.log(`Status: ${result.isSuccess() ? '✅ Success' : '❌ Failed'}`);
    console.log(`Block Number: ${result.blockNumber}`);
    console.log(`Gas Used: ${result.getTotalGasUsed().toLocaleString()}`);

  } catch (error) {
    console.log('❌ Block override example failed:', error instanceof Error ? error.message : String(error));
  }
}

// Run all advanced examples
async function runAdvancedExamples(): Promise<void> {
  console.log('🎬 Altitrace SDK Advanced Usage Examples');
  console.log('========================================\n');

  await stateOverrideExample();
  await assetTrackingExample();
  await batchSimulationExample();
  await gasAnalysisExample();
  await viemIntegrationExample();
  await blockOverrideExample();

  console.log('\n🎉 All advanced examples completed!');
  console.log('\nWhat you learned:');
  console.log('- State and block overrides for testing scenarios');
  console.log('- Asset tracking and balance change monitoring');
  console.log('- Batch simulations for efficiency');
  console.log('- Gas analysis and optimization insights');
  console.log('- Integration with Viem for seamless Web3 development');
  console.log('\nNext steps:');
  console.log('- Explore the full SDK documentation');
  console.log('- Try these patterns with your own smart contracts');
  console.log('- Join our community for support and discussions');
}

// Run examples if this file is executed directly
if (import.meta.main) {
  runAdvancedExamples().catch(error => {
    console.error('💥 Advanced example runner failed:', error);
    process.exit(1);
  });
}

export {
  stateOverrideExample,
  assetTrackingExample,
  batchSimulationExample,
  gasAnalysisExample,
  viemIntegrationExample,
  blockOverrideExample,
};