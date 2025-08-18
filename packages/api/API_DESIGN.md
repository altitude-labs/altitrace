# AltiTrace API Design Specification

## Overview

This document defines the comprehensive API endpoints and schemas for the AltiTrace HyperEVM Transaction Simulator, implementing all requirements from HACKATHON.md.

## Base URL Structure

```
https://api.altitrace.io/v1
```

## Authentication

- API Key authentication via `X-API-Key` header (optional for public endpoints)
- Rate limiting: 100 requests/minute for unauthenticated, 1000 requests/minute for authenticated

## API Endpoints

### 1. Transaction Simulation

#### POST `/simulate`
Simulate a single transaction with advanced features.

**Request Schema:**
```json
{
  "transaction": {
    "from": "0x...",      // Required: Sender address
    "to": "0x...",        // Required: Contract/recipient address
    "data": "0x...",      // Optional: Calldata
    "value": "0x0",       // Optional: ETH value in wei (hex)
    "gas": "0x...",       // Optional: Gas limit
    "gasPrice": "0x...",  // Optional: Gas price (legacy)
    "maxFeePerGas": "0x...",      // Optional: Max fee (EIP-1559)
    "maxPriorityFeePerGas": "0x...", // Optional: Priority fee (EIP-1559)
    "nonce": 123,         // Optional: Override nonce
    "type": "0x2"         // Optional: Transaction type
  },
  "blockContext": {
    "blockNumber": "0x123abc",  // Optional: Simulate at specific block (hex)
    "blockTag": "latest",       // Optional: latest/pending/safe/finalized
    "timestamp": 1234567890     // Optional: Override block timestamp
  },
  "simulationOptions": {
    "validation": true,         // Default true: Full EVM validation
    "traceAssetChanges": true,  // Track ERC-20/721 balance changes
    "traceTransfers": true,     // Track ETH transfers as logs
    "includeAccessList": true,  // Generate optimized access list
    "includeTrace": true,       // Include execution trace
    "traceType": "callTracer"   // Trace type: callTracer/prestateTracer
  },
  "stateOverrides": [
    {
      "address": "0x...",
      "balance": "0x...",       // Override ETH balance
      "nonce": 123,             // Override nonce
      "code": "0x...",          // Override contract code
      "state": {                // Override storage slots
        "0x00...": "0x...",
        "0x01...": "0x..."
      },
      "stateDiff": {            // Alternative: diff format
        "0x00...": "0x..."
      }
    }
  ],
  "blockOverrides": {
    "number": "0x...",
    "timestamp": "0x...",
    "gasLimit": "0x...",
    "baseFeePerGas": "0x...",
    "difficulty": "0x...",
    "prevRandao": "0x..."
  }
}
```

**Response Schema:**
```json
{
  "success": true,
  "data": {
    "simulationId": "uuid-v4",
    "blockNumber": "0x123abc",
    "status": "success",        // success/reverted/failed
    "gasUsed": "0x...",
    "gasRefund": "0x...",
    "executionGas": "0x...",
    "returnData": "0x...",
    "logs": [
      {
        "address": "0x...",
        "topics": ["0x..."],
        "data": "0x...",
        "logIndex": "0x0",
        "decoded": {
          "eventName": "Transfer",
          "signature": "Transfer(address,address,uint256)",
          "args": {
            "from": "0x...",
            "to": "0x...",
            "value": "1000000000000000000"
          },
          "humanReadable": "Transfer 1.0 ETH from 0x... to 0x..."
        }
      }
    ],
    "assetChanges": [
      {
        "address": "0x...",     // Account address
        "token": {
          "address": "0x...",   // Token contract
          "symbol": "USDC",
          "decimals": 6,
          "type": "ERC20"       // ERC20/ERC721/ERC1155
        },
        "balanceBefore": "1000000",
        "balanceAfter": "2000000",
        "difference": "+1000000"
      }
    ],
    "stateChanges": [
      {
        "address": "0x...",
        "storageChanges": {
          "0x00...": {
            "before": "0x...",
            "after": "0x..."
          }
        },
        "balanceChange": {
          "before": "0x...",
          "after": "0x..."
        },
        "nonceChange": {
          "before": 10,
          "after": 11
        }
      }
    ],
    "trace": {
      "type": "CALL",
      "from": "0x...",
      "to": "0x...",
      "value": "0x0",
      "gas": "0x...",
      "gasUsed": "0x...",
      "input": "0x...",
      "output": "0x...",
      "calls": [...]        // Nested calls
    },
    "accessList": [
      {
        "address": "0x...",
        "storageKeys": ["0x...", "0x..."]
      }
    ],
    "error": {
      "type": "execution-reverted",
      "reason": "Insufficient balance",
      "data": "0x...",
      "stackTrace": [...],
      "gasUsed": "0x..."
    },
    "gasBreakdown": {
      "intrinsic": "21000",
      "execution": {
        "computation": "15000",
        "storage": {
          "reads": "2100",
          "writes": "20000"
        },
        "memory": "3000",
        "logs": "1500",
        "calls": "5000",
        "creates": "0"
      },
      "refund": "0",
      "accessList": "1000"
    }
  },
  "metadata": {
    "requestId": "req_123abc",
    "timestamp": "2024-01-01T12:00:00Z",
    "executionTime": 45,        // milliseconds
    "rpcNode": "hyperevm-1"
  }
}
```

