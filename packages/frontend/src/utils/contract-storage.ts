import type { Address } from '@altitrace/sdk/types'
import type { Abi } from 'viem'

/**
 * Storage schema for persisting contract data
 */
export interface StoredContract {
  id: string
  timestamp: Date
  contractData: {
    address?: Address
    name?: string
    abi: Abi
    sourceCode?: string
    bytecode?: string
    constructorArgs?: string
    // Enhanced source code information
    language?: 'solidity' | 'vyper' | 'yul'
    filePath?: string
    additionalSources?: Array<{
      filePath: string
      sourceCode: string
    }>
  }
  metadata: {
    title?: string
    tags?: string[]
    network?: string
    verified?: boolean
    compiler?: string
    version?: string
    explorerSource?: 'etherscan' | 'hyperscan' | 'manual'
    description?: string
    // Compilation status tracking
    compilationStatus?: 'original' | 'compiled' | 'modified' | 'error'
    compiledAt?: Date
    sourceCodeVerified?: boolean // true if compiled ABI matches original
    // Enhanced compiler settings
    compilerSettings?: {
      optimization?: { enabled: boolean; runs: number }
      evmVersion?: string
      compilationTarget?: Record<string, string>
      libraries?: Record<string, string>
      remappings?: string[]
    }
    // Proxy information
    isProxy?: boolean
    implementationAddress?: Address
    implementationName?: string
    proxyType?:
      | 'eip1967'
      | 'transparent'
      | 'uups'
      | 'beacon'
      | 'minimal'
      | 'unknown'
  }
  status: 'imported' | 'modified' | 'compiled' | 'error'
}

/**
 * Storage interface for serialization (Date -> string)
 */
interface SerializedStoredContract {
  id: string
  timestamp: string
  contractData: StoredContract['contractData']
  metadata: StoredContract['metadata']
  status: StoredContract['status']
}

const STORAGE_KEY = 'altitrace_contracts'
const MAX_STORED_CONTRACTS = 100

/**
 * Store a contract with UUID
 */
export function storeContract(
  id: string,
  contractData: StoredContract['contractData'],
  metadata: StoredContract['metadata'] = {},
  status: StoredContract['status'] = 'imported',
): void {
  try {
    const storedContract: StoredContract = {
      id,
      timestamp: new Date(),
      contractData,
      metadata,
      status,
    }

    // Get existing contracts
    const existing = retrieveAllContracts()

    // Add new contract to the beginning
    existing.unshift(storedContract)

    // Keep only the most recent contracts
    const trimmed = existing.slice(0, MAX_STORED_CONTRACTS)

    // Serialize for storage (Date -> string)
    const serialized: SerializedStoredContract[] = trimmed.map((contract) => ({
      ...contract,
      timestamp: contract.timestamp.toISOString(),
    }))

    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized))
  } catch (_error) {
    // Fail silently for localStorage issues
  }
}

/**
 * Retrieve all stored contracts with properly reconstructed dates
 */
export function retrieveAllContracts(): StoredContract[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []

    const serialized: SerializedStoredContract[] = JSON.parse(stored)

    // Deserialize (string -> Date)
    return serialized.map((contract) => ({
      ...contract,
      timestamp: new Date(contract.timestamp),
    }))
  } catch (_error) {
    return []
  }
}

/**
 * Retrieve a specific contract by ID
 */
export function retrieveContractById(id: string): StoredContract | null {
  try {
    const allContracts = retrieveAllContracts()
    return allContracts.find((contract) => contract.id === id) || null
  } catch (_error) {
    return null
  }
}

/**
 * Update an existing contract
 */
export function updateContract(
  id: string,
  updates: Partial<Omit<StoredContract, 'id' | 'timestamp'>>,
): boolean {
  try {
    const existing = retrieveAllContracts()
    const index = existing.findIndex((contract) => contract.id === id)

    if (index === -1) return false

    // Update the contract with new data
    existing[index] = {
      ...existing[index],
      ...updates,
      timestamp: new Date(), // Update timestamp on modification
    }

    // Serialize and store updated list
    const serialized: SerializedStoredContract[] = existing.map((contract) => ({
      ...contract,
      timestamp: contract.timestamp.toISOString(),
    }))

    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized))
    return true
  } catch (_error) {
    return false
  }
}

/**
 * Delete a contract by ID
 */
export function deleteContract(id: string): boolean {
  try {
    const existing = retrieveAllContracts()
    const filtered = existing.filter((contract) => contract.id !== id)

    if (filtered.length === existing.length) {
      return false // Contract not found
    }

    // Serialize and store updated list
    const serialized: SerializedStoredContract[] = filtered.map((contract) => ({
      ...contract,
      timestamp: contract.timestamp.toISOString(),
    }))

    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized))
    return true
  } catch (_error) {
    return false
  }
}

/**
 * Search contracts by name, address, or tags
 */
