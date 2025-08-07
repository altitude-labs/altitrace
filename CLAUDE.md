# CLAUDE.md

## Project Context

This prompt is intended to guide Claude Code in generating high-quality, structured code for a hackathon project. The project is a **HyperEVM transaction simulation platform**, enabling developers, protocols, and users to simulate, debug, and analyze EVM transactions within the HyperEVM network. It includes a backend API, a TypeScript SDK, and a frontend web interface.

We prioritize **strong typing**, **developer experience**, and a **modular, hackathon-friendly architecture**. You must avoid all use of `any` and prefer precise, composable types/interfaces. We leverage [`viem`](https://viem.sh) for EVM interactions.

---

## Repository Structure

This monorepo is organized as follows:

```
packages/
├── api ← REST + RPC server handling simulation requests
├── sdk ← TypeScript SDK for interacting with the simulation engine
└── frontend ← Web UI (React) for manual simulations and results visualization
```

Your contributions will focus primarily on the `api` and `sdk` packages.

---

## Tech Stack

- **Language**: TypeScript (strict mode enabled)
- **EVM Interaction**: [`viem`](https://viem.sh)
- **API Server**: Node.js (Fastify)
- **SDK**: Typed client with helper functions, request builders, and response types
- **Simulation Engine**: Built on top of HyperEVM JSON-RPC, with use of [`evmstate`](https://github.com/polareth/evmstate)
- **Trace/Debug Logic**: Can extend or wrap `evmstate` to extract and decode low-level EVM traces
- **Package Management**: Workspaces / monorepo setup

---

## Claude Instructions

As Claude Code, you are tasked with helping build core parts of the project.

### General Guidelines

- ✅ **BUN use**: Bun should be used instead of NPM.
- ✅ **Strong Typing**: Use exact types. Never use `any`. Prefer utility types and discriminated unions.
- ✅ **Modularity**: Split concerns into clear, isolated modules with interfaces where possible.
- ✅ **Clarity Over Cleverness**: Favor readability and maintainability.
- ✅ **Use `viem`**: For transaction decoding, traces, address formatting, ABI handling, etc.
- ✅ **Leverage `evmstate`**: Use or wrap logic from [evmstate](https://github.com/polareth/evmstate) to provide execution traces or storage diffs where needed.
- ✅ **Hackathon Friendly**: Be pragmatic. The focus is on **getting to usable output fast**, while keeping the code clean.

---

## Claude Output Examples

- A suggested folder layout for `packages/sdk` or `packages/api`
- A strongly typed simulation request handler (API)
- A function that wraps `viem.simulateContract` with HyperEVM-specific overrides
- A typed interface for a simulation result (gas used, traces, logs, errors)
- A wrapper around `evmstate` to enrich results from a simulation
- TypeScript SDK functions like `simulateTransaction`, `buildBundle`, `getDecodedLogs`, etc.

---

## Output Formatting

When writing code, please:

- Wrap it in a single code block
- Annotate types if unclear
- Avoid external dependencies unless strictly necessary
- Comment where helpful

---
