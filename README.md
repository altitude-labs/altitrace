# Altitrace

<img width="1920" height="1080" alt="altitrace-embedded" src="https://github.com/user-attachments/assets/17b136ea-5e16-45a7-8471-157cf797af00" />


A friendly transaction simulator for the HyperEVM ecosystem. Test, debug, and understand your transactions before they go on-chain.

## What is Altitrace?

Altitrace helps you simulate EVM transactions with precision and ease. Whether you're building a DeFi protocol, testing smart contracts, or exploring transaction flows, Altitrace gives you the insights you need.

**Key features:**
- Simulate transactions against live or historical HyperEVM state
- Override account balances, contract code, and storage
- Get detailed gas usage, traces, and decoded events

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

const client = new AltitraceClient({
  baseUrl: 'https://api.altitrace.reachaltitude.xyz/v1'
})
 
const result = await client.simulate().call({
  from: '0xA79C12BCf11133af01b6B20f16F8AafAECdEBC93',
  to: '0x3aD2674e162A3bdA4be608C75d52f4B18C729193',
  value: '0x40000',
}).atBlock(12026976).execute()

console.log('Gas used:', result.getTotalGasUsed())
console.log('Success:', result.isSuccess())
```

## Architecture

Altitrace consists of three main parts:

**🔧 API Server** - REST endpoint for simulation and tracing
- Compatible with existing EVM tooling

**📦 TypeScript SDK** - Developer-friendly client library
- Strongly typed
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

## Support
- 📖 [Documentation](https://docs.altitrace.reachaltitude.xyz) - Complete guides and API reference
- 🐛 [GitHub Issues](https://github.com/altitude-labs/altitrace/issues) - Bug reports and feature requests

## License

GNU GPL-3.0 License - see [LICENSE](LICENSE) for details.
