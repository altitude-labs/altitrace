# AltiTrace API

High-performance transaction simulation API for HyperEVM with strict TypeScript implementation.

## Features

- 🚀 **Fast & Modern**: Built with Fastify, Bun, and Viem
- 🔒 **Type Safe**: Strict TypeScript with Zod validation
- 🎯 **HyperEVM Native**: Optimized for HyperEVM blockchain
- 📊 **Comprehensive**: Transaction simulation, gas estimation, tracing
- 🛡️ **Production Ready**: Rate limiting, security headers, error handling
- 📝 **Self-Documenting**: Auto-generated OpenAPI/Swagger docs

## Quick Start

```bash
# Install dependencies
bun install

# Copy environment file and configure
cp .env.example .env

# Start development server
bun run dev

# View API documentation
open http://localhost:3001/docs
```

## Environment Configuration

Required environment variables:

```env
# The RPC must support `debug` and `trace` methods
RPC_URL=http://localhost:8545
PORT=3001
```

## API Endpoints

### Health
- `GET /health` - Basic health check
- `GET /health/ready` - Readiness probe with dependency checks

### Simulation
- `POST /api/v1/simulate` - Simulate single transaction
- `POST /api/v1/simulate/batch` - Batch simulate multiple transactions

### Gas & Utilities
- `POST /api/v1/gas/estimate` - Estimate transaction gas

## Usage Examples

### Single Transaction Simulation

```bash
curl -X POST http://localhost:3001/api/v1/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "params": {
      "to": "0x742d35Cc6610C7532C8382796C6E8EcF5cFdB",
      "data": "0xa9059cbb000000000000000000000000742d35cc6610c7532c8382796c6e8ecf5cfdb000000000000000000000000000000000000000000000000000de0b6b3a7640000",
      "from": "0x123..."
    }
  }'
```

### Batch Simulation

```bash
curl -X POST http://localhost:3001/api/v1/simulate/batch \
  -H "Content-Type: application/json" \
  -d '{
    "simulations": [
      {
        "params": {
          "to": "0x742d35Cc6610C7532C8382796C6E8EcF5cFdB",
          "data": "0xa9059cbb...",
          "from": "0x123..."
        }
      },
      {
        "params": {
          "to": "0xA0b86a33E6441cc3a",
          "data": "0x23b872dd...",
          "from": "0x456..."
        }
      }
    ]
  }'
```

### Gas Estimation

```bash
curl -X POST http://localhost:3001/api/v1/gas/estimate \
  -H "Content-Type: application/json" \
  -d '{
    "to": "0x742d35Cc6610C7532C8382796C6E8EcF5cFdB",
    "data": "0xa9059cbb...",
    "from": "0x123..."
  }'
```

## Response Format

All API responses follow a consistent format:

```typescript
{
  "success": boolean,
  "data": T | undefined,
  "error": {
    "code": string,
    "message": string,
    "details": any
  } | undefined,
  "timestamp": string,
  "requestId": string
}
```

## Development Scripts

```bash
bun run dev         # Start development server with hot reload
bun run build       # Build for production
bun run start       # Start production server
bun run test        # Run tests
bun run lint        # Lint code
bun run typecheck   # Type check without emitting
```

## Architecture

```
src/
├── server.ts          # Fastify server setup
├── config/
│   └── env.ts         # Environment validation
├── routes/
│   ├── health.ts      # Health check endpoints
│   └── simulate.ts    # Simulation endpoints
├── services/
│   └── hyperevm.ts    # HyperEVM client (Viem)
├── types/
│   └── api.ts         # API types & validation schemas
└── utils/
    ├── logger.ts      # Structured logging
    ├── errors.ts      # Error handling
    └── helpers.ts     # Utility functions
```

## Production Considerations

- Configure rate limiting based on your needs
- Set up proper monitoring and alerting
- Use environment-specific RPC endpoints
- Enable API key authentication if required
- Set up load balancing for high availability

## Next Steps

- [ ] Implement state overrides and advanced simulation
- [ ] Add execution tracing with evmstate integration
- [ ] Implement access list generation
- [ ] Add caching layer for performance
- [ ] Set up comprehensive test suite