#### POST `/simulate/batch`
Simulate multiple independent transactions in parallel.

**Request Schema:**
```json
{
  "simulations": [
    // Array of simulation requests (same as /simulate)
    // Maximum 10 simulations per batch
  ],
  "commonOptions": {
    // Optional: Common options applied to all simulations
    "blockContext": {...},
    "simulationOptions": {...}
  }
}
```

**Response Schema:**
```json
{
  "success": true,
  "data": {
    "batchId": "batch_uuid",
    "results": [
      // Array of simulation results
    ],
    "summary": {
      "total": 10,
      "successful": 8,
      "reverted": 1,
      "failed": 1,
      "totalGasUsed": "0x...",
      "totalExecutionTime": 250
    }
  }
}
```

#### POST `/simulate/bundle`
Simulate a bundle of interdependent transactions executed sequentially.

**Request Schema:**
```json
{
  "bundle": [
    {
      "transaction": {...},     // Same as single simulation
      "allowFailure": false,    // Continue bundle if this tx fails
      "gasLimit": "0x..."      // Override gas limit for this tx
    }
  ],
  "blockContext": {...},
  "simulationOptions": {
    "enableProfiling": true,    // Detailed performance metrics
    "stopOnFailure": true,      // Stop bundle on first failure
    "traceInterDependencies": true  // Track state changes between txs
  },
  "stateOverrides": [...],
  "sharedState": true          // Carry state changes between transactions
}
```

**Response Schema:**
```json
{
  "success": true,
  "data": {
    "bundleId": "bundle_uuid",
    "blockNumber": "0x...",
    "transactions": [
      {
        "index": 0,
        "status": "success",
        "result": {...},        // Full simulation result
        "stateImpact": {        // How this tx affected bundle state
          "storageWrites": 5,
          "balanceChanges": 2,
          "gasConsumed": "0x..."
        }
      }
    ],
    "bundleSummary": {
      "totalTransactions": 5,
      "successfulTransactions": 4,
      "totalGasUsed": "0x...",
      "netAssetChanges": [...],
      "finalStateRoot": "0x..."
    },
    "dependencies": [
      {
        "from": 0,              // Transaction index
        "to": 1,
        "type": "state",        // state/balance/nonce
        "details": "Tx 0 deployed contract used by Tx 1"
      }
    ]
  }
}
```

### 2. Gas Optimization

#### POST `/gas/estimate`
Estimate gas with optimization suggestions.

**Request Schema:**
```json
{
  "transaction": {...},         // Same as simulation
  "optimizationLevel": "aggressive",  // none/standard/aggressive
  "includeAlternatives": true   // Suggest alternative implementations
}
```

**Response Schema:**
```json
{
  "success": true,
  "data": {
    "gasEstimate": "0x...",
    "baseFee": "0x...",
    "priorityFee": "0x...",
    "maxFee": "0x...",
    "estimatedCost": {
      "wei": "0x...",
      "gwei": "25.5",
      "eth": "0.0000255",
      "usd": "0.05"            // Optional: current USD value
    },
    "optimizations": [
      {
        "type": "access-list",
        "description": "Add access list to save ~2100 gas",
        "gasSavings": "2100",
        "implementation": {
          "accessList": [...]
        }
      },
      {
        "type": "calldata-optimization",
        "description": "Pack calldata more efficiently",
        "gasSavings": "500",
        "implementation": {
          "originalData": "0x...",
          "optimizedData": "0x..."
        }
      }
    ],
    "breakdown": {...}          // Detailed gas breakdown
  }
}
```

#### POST `/gas/access-list`
Generate optimized access list for a transaction.

**Request Schema:**
```json
{
  "transaction": {...},
  "includePrecompiles": false,
  "optimizationStrategy": "gas"  // gas/size/balanced
}
```

### 3. Historical Simulation

#### POST `/simulate/historical`
Simulate transaction at a specific historical block.

**Request Schema:**
```json
{
  "transaction": {...},
  "blockNumber": "0x123abc",    // Required: Historical block
  "replayProtection": true,      // Validate against replay attacks
  "includeHistoricalPrices": true
}
```

