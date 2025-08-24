'use client'

import { RefreshCwIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui'

interface DecHexToggleProps {
  value: string
  className?: string
  label?: string
  showLabel?: boolean
}

/**
 * Reusable component for toggling between decimal and hexadecimal display
 */
export function DecHexToggle({
  value,
  className = '',
  label,
  showLabel = true,
}: DecHexToggleProps) {
  const [showHex, setShowHex] = useState(false) // Default to hex since most blockchain data is hex

  // Parse value and convert between formats
  const getDisplayValue = () => {
    if (!value || value === '0x' || value === '0x0') {
      return showHex ? '0x0' : '0'
    }

    try {
      if (showHex) {
        // If already hex, return as-is; if decimal, convert to hex
        if (value.startsWith('0x')) {
          return value
        }
        const bigIntValue = BigInt(value)
        return `0x${bigIntValue.toString(16)}`
      }
      // Convert to decimal
      if (value.startsWith('0x')) {
        const bigIntValue = BigInt(value)
        return bigIntValue.toString()
      }
      return value
    } catch {
      // If conversion fails, return original value
      return value
    }
  }

  const formatForDisplay = (val: string) => {
    if (!showHex && val.length > 15) {
      // Add commas to large decimal numbers for readability
      return Number.parseInt(val).toLocaleString()
    }
    return val
  }

  const displayValue = getDisplayValue()
  const formattedValue = formatForDisplay(displayValue)

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && label && (
        <span className="text-sm text-muted-foreground">{label}:</span>
      )}

      <div className="flex items-center gap-1">
        <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
          {formattedValue}
        </code>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowHex(!showHex)}
            className="group inline-flex items-center px-2 py-1 text-xs font-medium rounded-md 
                       transition-all duration-200 ease-in-out
                       bg-secondary/60 text-secondary-foreground 
                       hover:bg-secondary hover:scale-105 hover:shadow-sm
                       active:scale-95 active:bg-secondary/80 active:border-border/80 active:duration-75
                       border border-border/40 hover:border-border
                       focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1
                       transform-gpu"
            title={`Switch to ${showHex ? 'decimal' : 'hexadecimal'}`}
          >
            <span className="mr-1.5 transition-colors duration-200">
              {showHex ? 'Hex' : 'Dec'}
            </span>
            <RefreshCwIcon className="h-3 w-3 opacity-70 transition-all duration-200 group-hover:opacity-90 group-hover:rotate-180" />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Simplified version for inline display without toggle button
 */
export function DecHexDisplay({
  value,
  format = 'hex',
}: {
  value: string
  format?: 'hex' | 'dec'
}) {
  const getDisplayValue = () => {
    if (!value || value === '0x' || value === '0x0') {
      return format === 'hex' ? '0x0' : '0'
    }

    try {
      if (format === 'hex') {
        if (value.startsWith('0x')) {
          return value
        }
        const bigIntValue = BigInt(value)
        return `0x${bigIntValue.toString(16)}`
      }
      if (value.startsWith('0x')) {
        const bigIntValue = BigInt(value)
        return bigIntValue.toLocaleString()
      }
      return Number.parseInt(value).toLocaleString()
    } catch {
      return value
    }
  }

  return (
    <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
      {getDisplayValue()}
    </code>
  )
}
