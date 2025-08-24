import { decodeErrorResult, formatEther, formatGwei } from 'viem'

/**
 * Parse and format blockchain error messages for better readability
 */

interface ParsedError {
  title: string
  details?: string
  type: 'insufficient-funds' | 'gas-limit' | 'revert' | 'rpc' | 'unknown'
}

/**
 * Decode error data from output hex string using Error(string) ABI
 */
function decodeErrorData(outputData: string): string | null {
  try {
    if (!outputData || outputData === '0x') return null
    
    // Use viem to decode Error(string) - the standard revert reason format
    const result = decodeErrorResult({
      abi: [
        {
          type: 'error',
          name: 'Error',
          inputs: [
            {
              name: 'reason',
              type: 'string'
            }
          ]
        }
      ],
      data: outputData as `0x${string}`
    })
    
    return result.args?.[0] as string || null
  } catch {
    // If decoding fails, it might be a different error format or not an error at all
    return null
  }
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
      const eth = Number.parseFloat(ethValue)
      
      if (eth >= 0.001) {
        return `${eth.toFixed(6)} HYPE`
      }
      
      const gweiValue = formatGwei(wei)
      const gwei = Number.parseFloat(gweiValue)
      
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
  
  // Revert reason pattern with data
  const revertMatch = errorMessage.match(/execution reverted:\s*(.+)/i)
  if (revertMatch) {
    const revertReason = revertMatch[1].trim()
    return {
      type: 'revert',
      title: 'Transaction reverted',
      details: revertReason
    }
  }
  
  // Generic revert without reason - but check if this is just a generic message
  // and there might be actual error data in other errors
  if (errorMessage.toLowerCase().includes('revert') && errorMessage.toLowerCase().includes('contract')) {
    return {
      type: 'revert',
      title: 'Transaction reverted',
      details: undefined // No specific details, might be paired with actual error data
    }
  }
  
  // Any other revert pattern
  if (errorMessage.toLowerCase().includes('revert')) {
    return {
      type: 'revert',
      title: 'Transaction reverted',
      details: errorMessage
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
  
  // Check if this might be contract error data (could be any format)
  // If it's not a typical error message format, it's likely contract error data
  if (!errorMessage.toLowerCase().includes('error') && 
      !errorMessage.toLowerCase().includes('failed') &&
      !errorMessage.toLowerCase().includes('invalid') &&
      errorMessage.length > 0) {
    return {
      type: 'revert',
      title: 'Contract error',
      details: errorMessage
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
 * Parse blockchain error with output data context (when we have decoded details)
 */
export function parseBlockchainErrorWithOutput(error: string | { reason?: string; message?: string }, outputData?: string): ParsedError {
  // If we have output data, try to decode it first
  if (outputData && outputData !== '0x') {
    const decodedReason = decodeErrorData(outputData)
    if (decodedReason) {
      return {
        type: 'revert',
        title: 'Execution reverted',
        details: decodedReason
      }
    }
  }
  
  // Fall back to regular error parsing
  return parseBlockchainError(error)
}

/**
 * Get a short error summary suitable for status displays
 */
export function getErrorSummary(error: string | { reason?: string; message?: string }): string {
  const parsed = parseBlockchainError(error)
  return parsed.details ? `${parsed.title}: ${parsed.details}` : parsed.title
}