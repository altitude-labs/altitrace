import type { StateOverride } from '@altitrace/sdk/types'
import { useCallback, useState } from 'react'
import {
  cleanStateOverride,
  STATE_OVERRIDE_PRESETS,
  validateStateOverride,
} from '@/utils/state-overrides'

interface UseStateOverridesReturn {
  stateOverrides: StateOverride[]
  setStateOverrides: (overrides: StateOverride[]) => void
  addStateOverride: (override?: Partial<StateOverride>) => void
  removeStateOverride: (index: number) => void
  updateStateOverride: (index: number, updates: Partial<StateOverride>) => void
  validateAllOverrides: () => {
    isValid: boolean
    errors: Record<number, string[]>
  }
  clearAllOverrides: () => void
  addFromPreset: (
    presetKey: keyof typeof STATE_OVERRIDE_PRESETS,
    address?: string,
  ) => void
  getCleanOverrides: () => StateOverride[]
  hasValidOverrides: boolean
}

/**
 * Hook for managing state overrides in forms
 */
export function useStateOverrides(
  initialOverrides: StateOverride[] = [],
): UseStateOverridesReturn {
  const [stateOverrides, setStateOverrides] =
    useState<StateOverride[]>(initialOverrides)

  const addStateOverride = useCallback(
    (override: Partial<StateOverride> = {}) => {
      const newOverride: StateOverride = {
        address: '',
        ...override,
      }
      setStateOverrides((prev) => [...prev, newOverride])
    },
    [],
  )

  const removeStateOverride = useCallback((index: number) => {
    setStateOverrides((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateStateOverride = useCallback(
    (index: number, updates: Partial<StateOverride>) => {
      setStateOverrides((prev) =>
        prev.map((override, i) =>
          i === index ? { ...override, ...updates } : override,
        ),
      )
    },
    [],
  )

  const validateAllOverrides = useCallback(() => {
    const errors: Record<number, string[]> = {}
    let isValid = true

    stateOverrides.forEach((override, index) => {
      const validation = validateStateOverride(override)
      if (!validation.isValid) {
        errors[index] = validation.errors
        isValid = false
      }
    })

    return { isValid, errors }
  }, [stateOverrides])

  const clearAllOverrides = useCallback(() => {
    setStateOverrides([])
  }, [])

  const addFromPreset = useCallback(
    (presetKey: keyof typeof STATE_OVERRIDE_PRESETS, address?: string) => {
      const preset = STATE_OVERRIDE_PRESETS[presetKey]

      let override: StateOverride
      switch (presetKey) {
        case 'customBalance':
          override = (preset as any)(address || '', 1) // Default to 1 ETH
          break
        case 'storageOverride':
          override = (preset as any)(address || '', []) // Default to empty storage
          break
        default:
          override = (preset as any)(address)
      }

      addStateOverride(override)
    },
    [addStateOverride],
  )

  const getCleanOverrides = useCallback(() => {
    return stateOverrides
      .filter((override) => override.address) // Only include overrides with addresses
      .map(cleanStateOverride)
      .filter((override) => {
        // Only include overrides that actually override something
        return (
          override.balance ||
          override.nonce !== null ||
          override.code ||
          (override.state && override.state.length > 0)
        )
      })
  }, [stateOverrides])

  const hasValidOverrides = getCleanOverrides().length > 0

  return {
    stateOverrides,
    setStateOverrides,
    addStateOverride,
    removeStateOverride,
    updateStateOverride,
    validateAllOverrides,
    clearAllOverrides,
    addFromPreset,
    getCleanOverrides,
    hasValidOverrides,
  }
}

/**
 * Hook for managing storage slots within a state override
 */
export function useStorageSlots(
  initialSlots: Array<{ slot: string; value: string }> = [],
) {
  const [slots, setSlots] = useState(initialSlots)

  const addSlot = useCallback(() => {
    setSlots((prev) => [...prev, { slot: '', value: '' }])
  }, [])

  const removeSlot = useCallback((index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateSlot = useCallback(
    (index: number, updates: Partial<{ slot: string; value: string }>) => {
      setSlots((prev) =>
        prev.map((slot, i) => (i === index ? { ...slot, ...updates } : slot)),
      )
    },
    [],
  )

  const clearSlots = useCallback(() => {
    setSlots([])
  }, [])

  return {
    slots,
    setSlots,
    addSlot,
    removeSlot,
    updateSlot,
    clearSlots,
  }
}
