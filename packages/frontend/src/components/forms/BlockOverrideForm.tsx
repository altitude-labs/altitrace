/**
 * @fileoverview Block Override Form Component
 * Provides UI for configuring block-level overrides for simulations
 */

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import {
  BoxIcon,
  PlusIcon,
  TrashIcon,
  ClockIcon,
  ZapIcon,
  UserIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from 'lucide-react'
import {
  createBigBlockOverride,
  BLOCK_SIZE_THRESHOLDS,
} from '@/utils/block-utils'
import type { BlockOverrides } from '@altitrace/sdk/types'
import { BlockOverrideField } from './BlockOverrideField'

interface BlockOverrideFormProps {
  blockOverrides: BlockOverrides | null
  onChange: (overrides: BlockOverrides | null) => void
  compact?: boolean
}

interface PresetTemplate {
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  create: () => BlockOverrides
}

const presetTemplates: PresetTemplate[] = [
  {
    label: 'Transform into Big Block',
    description: 'Set gas limit to 50M for big block architecture',
    icon: BoxIcon,
    create: createBigBlockOverride,
  },
  {
    label: 'Transform into Small Block',
    description: 'Set gas limit to 2M for small block architecture',
    icon: BoxIcon,
    create: () => ({ gasLimit: BLOCK_SIZE_THRESHOLDS.SMALL_BLOCK_GAS_LIMIT }),
  },
  {
    label: 'Fast Forward Time',
    description: 'Advance block timestamp by 1 hour',
    icon: ClockIcon,
    create: () => ({ time: Math.floor(Date.now() / 1000) + 3600 }),
  },
]

export function BlockOverrideForm({
  blockOverrides,
  onChange,
  compact = false,
}: BlockOverrideFormProps) {
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  const hasOverrides = blockOverrides && Object.keys(blockOverrides).length > 0
  const overrideCount = blockOverrides ? Object.keys(blockOverrides).length : 0

  const addFromTemplate = useCallback(() => {
    if (!selectedTemplate) return

    const template = presetTemplates.find((t) => t.label === selectedTemplate)
    if (!template) return

    const newOverrides = template.create()
    onChange(newOverrides)
    setSelectedTemplate('')
  }, [selectedTemplate, onChange])

  const addCustom = useCallback(() => {
    // Create an empty block override to start with
    onChange({})
  }, [onChange])

  const updateOverride = useCallback(
    (field: keyof BlockOverrides, value: any) => {
      const current = blockOverrides || {}
      const updated = { ...current, [field]: value }

      // Remove fields with empty values
      if (!value && value !== 0) {
        delete updated[field]
      }

      // If no overrides left, set to null
      onChange(Object.keys(updated).length === 0 ? null : updated)
    },
    [blockOverrides, onChange],
  )

  const clearOverrides = useCallback(() => {
    onChange(null)
  }, [onChange])

  // Mobile: Collapsible section (harmonized with StateOverrideForm)
  if (compact) {
    return (
      <Card>
        <CardHeader className="py-3 px-4">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-between w-full text-left"
          >
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <BoxIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-sm sm:text-base font-medium">
                Block Overrides
              </span>
              {hasOverrides && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {overrideCount}
                </Badge>
              )}
            </CardTitle>
            {isExpanded ? (
              <ChevronDownIcon className="h-4 w-4 flex-shrink-0" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 flex-shrink-0" />
            )}
          </button>
        </CardHeader>

        {isExpanded && (
          <CardContent className="pt-2 px-4 pb-4">
            <BlockOverrideContent
              blockOverrides={blockOverrides}
              onChange={onChange}
              onUpdateOverride={updateOverride}
              onClearOverrides={clearOverrides}
              presetTemplates={presetTemplates}
              selectedTemplate={selectedTemplate}
              onTemplateChange={setSelectedTemplate}
              onAddFromTemplate={addFromTemplate}
              onAddCustom={addCustom}
              compact={true}
            />
          </CardContent>
        )}
      </Card>
    )
  }

  // Desktop: Always expanded (harmonized with StateOverrideForm)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BoxIcon className="h-5 w-5" />
            Block Overrides
            {hasOverrides && <Badge variant="secondary">{overrideCount}</Badge>}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addCustom}>
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Override
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <BlockOverrideContent
          blockOverrides={blockOverrides}
          onChange={onChange}
          onUpdateOverride={updateOverride}
          onClearOverrides={clearOverrides}
          presetTemplates={presetTemplates}
          selectedTemplate={selectedTemplate}
          onTemplateChange={setSelectedTemplate}
          onAddFromTemplate={addFromTemplate}
          onAddCustom={addCustom}
          compact={false}
        />
      </CardContent>
    </Card>
  )
}

interface BlockOverrideContentProps {
  blockOverrides: BlockOverrides | null
  onChange: (overrides: BlockOverrides | null) => void
  onUpdateOverride: (field: keyof BlockOverrides, value: any) => void
  onClearOverrides: () => void
  presetTemplates: PresetTemplate[]
  selectedTemplate: string
  onTemplateChange: (template: string) => void
  onAddFromTemplate: () => void
  onAddCustom: () => void
  compact: boolean
}

