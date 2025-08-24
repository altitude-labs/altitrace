import { type Hash, http } from 'viem'
import { hyperevm, viemClient } from '@/config/chains'

export interface TransactionData {
  from: string
  to: string | null
  value: string
  data: string
  gas?: string
  gasPrice?: string
  maxFeePerGas?: string
  maxPriorityFeePerGas?: string
  nonce: number
  blockNumber?: string
  transactionType?: string
  success: boolean
  gasUsed: string
}

export async function loadTransactionFromHash(
  txHash: Hash,
): Promise<TransactionData | null> {
  const publicClient = viemClient
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
      gasPrice: transaction.gasPrice
        ? `0x${transaction.gasPrice.toString(16)}`
        : undefined,
      maxFeePerGas: transaction.maxFeePerGas
        ? `0x${transaction.maxFeePerGas.toString(16)}`
        : undefined,
      maxPriorityFeePerGas: transaction.maxPriorityFeePerGas
        ? `0x${transaction.maxPriorityFeePerGas.toString(16)}`
        : undefined,
      nonce: Number(transaction.nonce),
      blockNumber: `0x${receipt.blockNumber.toString(16)}`,
      transactionType: transaction.type || 'legacy',
      success: receipt.status === 'success',
      gasUsed: `0x${receipt.gasUsed.toString(16)}`,
    }
  } catch (error) {
    console.warn('Failed to load transaction data:', error)
    return null
  }
}

export function isValidTransactionHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash)
}
