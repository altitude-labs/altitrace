/**
 * @fileoverview Hook for managing block overrides in forms
 */

import { useState, useCallback, useEffect } from 'react'
import type { BlockOverrides } from '@altitrace/sdk/types'

interface UseBlockOverridesReturn {
  blockOverrides: BlockOverrides | null
  setBlockOverrides: (overrides: BlockOverrides | null) => void
  updateOverride: (field: keyof BlockOverrides, value: any) => void
  clearOverrides: () => void
  hasOverrides: boolean
  getCleanOverrides: () => BlockOverrides | null
}

/**
 * Hook for managing block overrides in forms
 */
export function useBlockOverrides(
  initialOverrides: BlockOverrides | null = null,
): UseBlockOverridesReturn {
  const [blockOverrides, setBlockOverrides] = useState<BlockOverrides | null>(
    initialOverrides,
  )

  // Update when initialOverrides changes (for replay functionality)
  useEffect(() => {
    if (initialOverrides) {
      setBlockOverrides(initialOverrides)
    }
  }, [initialOverrides])

  const updateOverride = useCallback(
    (field: keyof BlockOverrides, value: any) => {
      setBlockOverrides((current) => {
        const updated = { ...(current || {}), [field]: value }

        // Remove fields with empty/null values
        if (value === null || value === undefined || value === '') {
          delete updated[field]
        }

        // If no overrides left, return null
        return Object.keys(updated).length === 0 ? null : updated
      })
    },
    [],
  )

  const clearOverrides = useCallback(() => {
    setBlockOverrides(null)
  }, [])

  const getCleanOverrides = useCallback((): BlockOverrides | null => {
    if (!blockOverrides) return null

    const cleaned: BlockOverrides = {}

    // Only include non-empty values
    Object.entries(blockOverrides).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        ;(cleaned as any)[key] = value
      }
    })

    return Object.keys(cleaned).length > 0 ? cleaned : null
  }, [blockOverrides])

  const hasOverrides = !!(
    blockOverrides && Object.keys(blockOverrides).length > 0
  )

  return {
    blockOverrides,
    setBlockOverrides,
    updateOverride,
    clearOverrides,
    hasOverrides,
    getCleanOverrides,
  }
}
