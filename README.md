# Altitrace

A friendly transaction simulator for the HyperEVM ecosystem. Test, debug, and understand your transactions before they go on-chain.

## What is Altitrace?

Altitrace helps you simulate EVM transactions with precision and ease. Whether you're building a DeFi protocol, testing smart contracts, or exploring transaction flows, Altitrace gives you the insights you need.

**Key features:**
- Simulate transactions against live or historical HyperEVM state
- Override account balances, contract code, and storage
- Get detailed gas usage, traces, and decoded events
- Test complex transaction bundles and MEV strategies

## Getting Started

### Quick Installation

```bash
# Install the SDK
bun add @altitrace/sdk viem

# Or clone the full project
git clone https://github.com/altitude-dev/altitrace.git
cd altitrace
bun install
bun run build
```

### Simple Example

```typescript
import { createClient } from '@altitrace/sdk'

const client = createClient.local()

// Simulate a simple transaction
const result = await client.simulate({
  from: '0x742d35Cc6634C0532925a3b8D86C4F5e573F7d5B',
  to: '0xA0b86a33E6441a8F9d6f4c13f8a39c3A7a4e8c',
  data: '0xa9059cbb...' // ERC-20 transfer
})

console.log('Gas used:', result.gasUsed)
console.log('Status:', result.status)
```

## Architecture

Altitrace consists of three main parts:

**🔧 API Server** - REST and RPC endpoints for simulation and tracing
- Rust-powered for speed and reliability
- HyperEVM-native with full precompile support
- Compatible with existing EVM tooling

**📦 TypeScript SDK** - Developer-friendly client library
- Strongly typed with zero `any` usage
- Fluent builder APIs for complex scenarios
- Built-in retry logic and error handling

**🌐 Web Interface** - Interactive simulation playground
- Visual transaction builder and debugger
- Real-time trace visualization
- Export results and share simulations

## Core Capabilities

### Transaction Simulation
- Execute transactions without sending them on-chain
- Get accurate gas estimates and execution results
- Test edge cases and failure scenarios

### State Manipulation
- Override account balances and nonces
- Replace contract code for testing
- Modify storage slots for specific scenarios

### Detailed Tracing
- Call hierarchy with gas breakdown
- Opcode-level execution traces
- State changes and storage access patterns
- Decoded event logs and function calls

### Batch Operations
- Simulate transaction bundles
- Test MEV strategies and arbitrage
- Analyze complex DeFi interactions

## Use Cases

**DeFi Development** - Test swaps, liquidations, and protocol interactions
**Smart Contract Testing** - Validate logic before deployment
**MEV Research** - Analyze arbitrage and sandwich opportunities
**Wallet Development** - Preview transaction outcomes for users
**Protocol Integration** - Understand third-party contract behavior

## Community & Support

- 📖 [Documentation](https://docs.altitrace.reachaltitude.xyz) - Complete guides and API reference
- 💬 [Discord](https://discord.gg/altitrace) - Community support and discussion
- 🐛 [GitHub Issues](https://github.com/altitude-labs/altitrace/issues) - Bug reports and feature requests
- 🔗 [Examples](https://github.com/altitude-dev/altitrace-examples) - Real-world usage patterns

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) to get started.

Built with ❤️ for the HyperEVM ecosystem.
