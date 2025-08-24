'use client'

import {
  CheckIcon,
  ExternalLinkIcon,
  Loader2Icon,
  SearchIcon,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Alert, AlertDescription, Button, Input } from '@/components/ui'
import { useContractFetch } from '@/hooks/useContractFetch'
import { useContractStorage } from '@/hooks/useContractStorage'
import type { ContractFetchResult } from '@/services/contract-fetcher'

interface ContractAddressInputProps {
  value: string
  onChange: (value: string, contractData?: ContractFetchResult) => void
  onContractFetched?: (contract: ContractFetchResult) => void
  onContractSaved?: (contractId: string) => void
  onConfirmContract?: (
    contract: ContractFetchResult,
    contractId?: string,
  ) => void
  autoFetch?: boolean
  placeholder?: string
  className?: string
  disabled?: boolean
  showFetchButton?: boolean
  showConfirmButton?: boolean
  preferredSource?: 'etherscan' | 'hyperscan'
}

export function ContractAddressInput({
  value,
  onChange,
  onContractFetched,
  onContractSaved,
  onConfirmContract,
  autoFetch = true,
  placeholder = 'Contract address (0x...)',
  className,
  disabled,
  showFetchButton = true,
  showConfirmButton = true,
  preferredSource = 'hyperscan',
}: ContractAddressInputProps) {
  const [inputValue, setInputValue] = useState(value)
  const [isValid, setIsValid] = useState(true)
  const [lastFetchedAddress, setLastFetchedAddress] = useState<string>('')

  const { fetchContract, isLoading, error, lastFetchedContract, clearError } =
    useContractFetch()
  const { hasContractAddress, saveFromFetchResult } = useContractStorage()

  // Update internal state when value prop changes
  useEffect(() => {
    setInputValue(value)
  }, [value])

  const handleFetchContract = useCallback(
    async (address: string = inputValue, showResults = true) => {
      if (!address.trim()) return

      setLastFetchedAddress(address)
      const result = await fetchContract(address, preferredSource)

      if (result && showResults) {
        onContractFetched?.(result)

        // Check if we already have this contract saved
        const existingContract = hasContractAddress(result.address)
        if (!existingContract) {
          // Auto-save the fetched contract
          try {
            const contractId = saveFromFetchResult(result)
            onContractSaved?.(contractId)
          } catch (_err) {}
        }
      }

      return result
    },
    [
      inputValue,
      fetchContract,
      onContractFetched,
      onContractSaved,
      hasContractAddress,
      saveFromFetchResult,
      preferredSource,
    ],
  )

  // Auto-fetch logic with debouncing
  useEffect(() => {
    if (!autoFetch || !inputValue.trim() || inputValue === lastFetchedAddress) {
      return
    }

    const timeoutId = setTimeout(async () => {
      if (
        inputValue.trim() &&
        inputValue.toLowerCase().startsWith('0x') &&
        inputValue.length === 42
      ) {
        await handleFetchContract(inputValue, false) // Silent auto-fetch
      }
    }, 1000) // 1 second debounce

    return () => clearTimeout(timeoutId)
  }, [inputValue, autoFetch, lastFetchedAddress, handleFetchContract])

  const validateAddress = useCallback((address: string): boolean => {
    if (!address.trim()) {
      setIsValid(true)
      return true
    }

    const valid =
      address.toLowerCase().startsWith('0x') && address.length === 42
    setIsValid(valid)
    return valid
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    setInputValue(input)
    validateAddress(input)
    onChange(input)

    // Clear previous error when user types
    if (error) {
      clearError()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (
        lastFetchedContract &&
        lastFetchedAddress === inputValue &&
        showConfirmButton
      ) {
        // Confirm the fetched contract
        handleConfirmContract()
      } else if (inputValue.trim() && isValid) {
        // Fetch the contract
        handleManualFetch()
      }
    }
  }

  const handleConfirmContract = () => {
    if (lastFetchedContract && onConfirmContract) {
      const existingContract = hasContractAddress(lastFetchedContract.address)
      const contractId = existingContract?.id
      onConfirmContract(lastFetchedContract, contractId)
    }
  }

  const handleManualFetch = () => {
    if (inputValue.trim() && isValid) {
      handleFetchContract(inputValue, true)
    }
  }

  const getExplorerUrl = (
    address: string,
    source: 'etherscan' | 'hyperscan' = preferredSource,
  ) => {
    if (source === 'hyperscan') {
      return `https://www.hyperscan.com/address/${address}`
    }
    return `https://etherscan.io/address/${address}`
  }

  const getStatusMessage = () => {
    if (error) {
      return { type: 'error' as const, message: error }
    }

    if (lastFetchedContract && lastFetchedAddress === inputValue) {
      const existingContract = hasContractAddress(lastFetchedContract.address)
      if (existingContract) {
        return {
          type: 'info' as const,
          message: `Contract "${lastFetchedContract.name}" already saved locally`,
        }
      }

      // Enhanced message for proxy contracts
      if (lastFetchedContract.isProxy) {
        const proxyInfo = lastFetchedContract.implementationAddress
          ? `Proxy resolved to implementation (${lastFetchedContract.abi.length} functions)`
          : `Proxy detected but implementation not found (${lastFetchedContract.abi.length} proxy functions)`

        return {
          type: 'success' as const,
          message: `🔗 ${lastFetchedContract.name} - ${proxyInfo}`,
        }
      }

      return {
        type: 'success' as const,
        message: `✅ Verified contract "${lastFetchedContract.name}" (${lastFetchedContract.abi.length} functions)`,
      }
    }

    if (!isValid && inputValue.trim()) {
      return { type: 'error' as const, message: 'Invalid address format' }
    }

    return null
  }

  const statusMessage = getStatusMessage()

  return (
    <div className={className}>
      <div className="relative">
        <Input
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className={`pr-16 sm:pr-20 ${!isValid ? 'border-red-500 focus:border-red-500' : ''}`}
        />

        {/* Fetch Button */}
        {showFetchButton && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-1 sm:pr-2 gap-0.5 sm:gap-1">
            {inputValue.trim() && isValid && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleManualFetch}
                disabled={isLoading}
                className="h-6 sm:h-7 px-1 sm:px-2 text-xs"
                title="Fetch contract from explorer"
              >
                {isLoading ? (
                  <Loader2Icon className="h-3 w-3 animate-spin" />
                ) : (
                  <SearchIcon className="h-3 w-3" />
                )}
              </Button>
            )}

            {inputValue.trim() && isValid && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  window.open(getExplorerUrl(inputValue), '_blank')
                }
                className="h-6 sm:h-7 px-1 sm:px-2 text-xs"
                title="View on explorer"
              >
                <ExternalLinkIcon className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Status Messages */}
      {statusMessage && (
        <div className="mt-2">
          {statusMessage.type === 'error' && (
            <Alert variant="destructive" className="text-sm">
              <AlertDescription>{statusMessage.message}</AlertDescription>
            </Alert>
          )}

          {statusMessage.type === 'success' && (
            <Alert variant="success" className="text-sm">
              <CheckIcon className="h-4 w-4" />
              <AlertDescription>{statusMessage.message}</AlertDescription>
            </Alert>
          )}

          {statusMessage.type === 'info' && (
            <Alert className="text-sm">
              <CheckIcon className="h-4 w-4" />
              <AlertDescription>{statusMessage.message}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2Icon className="h-4 w-4 animate-spin" />
          Fetching contract from{' '}
          {preferredSource === 'hyperscan' ? 'HyperScan' : 'Etherscan'}...
        </div>
      )}

      {/* Contract Info Display */}
      {lastFetchedContract && lastFetchedAddress === inputValue && !error && (
        <div className="mt-3 p-3 bg-muted rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-semibold text-sm">
                {lastFetchedContract.name}
              </h4>

              {/* Proxy Information */}
              {lastFetchedContract.isProxy && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 rounded">
                    🔗 {lastFetchedContract.proxyType?.toUpperCase()} Proxy
                  </span>
                  {lastFetchedContract.implementationAddress && (
                    <span className="text-xs text-muted-foreground font-mono">
                      → {lastFetchedContract.implementationAddress.slice(0, 6)}
                      ...{lastFetchedContract.implementationAddress.slice(-4)}
                    </span>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground mt-1">
                {lastFetchedContract.verified
                  ? '✅ Verified'
                  : '⚠️ Not verified'}{' '}
                •{lastFetchedContract.abi.length} functions • Source:{' '}
                {lastFetchedContract.explorerSource === 'hyperscan'
                  ? 'HyperScan'
                  : 'Etherscan'}
                {lastFetchedContract.isProxy &&
                  lastFetchedContract.implementationName && (
                    <>
                      <br />
                      <span className="text-blue-600 dark:text-blue-400">
                        Implementation: {lastFetchedContract.implementationName}
                      </span>
                    </>
                  )}
              </p>

              {lastFetchedContract.version && (
                <p className="text-xs text-muted-foreground mt-1">
                  Compiler: {lastFetchedContract.version}
                </p>
              )}
            </div>
            <div className="flex gap-1">
              {showConfirmButton && onConfirmContract && (
                <Button
                  size="sm"
                  onClick={handleConfirmContract}
                  className="h-6 sm:h-7 px-2 sm:px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckIcon className="h-3 w-3 mr-1" />
                  Use Contract
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  window.open(
                    getExplorerUrl(
                      inputValue,
                      lastFetchedContract.explorerSource,
                    ),
                    '_blank',
                  )
                }
                className="h-6 sm:h-7 px-1 sm:px-2 text-xs"
              >
                <ExternalLinkIcon className="h-3 w-3 mr-1" />
                View
              </Button>
              {lastFetchedContract.implementationAddress && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    window.open(
                      getExplorerUrl(
                        lastFetchedContract.implementationAddress!,
                        lastFetchedContract.explorerSource,
                      ),
                      '_blank',
                    )
                  }
                  className="h-6 sm:h-7 px-1 sm:px-2 text-xs"
                  title="View implementation contract"
                >
                  <ExternalLinkIcon className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
