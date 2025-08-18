# @altitrace/sdk

[![npm version](https://img.shields.io/npm/v/@altitrace/sdk.svg)](https://www.npmjs.com/package/@altitrace/sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The official TypeScript SDK for the Altitrace HyperEVM transaction simulation platform. This SDK provides a comprehensive, type-safe interface for simulating Ethereum transactions, with support for complex scenarios like state overrides, batch operations, and detailed gas analysis.

## Features

- 🔒 **Full Type Safety** - Strict TypeScript support with no `any` types
- 🔄 **Fluent API** - Builder pattern for intuitive request construction  
- 🛡️ **Robust Error Handling** - Comprehensive error types and retry logic
- 📊 **Rich Response Processing** - Detailed simulation results with utility methods
- ⚡ **Viem Integration** - Seamless interoperability with Viem types
- 🧪 **Comprehensive Testing** - Full test coverage for all functionality
- 📚 **Extensive Documentation** - Complete JSDoc documentation for all APIs

## Installation

```bash
# Using bun (recommended)
bun add @altitrace/sdk

# Using npm
npm install @altitrace/sdk

# Using yarn
yarn add @altitrace/sdk
```

### Peer Dependencies

This SDK is designed to work alongside [Viem](https://viem.sh) for optimal Web3 development experience:

```bash
bun add viem
```

## Quick Start

```typescript
import { AltitraceClient } from '@altitrace/sdk';

// Create a client
const client = new AltitraceClient({
  baseUrl: 'https://api.altitrace.com/v1', // Replace with your API URL
});

// Simulate a simple transaction
const result = await client.simulate()
  .call({
    to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC contract
    data: '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f06e8c0000000000000000000000000000000000000000000000000000000000989680',
    from: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
  })
  .atBlockTag('latest')
  .execute();

// Check results
console.log(`Simulation ${result.isSuccess() ? 'succeeded' : 'failed'}`);
console.log(`Gas used: ${result.getTotalGasUsed().toLocaleString()}`);

if (result.isFailed()) {
  console.log('Errors:', result.getErrors());
}
```

## Advanced Usage

### State Overrides

Modify account state before simulation:

```typescript
const result = await client.simulate()
  .call({
    to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    data: '0xa9059cbb...',
    from: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
  })
  .withStateOverride({
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
    balance: '0x1000000000000000000', // Give account 1 ETH
  })
  .execute();
```

### Asset Change Tracking

Track token balance changes during simulation:

```typescript
const result = await client.simulate()
  .call({
    to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    data: '0xa9059cbb...',
    from: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
  })
  .forAccount('0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c')
  .withAssetChanges(true)
  .withTransfers(true)
  .execute();

// Get asset change summary
const changes = result.getAssetChangesSummary();
if (changes) {
  changes.forEach(change => {
    console.log(`${change.symbol}: ${change.isGain ? '+' : ''}${change.change}`);
  });
}
```

### Batch Simulation

Simulate multiple independent transactions:

```typescript
const batchResult = await client.simulateBatch({
  simulations: [
    {
      params: {
        calls: [{ to: '0x...', data: '0x...' }],
        validation: true,
        traceAssetChanges: false,
        traceTransfers: false,
      }
    },
    {
      params: {
        calls: [{ to: '0x...', data: '0x...' }],
        validation: true,
        traceAssetChanges: false,
        traceTransfers: false,
      }
    },
  ],
  concurrency: 3,
});

console.log(`${batchResult.successCount}/${batchResult.results.length} simulations succeeded`);
```

### Viem Integration

Seamlessly convert between Viem and SDK types:

```typescript
import { viemToTransactionCall, createClient } from '@altitrace/sdk';
import { parseEther, encodeFunctionData } from 'viem';

// Convert Viem transaction request
const viemTx = {
  to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  value: parseEther('1'),
  data: encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: ['0x...', parseUnits('100', 6)],
  }),
};

const result = await client.simulate()
  .call(viemToTransactionCall(viemTx))
  .execute();
```

### Error Handling

The SDK provides comprehensive error handling with specific error types:

```typescript
import { 
  AltitraceApiError, 
  ValidationError, 
  AltitraceNetworkError 
} from '@altitrace/sdk';

try {
  const result = await client.simulate()
    .call({ to: 'invalid-address' })
    .execute();
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Invalid input:', error.message);
    console.log('Field:', error.field);
  } else if (error instanceof AltitraceApiError) {
    console.log('API error:', error.code, error.message);
    console.log('Suggestion:', error.suggestion);
  } else if (error instanceof AltitraceNetworkError) {
    console.log('Network error:', error.code);
  }
}
```

## Configuration Options

### Client Configuration

```typescript
const client = new AltitraceClient({
  baseUrl: 'https://api.altitrace.com/v1',
  timeout: 60_000,           // 60 seconds
  retries: 5,                // 5 retry attempts
  debug: true,               // Enable debug logging
  headers: {                 // Custom headers
    'Authorization': 'Bearer token',
    'X-Custom-Header': 'value',
  },
});
```

### Pre-configured Clients

```typescript
import { createClient } from '@altitrace/sdk';

// Local development
const localClient = createClient.local({ debug: true });

// Production
const prodClient = createClient.production({
  headers: { 'Authorization': 'Bearer token' }
});

// Testing
const testClient = createClient.testing({ timeout: 5000 });
```

## Response Processing

### Extended Simulation Results

All simulation results include utility methods for easier data access:

```typescript
const result = await client.simulate().call({...}).execute();

// Status checks
console.log('Success:', result.isSuccess());
console.log('Failed:', result.isFailed());

// Gas analysis
console.log('Total gas:', result.getTotalGasUsed());

// Event analysis
const events = result.getDecodedEvents();
console.log('Decoded events:', events.length);

// Error analysis
if (result.isFailed()) {
  const errors = result.getErrors();
  errors.forEach(error => {
    console.log(`Error: ${error.reason} (${error.errorType})`);
  });
}

// Log filtering
const usdcLogs = result.getLogsByAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
```

### Gas Analysis

```typescript
import { ResponseProcessor } from '@altitrace/sdk';

const gasBreakdown = ResponseProcessor.extractGasUsage(result);

console.log('Total gas used:', gasBreakdown.totalGasUsed);
console.log('Call gas usage:', gasBreakdown.callGasUsage);

if (gasBreakdown.breakdown) {
  console.log('Intrinsic:', gasBreakdown.breakdown.intrinsic);
  console.log('Computation:', gasBreakdown.breakdown.computation);
  console.log('Storage reads:', gasBreakdown.breakdown.storage.reads);
}
```

### Event Analysis

```typescript
import { ResponseProcessor } from '@altitrace/sdk';

const events = ResponseProcessor.extractEvents(result);

events.forEach(event => {
  console.log(`Event: ${event.decoded?.name || 'Unknown'}`);
  console.log(`Contract: ${event.contractAddress}`);
  console.log(`Summary: ${event.decoded?.summary}`);
});
```

## Utilities

### Gas Utilities

```typescript
import { GasUtils } from '@altitrace/sdk';

// Convert between formats
const gasHex = GasUtils.toHexNumber(21000);        // '0x5208'
const gasNumber = GasUtils.toNumber('0x5208');     // 21000
const gasBigint = GasUtils.toBigint('0x5208');     // 21000n

// Gas calculations
const total = GasUtils.add('0x5208', '0x5208');    // '0xa410'
const difference = GasUtils.subtract('0xa410', '0x5208'); // '0x5208'
const percentage = GasUtils.calculatePercentage('0x5208', '0xa410'); // 50
```

### Wei Utilities

```typescript
import { WeiUtils } from '@altitrace/sdk';

// Convert ETH to Wei
const wei = WeiUtils.fromEth('1');                 // '0xde0b6b3a7640000'
const eth = WeiUtils.toEth('0xde0b6b3a7640000');   // '1'

// Format with units
const formatted = WeiUtils.format('0xde0b6b3a7640000'); // '1 ETH'
const gweiFormatted = WeiUtils.format('0x3b9aca00');     // '1 gwei'
```

### Validation Utilities

```typescript
import { ValidationUtils, TypeGuards } from '@altitrace/sdk';

// Type guards
if (TypeGuards.isAddress(address)) {
  // TypeScript knows address is valid
  console.log('Valid address:', address);
}

// Validation with exceptions
try {
  ValidationUtils.validateAddress(userInput, 'userAddress');
  ValidationUtils.validateHexNumber(gasLimit, 'gasLimit');
} catch (error) {
  console.log('Validation error:', error.message);
}
```

## Constants

The SDK provides useful constants for common values:

```typescript
import { 
  BLOCK_TAGS, 
  GAS_LIMITS, 
  COMMON_ADDRESSES, 
  DEFAULT_CONFIG 
} from '@altitrace/sdk';

// Block tags
await client.simulate().call({...}).atBlockTag(BLOCK_TAGS.LATEST);

// Common gas limits
const gasLimit = GAS_LIMITS.ERC20_TRANSFER; // '0xD6D8'

// Common addresses
const wethAddress = COMMON_ADDRESSES.WETH; // '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
```

## Health Monitoring

Check API health status:

```typescript
try {
  const health = await client.healthCheck();
  console.log(`API Status: ${health.status}`);
  console.log(`Version: ${health.version}`);
  console.log(`Uptime: ${health.uptime}ms`);
  console.log(`Cache Status: ${health.cache.status}`);
} catch (error) {
  console.log('Health check failed:', error.message);
}
```

## Best Practices

### 1. Always Handle Errors

```typescript
try {
  const result = await client.simulate().call({...}).execute();
  // Handle success
} catch (error) {
  // Handle specific error types
  if (error instanceof ValidationError) {
    // Fix input validation
  } else if (error instanceof AltitraceApiError) {
    // Handle API-specific errors
  }
}
```

### 2. Use Type Guards

```typescript
import { TypeGuards } from '@altitrace/sdk';

if (TypeGuards.isAddress(userInput)) {
  // Safe to use as address
  await client.simulate().call({ to: userInput });
}
```

### 3. Leverage Builder Pattern

```typescript
// Build reusable configurations
const baseBuilder = client.simulate()
  .atBlockTag('latest')
  .withValidation(true);

// Clone and customize
const transferSim = baseBuilder.clone()
  .call({ to: tokenAddress, data: transferData });

const approveSim = baseBuilder.clone()
  .call({ to: tokenAddress, data: approveData });
```

### 4. Monitor Gas Usage

```typescript
const result = await client.simulate().call({...}).execute();

if (result.getTotalGasUsed() > 1_000_000) {
  console.warn('High gas usage detected');
}

const gasBreakdown = ResponseProcessor.extractGasUsage(result);
if (gasBreakdown.breakdown?.storage.writes > 5) {
  console.warn('Many storage writes - consider optimization');
}
```

## TypeScript Support

The SDK is built with TypeScript-first design:

- **Strict Type Checking** - No `any` types used
- **Full IntelliSense** - Complete autocomplete and documentation
- **Type Guards** - Runtime type checking utilities
- **Branded Types** - Prevent mixing of address/hex string types
- **Exact Types** - Precise typing for all API structures

## Testing

Run the test suite:

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Run specific test file
bun test validation.test.ts
```

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/altitrace/altitrace.git
cd altitrace/packages/sdk

# Install dependencies
bun install

# Generate types from OpenAPI spec
bun run generate:types

# Build the package
bun run build

# Run tests
bun test
```

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes with tests
4. Run `bun run lint` and `bun run typecheck`
5. Submit a pull request

## Support

- 📖 **Documentation**: [docs.altitrace.com](https://docs.altitrace.com)
- 🐛 **Issues**: [GitHub Issues](https://github.com/altitrace/altitrace/issues)
- 💬 **Discord**: [Join our community](https://discord.gg/altitrace)
- 📧 **Email**: support@altitrace.com

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release notes and version history.