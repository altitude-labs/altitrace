# Changelog

All notable changes to the Altitrace SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-XX

### Added

#### Core Features
- **Complete TypeScript SDK** for Altitrace HyperEVM transaction simulation platform
- **Fluent API Builder Pattern** for intuitive simulation request construction
- **Comprehensive Error Handling** with specific error types and retry logic
- **Generated Type Safety** from OpenAPI specifications using openapi-typescript
- **HTTP Client** with timeout, retry logic, and proper error handling

#### Simulation Features
- **Transaction Simulation** - Simulate single and multiple transaction calls
- **Batch Simulation** - Execute multiple independent simulations concurrently
- **State Overrides** - Modify account state (balance, nonce, code, storage) before simulation
- **Block Overrides** - Control block environment (timestamp, number, gas limit, etc.)
- **Asset Change Tracking** - Monitor ERC-20/ERC-721 token balance changes
- **Transfer Tracking** - Track ETH transfers with detailed logging
- **Gas Analysis** - Detailed gas usage breakdown and optimization insights

#### Developer Experience
- **Viem Integration** - Seamless conversion between Viem and SDK types
- **Utility Functions** - Gas, Wei, and block number conversion utilities
- **Response Processing** - Extended simulation results with helper methods
- **Validation Utilities** - Comprehensive input validation with clear error messages
- **Type Guards** - Runtime type checking for safer development

#### Client Configuration
- **Flexible Configuration** - Customizable base URL, timeout, retries, and headers
- **Debug Mode** - Optional debug logging for development
- **Pre-configured Clients** - Ready-made configurations for local, production, and testing
- **Health Monitoring** - API health check endpoint support

#### Documentation & Examples
- **Complete JSDoc Documentation** - Inline documentation for all public APIs
- **README with Examples** - Comprehensive usage examples and best practices
- **Basic Usage Examples** - Simple examples for getting started
- **Advanced Usage Examples** - Complex scenarios with state overrides and batch operations
- **TypeScript Examples** - Full TypeScript support with strict typing

#### Testing & Quality
- **Comprehensive Test Suite** - Unit tests for all major functionality
- **Error Scenario Testing** - Tests for various error conditions and edge cases
- **Integration Testing** - Tests for HTTP client and API integration
- **Type Safety Testing** - Validation of TypeScript types and assertions
- **Viem Integration Testing** - Tests for Viem type conversions

#### Build & Development
- **Modern Build System** - Using tsup for ESM/CJS dual output
- **Strict TypeScript Configuration** - Zero `any` types, strict mode enabled
- **ESLint Configuration** - Comprehensive linting rules for code quality
- **Prettier Configuration** - Consistent code formatting
- **Package Configuration** - Proper package.json with all necessary fields

### Technical Details

#### Architecture
- **Layered Architecture** - Clear separation of concerns between HTTP, business logic, and utilities
- **Builder Pattern** - Fluent API for constructing complex simulation requests
- **Response Processing** - Automatic enhancement of API responses with utility methods
- **Error Hierarchy** - Structured error types for different failure scenarios

#### Type System
- **Generated Types** - Automatic type generation from OpenAPI specification
- **Branded Types** - Distinct types for addresses, hex strings, and numbers
- **Utility Types** - Helper types for common patterns and operations
- **Strict Validation** - Runtime validation matching TypeScript types

#### HTTP Features
- **Automatic Retries** - Configurable retry logic for transient failures
- **Request Timeouts** - Customizable timeout handling
- **Error Classification** - Automatic determination of retryable vs non-retryable errors
- **Request/Response Logging** - Debug logging for troubleshooting

#### Integration
- **Viem Compatibility** - Full interoperability with Viem types and patterns
- **Zero Dependencies** - No runtime dependencies beyond TypeScript and fetch
- **Tree Shakeable** - Modular design for optimal bundle sizes
- **Node.js & Browser** - Works in both Node.js and browser environments

### Breaking Changes
- This is the initial release, so no breaking changes from previous versions

### Security
- **No Secrets in Logging** - Careful handling of sensitive information
- **Input Validation** - Comprehensive validation of all user inputs
- **Safe Type Assertions** - Proper use of TypeScript type guards
- **Error Information Sanitization** - Secure error message handling

### Performance
- **Concurrent Batch Processing** - Parallel execution of batch simulations
- **Efficient HTTP Client** - Reuse of connections and proper resource management
- **Minimal Bundle Size** - Tree-shakeable exports and no unnecessary dependencies
- **Memory Efficient** - Proper cleanup and resource management

### Known Issues
- None at time of release

### Migration Guide
- This is the initial release, so no migration is required

### Dependencies
- **Development Dependencies**: TypeScript, ESLint, Prettier, tsup, Bun test framework
- **Peer Dependencies**: Viem (for optimal Web3 integration)
- **Runtime Dependencies**: None (uses built-in fetch)

---

## Future Releases

### Planned Features
- **WebSocket Support** - Real-time simulation updates and streaming
- **Caching Layer** - Intelligent caching of simulation results
- **Simulation Templates** - Pre-built simulation patterns for common use cases
- **Gas Price Oracle Integration** - Real-time gas price recommendations
- **Transaction Bundling** - MEV-aware transaction bundling simulations
- **Cross-Chain Support** - Multi-chain simulation capabilities

### Roadmap
- **v1.1.0** - WebSocket support and enhanced error reporting
- **v1.2.0** - Simulation templates and common patterns
- **v1.3.0** - Advanced analytics and reporting features
- **v2.0.0** - Major API enhancements and cross-chain support

---

For more information about releases and updates:
- 📖 **Documentation**: [docs.altitrace.com](https://docs.altitrace.com)
- 📦 **NPM Package**: [npmjs.com/package/@altitrace/sdk](https://www.npmjs.com/package/@altitrace/sdk)
- 🐛 **Issues**: [GitHub Issues](https://github.com/altitrace/altitrace/issues)
- 💬 **Community**: [Discord](https://discord.gg/altitrace)