import type { Address } from '@altitrace/sdk/types'
import { useCallback, useEffect, useState } from 'react'
import type { ContractFetchResult } from '@/services/contract-fetcher'
import {
  clearAllContracts,
  deleteContract,
  exportContract,
  getAllTags,
  getContractStats,
  getContractsByStatus,
  getContractsByTag,
  hasContractWithAddress,
  importContract,
  retrieveAllContracts,
  retrieveContractById,
  type StoredContract,
  searchContracts,
  storeContract,
  updateContract,
  updateContractMetadata,
} from '@/utils/contract-storage'

interface UseContractStorageReturn {
  // Data
  contracts: StoredContract[]
  isLoading: boolean
  error: string | null

  // Actions
  saveContract: (
    contractData: StoredContract['contractData'],
    metadata?: StoredContract['metadata'],
    status?: StoredContract['status'],
  ) => string // Returns new contract ID

  saveFromFetchResult: (
    fetchResult: ContractFetchResult,
    additionalMetadata?: Partial<StoredContract['metadata']>,
  ) => string // Returns new contract ID

  updateContract: (
    id: string,
    updates: Partial<Omit<StoredContract, 'id' | 'timestamp'>>,
  ) => boolean
  deleteContract: (id: string) => boolean
  getContract: (id: string) => StoredContract | null
  searchContracts: (query: string) => StoredContract[]
  getContractsByStatus: (status: StoredContract['status']) => StoredContract[]
  getContractsByTag: (tag: string) => StoredContract[]
  hasContractAddress: (address: Address) => StoredContract | null

  // Metadata management
  updateMetadata: (
    id: string,
    metadata: Partial<StoredContract['metadata']>,
  ) => boolean
  getAllTags: () => string[]
  getStats: () => ReturnType<typeof getContractStats>

  // Import/Export
  exportContract: (id: string) => string | null
  importContract: (data: string) => boolean
  clearAll: () => void

  // UI helpers
  refresh: () => void
  clearError: () => void
}