function BlockOverrideContent({
  blockOverrides,
  onUpdateOverride,
  onClearOverrides,
  presetTemplates,
  selectedTemplate,
  onTemplateChange,
  onAddFromTemplate,
  onAddCustom,
  compact,
}: BlockOverrideContentProps) {
  const hasOverrides = blockOverrides && Object.keys(blockOverrides).length > 0

  if (!hasOverrides) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="text-4xl">⚙️</div>
        <div>
          <h3 className="font-medium">No Block Overrides</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add block overrides to modify block parameters like gas limit,
            timestamp, or block number during simulation
          </p>
        </div>

        {/* Preset templates */}
        <div className="flex flex-col gap-3 items-stretch">
          <Select
            options={[
              { value: '', label: 'Choose preset...' },
              ...presetTemplates.map((template) => ({
                value: template.label,
                label: template.label,
              })),
            ]}
            value={selectedTemplate}
            onChange={(e) => onTemplateChange(e.target.value)}
            placeholder="Choose preset..."
            className="w-full"
          />
          <div
            className={`flex gap-2 ${compact ? 'flex-col' : 'flex-col sm:flex-row'}`}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddFromTemplate}
              disabled={!selectedTemplate}
              className="flex-1"
            >
              Apply Preset
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddCustom}
              className="flex-1"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Custom Override
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const addField = useCallback(
    (field: keyof BlockOverrides) => {
      onUpdateOverride(
        field,
        field === 'gasLimit'
          ? 30000000
          : field === 'time'
            ? Math.floor(Date.now() / 1000)
            : '',
      )
    },
    [onUpdateOverride],
  )

  const removeField = useCallback(
    (field: keyof BlockOverrides) => {
      onUpdateOverride(field, null)
    },
    [onUpdateOverride],
  )

  const allFields: Array<{ key: keyof BlockOverrides; label: string }> = [
    { key: 'gasLimit', label: 'Gas Limit' },
    { key: 'number', label: 'Block Number' },
    { key: 'time', label: 'Timestamp' },
    { key: 'baseFee', label: 'Base Fee' },
    { key: 'coinbase', label: 'Coinbase' },
    { key: 'difficulty', label: 'Difficulty' },
    { key: 'random', label: 'PrevRandao' },
    { key: 'blockHash', label: 'Block Hash Mappings' },
  ]

  const availableFields = allFields.filter(
    (field) => !blockOverrides?.hasOwnProperty(field.key),
  )

  return (
    <div className="space-y-4">
      {/* Add Field Dropdown */}
      {availableFields.length > 0 && (
        <div className="flex items-center gap-2">
          <Select
            options={[
              { value: '', label: 'Add field...' },
              ...availableFields.map((field) => ({
                value: field.key,
                label: field.label,
              })),
            ]}
            value=""
            onChange={(e) => {
              if (e.target.value) {
                addField(e.target.value as keyof BlockOverrides)
              }
            }}
            className="flex-1"
          />
        </div>
      )}

      {/* Current Override Fields */}
      {blockOverrides &&
        Object.entries(blockOverrides).map(([field, value]) => (
          <BlockOverrideField
            key={field}
            field={field as keyof BlockOverrides}
            value={value}
            onUpdate={onUpdateOverride}
            onRemove={removeField}
            compact={compact}
          />
        ))}

      {/* Legacy Grid Layout (keeping for backwards compatibility) */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
        style={{ display: 'none' }}
      >
        {/* Gas Limit */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Gas Limit
          </label>
          <Input
            type="number"
            placeholder="e.g., 50000000"
            value={blockOverrides?.gasLimit || ''}
            onChange={(e) =>
              onUpdateOverride(
                'gasLimit',
                e.target.value ? parseInt(e.target.value, 10) : null,
              )
            }
            className="mt-1 font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Override block gas limit (50M for big blocks, 2M for small blocks)
          </p>
        </div>

        {/* Block Number */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Block Number
          </label>
          <Input
            type="text"
            placeholder="e.g., 0x1234567 or 19088743"
            value={blockOverrides?.number || ''}
            onChange={(e) => onUpdateOverride('number', e.target.value || null)}
            className="mt-1 font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Override block number (hex or decimal)
          </p>
        </div>

        {/* Timestamp */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Timestamp
          </label>
          <Input
            type="number"
            placeholder="e.g., 1700000000"
            value={blockOverrides?.time || ''}
            onChange={(e) =>
              onUpdateOverride(
                'time',
                e.target.value ? parseInt(e.target.value, 10) : null,
              )
            }
            className="mt-1 font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Unix timestamp in seconds
          </p>
        </div>

        {/* Base Fee */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Base Fee
          </label>
          <Input
            type="text"
            placeholder="e.g., 0x3b9aca00"
            value={blockOverrides?.baseFee || ''}
            onChange={(e) =>
              onUpdateOverride('baseFee', e.target.value || null)
            }
            className="mt-1 font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Base fee per gas (EIP-1559) in hex
          </p>
        </div>

        {/* Coinbase */}
        <div className="md:col-span-2">
          <label className="text-sm font-medium text-muted-foreground">
            Coinbase (Fee Recipient)
          </label>
          <Input
            type="text"
            placeholder="e.g., 0x0000000000000000000000000000000000000000"
            value={blockOverrides?.coinbase || ''}
            onChange={(e) =>
              onUpdateOverride('coinbase', e.target.value || null)
            }
            className="mt-1 font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Block miner/fee recipient address
          </p>
        </div>
      </div>

      {/* Clear button for compact view */}
      {compact && (
        <div className="pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClearOverrides}
            className="w-full"
          >
            Clear All Overrides
          </Button>
        </div>
      )}
    </div>
  )
}
