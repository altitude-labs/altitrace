import { type Chain, createPublicClient, defineChain, http } from 'viem'

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
      http: ['https://rpc.hyperliquid.xyz/evm'],
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
  transport: http(),
})
