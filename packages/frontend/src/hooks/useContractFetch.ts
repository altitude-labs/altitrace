import type { Address } from '@altitrace/sdk/types'
import { useCallback, useState } from 'react'
import {
  ContractFetchError,
  ContractNotVerifiedError,
  ContractFetcher,
  type ContractFetchResult,
} from '@/services/contract-fetcher'

interface UseContractFetchReturn {
  fetchContract: (
    address: string,
    preferredSource?: 'etherscan' | 'hyperscan',
  ) => Promise<ContractFetchResult | null>
  isLoading: boolean
  error: string | null
  lastFetchedContract: ContractFetchResult | null
  clearError: () => void
}

export function useContractFetch(): UseContractFetchReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetchedContract, setLastFetchedContract] =
    useState<ContractFetchResult | null>(null)

  const fetchContract = useCallback(
    async (
      address: string,
      preferredSource: 'etherscan' | 'hyperscan' = 'hyperscan',
    ): Promise<ContractFetchResult | null> => {
      if (!address.trim()) {
        setError('Address is required')
        return null
      }

      if (!ContractFetcher.validateAddress(address)) {
        setError('Invalid address format')
        return null
      }

      setIsLoading(true)
      setError(null)

      try {
        const result = await ContractFetcher.fetchContract(
          address,
          preferredSource,
        )
        setLastFetchedContract(result)
        return result
      } catch (err) {
        let errorMessage = 'Failed to fetch contract'

        if (err instanceof ContractNotVerifiedError) {
          errorMessage = err.message
        } else if (err instanceof ContractFetchError) {
          errorMessage = `${err.source === 'etherscan' ? 'Etherscan' : 'HyperScan'}: ${err.message}`
        } else if (err instanceof Error) {
          errorMessage = err.message
        }

        setError(errorMessage)
        setLastFetchedContract(null)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    fetchContract,
    isLoading,
    error,
    lastFetchedContract,
    clearError,
  }
}

interface UseAbiOnlyFetchReturn {
  fetchAbi: (
    address: string,
    preferredSource?: 'etherscan' | 'hyperscan',
  ) => Promise<import('viem').Abi | null>
  isLoading: boolean
  error: string | null
  clearError: () => void
}

export function useAbiOnlyFetch(): UseAbiOnlyFetchReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAbi = useCallback(
    async (
      address: string,
      preferredSource: 'etherscan' | 'hyperscan' = 'hyperscan',
    ): Promise<import('viem').Abi | null> => {
      if (!address.trim()) {
        setError('Address is required')
        return null
      }

      if (!ContractFetcher.validateAddress(address)) {
        setError('Invalid address format')
        return null
      }

      setIsLoading(true)
      setError(null)

      try {
        const abi = await ContractFetcher.fetchAbi(address, preferredSource)
        return abi
      } catch (err) {
        let errorMessage = 'Failed to fetch ABI'

        if (err instanceof ContractNotVerifiedError) {
          errorMessage = err.message
        } else if (err instanceof ContractFetchError) {
          errorMessage = `${err.source === 'etherscan' ? 'Etherscan' : 'HyperScan'}: ${err.message}`
        } else if (err instanceof Error) {
          errorMessage = err.message
        }

        setError(errorMessage)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    fetchAbi,
    isLoading,
    error,
    clearError,
  }
}

interface UseContractValidationReturn {
  validateAddress: (address: string) => boolean
  isContractAddress: (address: Address) => Promise<boolean>
  isValidating: boolean
  validationError: string | null
}

export function useContractValidation(): UseContractValidationReturn {
  const [isValidating, setIsValidating] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const validateAddress = useCallback((address: string): boolean => {
    const isValid = ContractFetcher.validateAddress(address)
    if (!isValid) {
      setValidationError('Invalid Ethereum address format')
    } else {
      setValidationError(null)
    }
    return isValid
  }, [])

  const isContractAddress = useCallback(
    async (address: Address): Promise<boolean> => {
      setIsValidating(true)
      setValidationError(null)

      try {
        const result = await ContractFetcher.isContractAddress(address)
        return result
      } catch (err) {
        setValidationError(
          err instanceof Error
            ? err.message
            : 'Failed to validate contract address',
        )
        return false
      } finally {
        setIsValidating(false)
      }
    },
    [],
  )

  return {
    validateAddress,
    isContractAddress,
    isValidating,
    validationError,
  }
}
