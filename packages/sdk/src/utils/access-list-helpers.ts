/**
 * @fileoverview Access list utility functions for the Altitrace SDK
 */

import type { AccessList, AccessListItem } from '@sdk/types'

/**
 * Create an access list item for an account with storage slots.
 */
export function createAccessListItem(
  address: string,
  storageKeys: string[] = [],
): AccessListItem {
  return {
    address,
    storageKeys,
  }
}

/**
 * Create an access list from multiple accounts and their storage slots.
 */
export function createAccessList(
  items: Array<{ address: string; storageKeys?: string[] }>,
): AccessList {
  return items.map((item) =>
    createAccessListItem(item.address, item.storageKeys || []),
  )
}

/**
 * Merge multiple access lists into one, combining storage keys for duplicate addresses.
 */
export function mergeAccessLists(...accessLists: AccessList[]): AccessList {
  const accountMap = new Map<string, Set<string>>()

  // Collect all storage keys for each address
  for (const accessList of accessLists) {
    for (const item of accessList) {
      const address = item.address.toLowerCase()

      if (!accountMap.has(address)) {
        accountMap.set(address, new Set())
      }

      const storageKeys = accountMap.get(address)!
      for (const key of item.storageKeys) {
        storageKeys.add(key)
      }
    }
  }

  // Convert back to access list format
  return Array.from(accountMap.entries()).map(([address, storageKeys]) => ({
    address,
    storageKeys: Array.from(storageKeys),
  }))
}

/**
 * Check if an access list contains a specific address.
 */
export function hasAddress(accessList: AccessList, address: string): boolean {
  const normalizedAddress = address.toLowerCase()
  return accessList.some(
    (item) => item.address.toLowerCase() === normalizedAddress,
  )
}

/**
 * Get storage keys for a specific address from an access list.
 */
export function getStorageKeys(
  accessList: AccessList,
  address: string,
): string[] {
  const normalizedAddress = address.toLowerCase()
  const item = accessList.find(
    (item) => item.address.toLowerCase() === normalizedAddress,
  )
  return item ? [...item.storageKeys] : []
}

/**
 * Add a storage key to an existing access list for a specific address.
 * If the address doesn't exist, it will be added.
 */
export function addStorageKey(
  accessList: AccessList,
  address: string,
  storageKey: string,
): AccessList {
  const normalizedAddress = address.toLowerCase()
  const existingIndex = accessList.findIndex(
    (item) => item.address.toLowerCase() === normalizedAddress,
  )

  if (existingIndex >= 0) {
    // Address exists, add storage key if not already present
    const existingItem = accessList[existingIndex]
    if (existingItem && !existingItem.storageKeys.includes(storageKey)) {
      const updatedItem: AccessListItem = {
        address: existingItem.address,
        storageKeys: [...existingItem.storageKeys, storageKey],
      }
      return [
        ...accessList.slice(0, existingIndex),
        updatedItem,
        ...accessList.slice(existingIndex + 1),
      ]
    }
    return accessList
  }
  // Address doesn't exist, add new item
  return [...accessList, createAccessListItem(address, [storageKey])]
}

/**
 * Remove an address completely from an access list.
 */
export function removeAddress(
  accessList: AccessList,
  address: string,
): AccessList {
  const normalizedAddress = address.toLowerCase()
  return accessList.filter(
    (item) => item.address.toLowerCase() !== normalizedAddress,
  )
}

/**
 * Get statistics about an access list.
 */
export function getAccessListStats(accessList: AccessList) {
  const totalAccounts = accessList.length
  const totalStorageSlots = accessList.reduce(
    (sum, item) => sum + item.storageKeys.length,
    0,
  )
  const accountsWithStorageSlots = accessList.filter(
    (item) => item.storageKeys.length > 0,
  ).length
  const accountsWithoutStorageSlots = totalAccounts - accountsWithStorageSlots

  return {
    totalAccounts,
    totalStorageSlots,
    accountsWithStorageSlots,
    accountsWithoutStorageSlots,
    averageStorageSlotsPerAccount:
      totalAccounts > 0 ? totalStorageSlots / totalAccounts : 0,
  }
}

/**
 * Validate an access list format.
 */
export function validateAccessList(accessList: AccessList): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!Array.isArray(accessList)) {
    errors.push('Access list must be an array')
    return { isValid: false, errors }
  }

  for (let i = 0; i < accessList.length; i++) {
    const item = accessList[i]

    if (!item) {
      errors.push(`Item ${i}: is null or undefined`)
      continue
    }

    if (!item.address || typeof item.address !== 'string') {
      errors.push(`Item ${i}: address is required and must be a string`)
    } else if (!/^0x[a-fA-F0-9]{40}$/.test(item.address)) {
      errors.push(`Item ${i}: address must be a valid 20-byte hex string`)
    }

    if (!Array.isArray(item.storageKeys)) {
      errors.push(`Item ${i}: storageKeys must be an array`)
    } else {
      for (let j = 0; j < item.storageKeys.length; j++) {
        const key = item.storageKeys[j]
        if (typeof key !== 'string') {
          errors.push(`Item ${i}, storage key ${j}: must be a string`)
        } else if (!/^0x[a-fA-F0-9]{64}$/.test(key)) {
          errors.push(
            `Item ${i}, storage key ${j}: must be a valid 32-byte hex string`,
          )
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Pretty print an access list for debugging.
 */
export function printAccessList(accessList: AccessList): void {
  console.log('Access List:')

  if (accessList.length === 0) {
    console.log('  (empty)')
    return
  }

  for (let i = 0; i < accessList.length; i++) {
    const item = accessList[i]
    if (!item) {
      console.log(`  Account ${i + 1}: (null/undefined)`)
      continue
    }

    console.log(`  Account ${i + 1}: ${item.address}`)

    if (item.storageKeys.length === 0) {
      console.log('    No storage slots')
    } else {
      console.log(`    Storage slots (${item.storageKeys.length}):`)
      for (const key of item.storageKeys) {
        console.log(`      ${key}`)
      }
    }
  }

  const stats = getAccessListStats(accessList)
  console.log(
    `\\nStats: ${stats.totalAccounts} accounts, ${stats.totalStorageSlots} storage slots`,
  )
}
