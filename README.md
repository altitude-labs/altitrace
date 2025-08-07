# Altitrace

The HyperEVM Transaction Simulator is a development toolchain designed to bring deep, accurate transaction simulation capabilities to the HyperEVM ecosystem. It enables developers, protocols, and power users to test, debug, and optimize transactions **before they hit the chain**.

Traditional EVM simulators are often generic, slow, or incompatible with the evolving architecture of HyperEVM. This platform is built from the ground up with HyperEVM in mind, providing precise control over execution context, full visibility into state changes, and support for HyperEVM-native features like precompiles and low-latency block processing.

At the core of the platform is a simulation engine capable of executing transactions against both **live and historical HyperEVM states**. Developers can override state values, impersonate accounts, modify contract code, and simulate complex transaction bundles with full traceability. Each simulation produces granular execution results: gas breakdowns, decoded event logs, asset flows, errors, and low-level traces.

The project is organized into three main components:

- The **API**, which exposes a REST and HyperEVM-compatible RPC interface for simulation and analysis.
- A **TypeScript SDK**, offering a strictly typed, developer-friendly wrapper to integrate simulations into tools, backends, or CI pipelines.
- A **web frontend**, designed as an interactive playground to build, simulate, and visualize transactions with clarity and shareability.

We rely on [`viem`](https://viem.sh) for encoding/decoding, state formatting, and transaction utilities. For low-level EVM tracing and state diffing, we build on top of [`evmstate`](https://github.com/polareth/evmstate), an open-source tracing engine that we extend for HyperEVM support.

This simulator is not just a debugging tool—it’s a foundation. It exists to empower safe and rapid development across HyperEVM, helping teams understand exactly how their transactions behave under any condition.

If you're building DeFi protocols, wallets, block explorers, or simply testing contracts, this tool is meant to be in your stack.
