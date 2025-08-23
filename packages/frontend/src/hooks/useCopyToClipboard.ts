'use client'

import { useState, useCallback, useRef } from 'react'

interface UseCopyToClipboardReturn {
  copied: boolean
  copyToClipboard: (text: string) => Promise<void>
}

interface UseMultipleCopyToClipboardReturn {
  getCopyState: (key: string) => boolean
  copyToClipboard: (key: string, text: string) => Promise<void>
}

/**
 * Hook for copying text to clipboard with visual feedback
 * Shows "copied" state for 2 seconds max
 */
export function useCopyToClipboard(): UseCopyToClipboardReturn {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      
      setTimeout(() => {
        setCopied(false)
      }, 1000)
    } catch {
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
      }, 2000)
    }
  }, [])

  return { copied, copyToClipboard }
}

/**
 * Hook for managing multiple independent copy states within the same component
 * Each copy button can have its own independent animation state
 */
export function useMultipleCopyToClipboard(): UseMultipleCopyToClipboardReturn {
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({})
  const timeoutRefs = useRef<Record<string, NodeJS.Timeout>>({})

  const getCopyState = useCallback((key: string) => {
    return copiedStates[key] || false
  }, [copiedStates])

  const copyToClipboard = useCallback(async (key: string, text: string) => {
    // Clear any existing timeout for this key
    if (timeoutRefs.current[key]) {
      clearTimeout(timeoutRefs.current[key])
    }

    try {
      await navigator.clipboard.writeText(text)
      setCopiedStates(prev => ({ ...prev, [key]: true }))
      
      timeoutRefs.current[key] = setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [key]: false }))
        delete timeoutRefs.current[key]
      }, 1000)
    } catch {
      setCopiedStates(prev => ({ ...prev, [key]: true }))
      timeoutRefs.current[key] = setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [key]: false }))
        delete timeoutRefs.current[key]
      }, 1000)
    }
  }, [])

  return { getCopyState, copyToClipboard }
}