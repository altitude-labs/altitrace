import { formatEther, formatGwei } from 'viem'

/**
 * Parse and format blockchain error messages for better readability
 */

interface ParsedError {
  title: string
  details?: string
  type: 'insufficient-funds' | 'gas-limit' | 'revert' | 'rpc' | 'unknown'
}

/**
 * Parse common blockchain error patterns and return a formatted error message
 */
export function parseBlockchainError(error: string | { reason?: string; message?: string }): ParsedError {
  const errorMessage = typeof error === 'string' ? error : (error.reason || error.message || '')
  
  // Insufficient funds error pattern
  const insufficientFundsMatch = errorMessage.match(/lack of funds\s*\((\d+)\)\s*for max fee\s*\((\d+)\)/i)
  if (insufficientFundsMatch) {
    const [, currentBalance, requiredFee] = insufficientFundsMatch
    const currentBalanceWei = BigInt(currentBalance)
    const requiredFeeWei = BigInt(requiredFee)
    
    // Convert to more readable format using viem
    const formatWei = (wei: bigint): string => {
      const ethValue = formatEther(wei)
      const eth = parseFloat(ethValue)
      
      if (eth >= 0.001) {
        return `${eth.toFixed(6)} HYPE`
      }
      
      const gweiValue = formatGwei(wei)
      const gwei = parseFloat(gweiValue)
      
      if (gwei >= 1) {
        return `${gwei.toFixed(2)} Gwei`
      }
      
      return `${wei.toString()} wei`
    }
    
    return {
      type: 'insufficient-funds',
      title: 'Insufficient funds for transaction',
      details: `Required: ${formatWei(requiredFeeWei)}, Available: ${formatWei(currentBalanceWei)}`
    }
  }
  
  // Gas limit exceeded pattern
  const gasLimitMatch = errorMessage.match(/gas limit reached|out of gas|exceeds block gas limit/i)
  if (gasLimitMatch) {
    return {
      type: 'gas-limit',
      title: 'Gas limit exceeded',
      details: 'Transaction requires more gas than the block gas limit allows'
    }
  }
  
  // Revert reason pattern
  const revertMatch = errorMessage.match(/execution reverted:\s*(.+)/i)
  if (revertMatch) {
    return {
      type: 'revert',
      title: 'Transaction reverted',
      details: revertMatch[1].trim()
    }
  }
  
  // Generic revert without reason
  if (errorMessage.toLowerCase().includes('revert')) {
    return {
      type: 'revert',
      title: 'Transaction reverted',
      details: 'The transaction was reverted by the contract'
    }
  }
  
  // RPC errors
  if (errorMessage.includes('RPC') || errorMessage.includes('error code')) {
    // Try to extract the most relevant part of the RPC error
    const rpcMatch = errorMessage.match(/EVM reported invalid transaction[^:]*:\s*(.+)/)
    if (rpcMatch) {
      // Recursively parse the inner error
      return parseBlockchainError(rpcMatch[1])
    }
    
    return {
      type: 'rpc',
      title: 'RPC Error',
      details: errorMessage.replace(/RPC internal error:\s*/i, '').replace(/RPC error:\s*/i, '')
    }
  }
  
  // Default fallback
  return {
    type: 'unknown',
    title: 'Transaction failed',
    details: errorMessage || 'An unknown error occurred'
  }
}

/**
 * Get a short error summary suitable for status displays
 */
export function getErrorSummary(error: string | { reason?: string; message?: string }): string {
  const parsed = parseBlockchainError(error)
  return parsed.details ? `${parsed.title}: ${parsed.details}` : parsed.title
}