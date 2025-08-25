/**
 * @fileoverview Individual Block Override Field Component
 * Provides a reusable field component for block overrides with validation and help text
 */

import { useState, useCallback } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { TrashIcon, InfoIcon } from 'lucide-react'
import type { BlockOverrides } from '@altitrace/sdk/types'

interface BlockOverrideFieldProps {
  field: keyof BlockOverrides
  value: BlockOverrides[keyof BlockOverrides]
  onUpdate: (field: keyof BlockOverrides, value: any) => void
  onRemove: (field: keyof BlockOverrides) => void
  compact?: boolean
  hideRemoveButton?: boolean
}

interface FieldConfig {
  label: string
  placeholder: string
  description: string
  type: 'text' | 'number'
  validation?: (value: string) => string | null
}

const fieldConfigs: Record<keyof BlockOverrides, FieldConfig> = {
  gasLimit: {
    label: 'Gas Limit',
    placeholder: 'e.g., 50000000',
    description:
      'Override block gas limit (50M for big blocks, 2M for small blocks)',
    type: 'number',
    validation: (value) => {
      const num = parseInt(value, 10)
      if (isNaN(num) || num <= 0) return 'Must be a positive number'
      if (num > 100_000_000) return 'Gas limit seems unusually high'
      return null
    },
  },
  number: {
    label: 'Block Number',
    placeholder: 'e.g., 0x1234567 or 19088743',
    description: 'Override block number (hex or decimal)',
    type: 'text',
    validation: (value) => {
      if (value.startsWith('0x')) {
        const hex = value.slice(2)
        if (!/^[a-fA-F0-9]+$/.test(hex)) return 'Invalid hex format'
      } else {
        const num = parseInt(value, 10)
        if (isNaN(num) || num < 0)
          return 'Must be a positive number or valid hex'
      }
      return null
    },
  },
  time: {
    label: 'Timestamp',
    placeholder: 'e.g., 1700000000',
    description: 'Unix timestamp in seconds',
    type: 'number',
    validation: (value) => {
      const num = parseInt(value, 10)
      if (isNaN(num) || num <= 0) return 'Must be a positive timestamp'
      const date = new Date(num * 1000)
      if (date.getFullYear() < 2020 || date.getFullYear() > 2100) {
        return 'Timestamp seems out of reasonable range'
      }
      return null
    },
  },
  baseFee: {
    label: 'Base Fee',
    placeholder: 'e.g., 0x3b9aca00',
    description: 'Base fee per gas (EIP-1559) in hex',
    type: 'text',
    validation: (value) => {
      if (!value.startsWith('0x'))
        return 'Base fee must be in hex format (e.g., 0x3b9aca00)'
      const hex = value.slice(2)
      if (!/^[a-fA-F0-9]+$/.test(hex)) return 'Invalid hex format'
      return null
    },
  },
  coinbase: {
    label: 'Coinbase (Fee Recipient)',
    placeholder: 'e.g., 0x0000000000000000000000000000000000000000',
    description: 'Block miner/fee recipient address',
    type: 'text',
    validation: (value) => {
      if (!value.match(/^0x[a-fA-F0-9]{40}$/))
        return 'Must be a valid Ethereum address'
      return null
    },
  },
  difficulty: {
    label: 'Difficulty',
    placeholder: 'e.g., 0x0',
    description: 'Block difficulty (pre-merge chains)',
    type: 'text',
    validation: (value) => {
      if (!value.startsWith('0x')) return 'Difficulty must be in hex format'
      const hex = value.slice(2)
      if (!/^[a-fA-F0-9]+$/.test(hex)) return 'Invalid hex format'
      return null
    },
  },
  random: {
    label: 'PrevRandao',
    placeholder: 'e.g., 0x1234567890abcdef...',
    description: 'PrevRandao value (post-merge chains)',
    type: 'text',
    validation: (value) => {
      if (!value.startsWith('0x')) return 'PrevRandao must be in hex format'
      const hex = value.slice(2)
      if (!/^[a-fA-F0-9]{64}$/.test(hex))
        return 'Must be a 64-character hex string (32 bytes)'
      return null
    },
  },
  blockHash: {
    label: 'Block Hash Mappings',
    placeholder: 'JSON object of block number to hash mappings',
    description: 'Custom block hash mappings for BLOCKHASH opcode',
    type: 'text',
    validation: (value) => {
      try {
        const parsed = JSON.parse(value)
        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
          return 'Must be a JSON object'
        }
        for (const [key, val] of Object.entries(parsed)) {
          if (!/^\d+$/.test(key)) return 'Keys must be block numbers'
          if (typeof val !== 'string' || !val.match(/^0x[a-fA-F0-9]{64}$/)) {
            return 'Values must be valid block hashes (0x + 64 hex chars)'
          }
        }
        return null
      } catch {
        return 'Must be valid JSON'
      }
    },
  },
}

export function BlockOverrideField({
  field,
  value,
  onUpdate,
  onRemove,
  compact = false,
  hideRemoveButton = false,
}: BlockOverrideFieldProps) {
  const [error, setError] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  const config = fieldConfigs[field]
  if (!config) return null

  const handleChange = useCallback(
    (newValue: string) => {
      // Clear error on change
      setError(null)

      // Convert value based on type
      let processedValue: any = newValue
      if (config.type === 'number' && newValue) {
        processedValue = parseInt(newValue, 10)
        if (isNaN(processedValue)) {
          setError('Invalid number format')
          return
        }
      }

      // Validate if validator exists
      if (config.validation && newValue) {
        const validationError = config.validation(newValue)
        if (validationError) {
          setError(validationError)
        }
      }

      onUpdate(field, processedValue || null)
    },
    [field, onUpdate, config],
  )

  const displayValue =
    typeof value === 'object' && value !== null
      ? JSON.stringify(value, null, 2)
      : value?.toString() || ''

  return (
    <div className={`space-y-2 p-3 border rounded-md ${compact ? 'p-2' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label
            className={`font-medium text-muted-foreground ${compact ? 'text-sm' : ''}`}
          >
            {config.label}
          </label>
          <Badge variant="outline" className="text-xs px-1">
            {field}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowHelp(!showHelp)}
            className="h-5 w-5 p-0"
          >
            <InfoIcon className="h-3 w-3" />
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemove(field)}
          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2"
        >
          <TrashIcon className="h-4 w-4" />
        </Button>
      </div>

      {showHelp && (
        <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          {config.description}
        </p>
      )}

      <div className="space-y-1">
        {field === 'blockHash' ? (
          <textarea
            className="w-full p-2 text-xs font-mono border rounded resize-vertical min-h-[100px] bg-background"
            placeholder={config.placeholder}
            value={displayValue}
            onChange={(e) => handleChange(e.target.value)}
          />
        ) : (
          <Input
            type={config.type}
            placeholder={config.placeholder}
            value={displayValue}
            onChange={(e) => handleChange(e.target.value)}
            className={`font-mono ${compact ? 'text-sm' : ''}`}
          />
        )}
        {error && (
          <p className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