### 4. Contract Analysis

#### POST `/analyze/contract`
Analyze contract code with simulation.

**Request Schema:**
```json
{
  "address": "0x...",           // Existing contract
  "newCode": "0x...",          // Optional: Test with modified code
  "testTransactions": [         // Test various scenarios
    {
      "description": "Transfer tokens",
      "transaction": {...}
    }
  ],
  "securityChecks": true,
  "gasAnalysis": true
}
```

**Response Schema:**
```json
{
  "success": true,
  "data": {
    "contract": {
      "address": "0x...",
      "codeSize": 12345,
      "deploymentBlock": "0x...",
      "isVerified": true
    },
    "testResults": [...],
    "securityAnalysis": {
      "vulnerabilities": [],
      "warnings": [
        {
          "type": "unchecked-call",
          "severity": "medium",
          "location": "0x123",
          "description": "External call without checking return value"
        }
      ]
    },
    "gasProfile": {
      "methods": {
        "transfer": {
          "min": "25000",
          "average": "27500",
          "max": "35000"
        }
      }
    }
  }
}
```

### 5. Debugging & Tracing

#### POST `/debug/transaction`
Deep debugging of transaction execution.

**Request Schema:**
```json
{
  "transaction": {...},
  "debugOptions": {
    "disableStorage": false,
    "disableMemory": false,
    "disableStack": false,
    "fullStorage": true,
    "breakpoints": [
      {
        "type": "opcode",
        "value": "SSTORE"
      },
      {
        "type": "address",
        "value": "0x..."
      }
    ]
  }
}
```

### 6. RPC Compatibility Endpoints

#### POST `/rpc`
Standard Ethereum JSON-RPC endpoint with HyperEVM extensions.

Supports:
- `eth_simulateV1` - Full simulation capabilities
- `eth_call` - Standard call simulation
- `eth_estimateGas` - Gas estimation
- `debug_traceTransaction` - Transaction tracing
- `hyperevm_simulateBundle` - Bundle simulation (custom method)

### 7. WebSocket Subscriptions

#### WS `/ws`
Real-time simulation updates and streaming results.

**Subscribe to simulation events:**
```json
{
  "method": "subscribe",
  "params": {
    "type": "simulation",
    "filter": {
      "address": "0x...",
      "status": ["reverted", "failed"]
    }
  }
}
```

## Error Responses

**Standard Error Schema:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TRANSACTION",
    "message": "Transaction validation failed",
    "details": {
      "field": "from",
      "reason": "Invalid address format",
      "value": "0xinvalid"
    },
    "trace": "Stack trace for debugging",
    "suggestion": "Ensure address is 40 hex characters with 0x prefix"
  },
  "metadata": {
    "requestId": "req_123abc",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

**Error Codes:**
- `INVALID_REQUEST` - Malformed request
- `INVALID_TRANSACTION` - Transaction validation failed
- `SIMULATION_FAILED` - Simulation execution error
- `INSUFFICIENT_FUNDS` - Account has insufficient balance
- `GAS_LIMIT_EXCEEDED` - Gas limit too high
- `RATE_LIMITED` - Too many requests
- `INTERNAL_ERROR` - Server error
- `RPC_ERROR` - Upstream RPC error

## Rate Limiting

**Headers:**
- `X-RateLimit-Limit` - Request limit
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Reset timestamp

## Pagination

For endpoints returning lists:
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## Webhooks

Configure webhooks for simulation events:

**POST `/webhooks`**
```json
{
  "url": "https://your-app.com/webhook",
  "events": ["simulation.failed", "bundle.completed"],
  "secret": "webhook_secret"
}
```

## SDK Usage Examples

```rust
// Rust SDK Example
use altitrace::{Client, SimulationRequest};

let client = Client::new("api_key");
let result = client.simulate(SimulationRequest {
    transaction: Transaction {
        from: "0x...",
        to: "0x...",
        data: Some("0x..."),
        ..Default::default()
    },
    options: SimulationOptions {
        trace_asset_changes: true,
        ..Default::default()
    },
}).await?;
```

## Performance Targets

- Single simulation: < 100ms
- Batch simulation (10 txs): < 500ms
- Bundle simulation: < 200ms per transaction
- WebSocket latency: < 10ms

## Security Considerations

1. Input validation on all addresses and hex data
2. Gas limit caps to prevent DoS
3. State override size limits
4. Request size limits (1MB)
5. Authentication for write operations
6. CORS configuration for web access

## Monitoring & Metrics

Expose metrics at `/metrics`:
- Request count by endpoint
- Response times (p50, p95, p99)
- Error rates by type
- Active WebSocket connections
- RPC node health