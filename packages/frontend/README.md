# @altitrace/frontend

The web frontend for AltiTrace - an interactive playground to build, simulate, and visualize HyperEVM transactions.

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with custom design system
- **State Management**: Zustand
- **UI Components**: Headless UI + custom components
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts for visualization
- **Integration**: `@altitrace/sdk` (TypeScript SDK)
- **EVM Integration**: viem for transaction utilities

## Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build

# Type checking
bun run type-check

# Linting
bun run lint
```

## Project Structure

```
src/
├── app/                 # Next.js app router pages
├── components/          # React components
│   ├── ui/             # Reusable UI components
│   ├── forms/          # Form components
│   ├── simulation/     # Simulation-specific components
│   └── charts/         # Data visualization components
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
└── styles/             # Global styles and themes
```

## Features

- Transaction simulation interface
- Real-time execution traces
- Gas usage analysis and visualization
- State override controls
- Bundle simulation support
- Interactive result exploration
- Shareable simulation links

## Integration

The frontend integrates with:

- `@altitrace/sdk` - primary interface to the simulation and trace API
- HyperEVM network via viem

Environment:

- `NEXT_PUBLIC_API_URL` to set the base API host (SDK uses `${NEXT_PUBLIC_API_URL}/v1`).