export function searchContracts(query: string): StoredContract[] {
  const allContracts = retrieveAllContracts()
  const lowercaseQuery = query.toLowerCase()

  return allContracts.filter((contract) => {
    const nameMatch = contract.contractData.name
      ?.toLowerCase()
      .includes(lowercaseQuery)
    const addressMatch = contract.contractData.address
      ?.toLowerCase()
      .includes(lowercaseQuery)
    const titleMatch = contract.metadata.title
      ?.toLowerCase()
      .includes(lowercaseQuery)
    const tagsMatch = contract.metadata.tags?.some((tag) =>
      tag.toLowerCase().includes(lowercaseQuery),
    )
    const descriptionMatch = contract.metadata.description
      ?.toLowerCase()
      .includes(lowercaseQuery)

    return (
      nameMatch || addressMatch || titleMatch || tagsMatch || descriptionMatch
    )
  })
}

/**
 * Get contracts by status
 */
export function getContractsByStatus(
  status: StoredContract['status'],
): StoredContract[] {
  const allContracts = retrieveAllContracts()
  return allContracts.filter((contract) => contract.status === status)
}

/**
 * Get contracts by tag
 */
export function getContractsByTag(tag: string): StoredContract[] {
  const allContracts = retrieveAllContracts()
  return allContracts.filter((contract) =>
    contract.metadata.tags?.includes(tag),
  )
}

/**
 * Update contract metadata
 */
export function updateContractMetadata(
  id: string,
  metadata: Partial<StoredContract['metadata']>,
): boolean {
  try {
    const existing = retrieveAllContracts()
    const index = existing.findIndex((contract) => contract.id === id)

    if (index === -1) return false

    existing[index].metadata = { ...existing[index].metadata, ...metadata }
    existing[index].timestamp = new Date() // Update timestamp

    // Serialize and store updated list
    const serialized: SerializedStoredContract[] = existing.map((contract) => ({
      ...contract,
      timestamp: contract.timestamp.toISOString(),
    }))

    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized))
    return true
  } catch (_error) {
    return false
  }
}

/**
 * Clear all stored contracts
 */
export function clearAllContracts(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (_error) {
    // Fail silently
  }
}

/**
 * Get storage statistics
 */
export function getContractStats(): {
  total: number
  today: number
  byStatus: Record<StoredContract['status'], number>
  bySource: Record<string, number>
} {
  const contracts = retrieveAllContracts()
  const today = new Date().toDateString()

  const byStatus: Record<StoredContract['status'], number> = {
    imported: 0,
    modified: 0,
    compiled: 0,
    error: 0,
  }

  const bySource: Record<string, number> = {}

  for (const contract of contracts) {
    byStatus[contract.status]++

    const source = contract.metadata.explorerSource || 'unknown'
    bySource[source] = (bySource[source] || 0) + 1
  }

  return {
    total: contracts.length,
    today: contracts.filter((c) => c.timestamp.toDateString() === today).length,
    byStatus,
    bySource,
  }
}

/**
 * Export contract data for backup/sharing
 */
export function exportContract(id: string): string | null {
  const contract = retrieveContractById(id)
  if (!contract) return null

  try {
    const exportData = {
      ...contract,
      metadata: {
        ...contract.metadata,
        exportedAt: new Date().toISOString(),
        version: '1.0',
      },
    }

    return JSON.stringify(exportData, null, 2)
  } catch (_error) {
    return null
  }
}

/**
 * Import contract data from backup
 */
export function importContract(data: string): boolean {
  try {
    const importData = JSON.parse(data)

    // Validate the imported data structure
    if (
      !importData.id ||
      !importData.contractData ||
      !importData.contractData.abi
    ) {
      throw new Error('Invalid contract data format')
    }

    const contract: StoredContract = {
      id: importData.id,
      timestamp: new Date(importData.timestamp || new Date().toISOString()),
      contractData: importData.contractData,
      metadata: importData.metadata || {},
      status: importData.status || 'imported',
    }

    // Store the imported contract
    const existing = retrieveAllContracts()

    // Check if contract already exists
    const existingIndex = existing.findIndex((c) => c.id === contract.id)
    if (existingIndex !== -1) {
      // Update existing contract
      existing[existingIndex] = contract
    } else {
      // Add new contract
      existing.unshift(contract)
    }

    const serialized: SerializedStoredContract[] = existing
      .slice(0, MAX_STORED_CONTRACTS)
      .map((c) => ({
        ...c,
        timestamp: c.timestamp.toISOString(),
      }))

    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized))
    return true
  } catch (_error) {
    return false
  }
}

/**
 * Check if a contract with the given address already exists
 */
export function hasContractWithAddress(
  address: Address,
): StoredContract | null {
  const contracts = retrieveAllContracts()
  return (
    contracts.find(
      (c) => c.contractData.address?.toLowerCase() === address.toLowerCase(),
    ) || null
  )
}

/**
 * Get unique tags from all contracts
 */
export function getAllTags(): string[] {
  const contracts = retrieveAllContracts()
  const tags = new Set<string>()

  for (const contract of contracts) {
    if (contract.metadata.tags) {
      for (const tag of contract.metadata.tags) {
        tags.add(tag)
      }
    }
  }

  return Array.from(tags).sort()
}
