import { type Chain, createPublicClient, defineChain, http } from 'viem'

// Get RPC URL from environment variable, fallback to default HyperEVM RPC
const rpcUrl =
  process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.hyperliquid.xyz/evm'

// Determine if we need to use proxy to avoid CORS issues
// Use proxy for local/private IPs or when explicitly requested
const needsProxy =
  typeof window !== 'undefined' &&
  (rpcUrl.includes('localhost') ||
    rpcUrl.includes('127.0.0.1') ||
    rpcUrl.match(/https?:\/\/192\.168\.\d+\.\d+/) ||
    rpcUrl.match(/https?:\/\/172\.\d+\.\d+\.\d+/) ||
    rpcUrl.match(/https?:\/\/10\.\d+\.\d+\.\d+/) ||
    process.env.NEXT_PUBLIC_USE_RPC_PROXY === 'true')

// Use proxy endpoint for browser requests to avoid CORS issues
const effectiveRpcUrl =
  needsProxy && typeof window !== 'undefined' ? '/api/rpc-proxy' : rpcUrl

export const hyperevm = defineChain({
  id: 999,
  name: 'HyperEVM',
  nativeCurrency: {
    decimals: 18,
    name: 'HYPE',
    symbol: 'HYPE',
  },
  rpcUrls: {
    default: {
      http: [effectiveRpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: 'HyperEVM Explorer',
      url: 'https://hyperevmscan.io',
    },
  },
  testnet: false,
}) satisfies Chain

export const viemClient = createPublicClient({
  chain: hyperevm,
  transport: http(effectiveRpcUrl),
})