export function useContractStorage(): UseContractStorageReturn {
  const [contracts, setContracts] = useState<StoredContract[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadContracts = useCallback(() => {
    try {
      setIsLoading(true)
      setError(null)
      const allContracts = retrieveAllContracts()
      setContracts(allContracts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contracts')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load contracts on mount
  useEffect(() => {
    loadContracts()
  }, [loadContracts])

  const saveContract = useCallback(
    (
      contractData: StoredContract['contractData'],
      metadata: StoredContract['metadata'] = {},
      status: StoredContract['status'] = 'imported',
    ): string => {
      try {
        const id = crypto.randomUUID()
        storeContract(id, contractData, metadata, status)
        loadContracts() // Refresh the list
        return id
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save contract')
        throw err
      }
    },
    [loadContracts],
  )

  const saveFromFetchResult = useCallback(
    (
      fetchResult: ContractFetchResult,
      additionalMetadata: Partial<StoredContract['metadata']> = {},
    ): string => {
      const contractData: StoredContract['contractData'] = {
        address: fetchResult.address,
        name: fetchResult.name,
        abi: fetchResult.abi,
        sourceCode: fetchResult.sourceCode,
        constructorArgs: fetchResult.constructorArgs,
        language: fetchResult.language,
        filePath: fetchResult.filePath,
        additionalSources: fetchResult.additionalSources,
      }

      const metadata: StoredContract['metadata'] = {
        title: fetchResult.name,
        verified: fetchResult.verified,
        compiler: fetchResult.compiler,
        version: fetchResult.version,
        explorerSource: fetchResult.explorerSource,
        network: 'hypercore', // Default to HyperCore network
        compilerSettings: fetchResult.compilerSettings,
        // Proxy information
        isProxy: fetchResult.isProxy,
        implementationAddress: fetchResult.implementationAddress,
        implementationName: fetchResult.implementationName,
        proxyType: fetchResult.proxyType,
        ...additionalMetadata,
      }

      return saveContract(contractData, metadata, 'imported')
    },
    [saveContract],
  )

  const handleUpdateContract = useCallback(
    (
      id: string,
      updates: Partial<Omit<StoredContract, 'id' | 'timestamp'>>,
    ): boolean => {
      try {
        const success = updateContract(id, updates)
        if (success) {
          loadContracts() // Refresh the list
        }
        return success
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to update contract',
        )
        return false
      }
    },
    [loadContracts],
  )

  const handleDeleteContract = useCallback(
    (id: string): boolean => {
      try {
        const success = deleteContract(id)
        if (success) {
          loadContracts() // Refresh the list
        }
        return success
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to delete contract',
        )
        return false
      }
    },
    [loadContracts],
  )

  const getContract = useCallback((id: string): StoredContract | null => {
    return retrieveContractById(id)
  }, [])

  const handleSearchContracts = useCallback(
    (query: string): StoredContract[] => {
      return searchContracts(query)
    },
    [],
  )

  const handleGetContractsByStatus = useCallback(
    (status: StoredContract['status']): StoredContract[] => {
      return getContractsByStatus(status)
    },
    [],
  )

  const handleGetContractsByTag = useCallback(
    (tag: string): StoredContract[] => {
      return getContractsByTag(tag)
    },
    [],
  )

  const handleHasContractAddress = useCallback(
    (address: Address): StoredContract | null => {
      return hasContractWithAddress(address)
    },
    [],
  )

  const handleUpdateMetadata = useCallback(
    (id: string, metadata: Partial<StoredContract['metadata']>): boolean => {
      try {
        const success = updateContractMetadata(id, metadata)
        if (success) {
          loadContracts() // Refresh the list
        }
        return success
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to update metadata',
        )
        return false
      }
    },
    [loadContracts],
  )

  const handleGetAllTags = useCallback((): string[] => {
    return getAllTags()
  }, [])

  const getStatsData = useCallback(() => {
    return getContractStats()
  }, [])

  const handleExportContract = useCallback((id: string): string | null => {
    try {
      return exportContract(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export contract')
      return null
    }
  }, [])

  const handleImportContract = useCallback(
    (data: string): boolean => {
      try {
        const success = importContract(data)
        if (success) {
          loadContracts() // Refresh the list
        }
        return success
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to import contract',
        )
        return false
      }
    },
    [loadContracts],
  )

  const handleClearAll = useCallback(() => {
    try {
      clearAllContracts()
      setContracts([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear contracts')
    }
  }, [])

  const refresh = useCallback(() => {
    loadContracts()
  }, [loadContracts])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    // Data
    contracts,
    isLoading,
    error,

    // Actions
    saveContract,
    saveFromFetchResult,
    updateContract: handleUpdateContract,
    deleteContract: handleDeleteContract,
    getContract,
    searchContracts: handleSearchContracts,
    getContractsByStatus: handleGetContractsByStatus,
    getContractsByTag: handleGetContractsByTag,
    hasContractAddress: handleHasContractAddress,

    // Metadata management
    updateMetadata: handleUpdateMetadata,
    getAllTags: handleGetAllTags,
    getStats: getStatsData,

    // Import/Export
    exportContract: handleExportContract,
    importContract: handleImportContract,
    clearAll: handleClearAll,

    // UI helpers
    refresh,
    clearError,
  }
}

// Simpler hook for just getting contract data without storage operations
export function useStoredContracts() {
  const [contracts, setContracts] = useState<StoredContract[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadContracts = () => {
      try {
        setIsLoading(true)
        const allContracts = retrieveAllContracts()
        setContracts(allContracts)
      } catch {
        setContracts([])
      } finally {
        setIsLoading(false)
      }
    }

    loadContracts()

    // Optional: Listen for storage events to sync across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'altitrace_contracts') {
        loadContracts()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  return { contracts, isLoading }
}
