import { createPublicClient, type Hash, http } from 'viem'
import { hyperevm } from '@/config/chains'

// Create a public client for reading blockchain data
const publicClient = createPublicClient({
  chain: hyperevm,
  transport: http(),
})

export interface TransactionData {
  from: string
  to: string | null
  value: string
  data: string
  gas?: string
  blockNumber?: string
}

export async function loadTransactionFromHash(
  txHash: Hash,
): Promise<TransactionData | null> {
  try {
    // Fetch transaction receipt for detailed information
    const receipt = await publicClient.getTransactionReceipt({
      hash: txHash,
    })

    // Also fetch the transaction itself for additional details
    const transaction = await publicClient.getTransaction({
      hash: txHash,
    })

    if (!transaction) {
      return null
    }

    return {
      from: transaction.from,
      to: transaction.to || receipt.contractAddress || '',
      value: `0x${transaction.value.toString(16)}`,
      data: transaction.input || '0x',
      gas: transaction.gas ? `0x${transaction.gas.toString(16)}` : undefined,
      blockNumber: `0x${receipt.blockNumber.toString(16)}`,
    }
  } catch {
    return null
  }
}

export function isValidTransactionHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash)
}
