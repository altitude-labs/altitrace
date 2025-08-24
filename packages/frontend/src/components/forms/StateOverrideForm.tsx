'use client'

import type { StateOverride } from '@altitrace/sdk/types'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  PlusIcon,
  TrashIcon,
  UserIcon,
  WalletIcon,
} from 'lucide-react'
import { useState } from 'react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Textarea,
} from '@/components/ui'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import {
  ValidationError,
  validateAddress,
  validateOptionalHex,
  hexToDecimal,
  isHexFormat,
  validateOptionalData,
} from '@/utils/validation'

interface StateOverrideFormProps {
  stateOverrides: StateOverride[]
  onChange: (stateOverrides: StateOverride[]) => void
  compact?: boolean
}

type OverrideType = 'balance' | 'nonce' | 'code' | 'storage'

interface OverrideConfig {
  type: OverrideType
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const overrideConfigs: OverrideConfig[] = [
  {
    type: 'balance',
    label: 'Balance',
    description: 'Override account ETH balance',
    icon: WalletIcon,
  },
  {
    type: 'nonce',
    label: 'Nonce',
    description: 'Override account nonce',
    icon: UserIcon,
  },
  {
    type: 'code',
    label: 'Code',
    description: 'Replace contract bytecode',
    icon: CopyIcon,
  },
  {
    type: 'storage',
    label: 'Storage',
    description: 'Modify contract storage slots',
    icon: ({ className }) => (
      <div className={`text-center ${className}`}>🗄️</div>
    ),
  },
]

interface StorageSlot {
  slot: string
  value: string
}

export function StateOverrideForm({
  stateOverrides,
  onChange,
  compact = false,
}: StateOverrideFormProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { copyToClipboard } = useCopyToClipboard()

  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const validateAndSetError = (
    field: string,
    validator: () => void,
  ): boolean => {
    try {
      validator()
      clearError(field)
      return true
    } catch (error) {
      if (error instanceof ValidationError) {
        setErrors((prev) => ({ ...prev, [field]: error.message }))
      }
      return false
    }
  }

  const addStateOverride = () => {
    const newOverride: StateOverride = {
      address: '',
    }
    onChange([...stateOverrides, newOverride])
  }

  const removeStateOverride = (index: number) => {
    const updated = stateOverrides.filter((_, i) => i !== index)
    onChange(updated)
  }

  const updateStateOverride = (
    index: number,
    updates: Partial<StateOverride>,
  ) => {
    const updated = stateOverrides.map((override, i) =>
      i === index ? { ...override, ...updates } : override,
    )
    onChange(updated)
  }

  const addStorageSlot = (overrideIndex: number) => {
    const override = stateOverrides[overrideIndex]
    const currentSlots = override.state || []
    const newSlots = [...currentSlots, { slot: '', value: '' }]
    updateStateOverride(overrideIndex, { state: newSlots })
  }

  const updateStorageSlot = (
    overrideIndex: number,
    slotIndex: number,
    updates: Partial<StorageSlot>,
  ) => {
    const override = stateOverrides[overrideIndex]
    const currentSlots = override.state || []
    const updatedSlots = currentSlots.map((slot, i) =>
      i === slotIndex ? { ...slot, ...updates } : slot,
    )
    updateStateOverride(overrideIndex, { state: updatedSlots })
  }

  const removeStorageSlot = (overrideIndex: number, slotIndex: number) => {
    const override = stateOverrides[overrideIndex]
    const currentSlots = override.state || []
    const updatedSlots = currentSlots.filter((_, i) => i !== slotIndex)
    updateStateOverride(overrideIndex, { state: updatedSlots })
  }

  const getPresetTemplates = () => [
    {
      label: 'Rich Account',
      description: 'Account with 1000 ETH balance',
      create: (): StateOverride => ({
        address: '',
        balance: '1000000000000000000000', // 1000 ETH in wei (decimal)
      }),
    },
    {
      label: 'Empty Contract',
      description: 'Replace contract with empty bytecode',
      create: (): StateOverride => ({
        address: '',
        code: '0x',
      }),
    },
    {
      label: 'High Nonce',
      description: 'Account with nonce set to 100',
      create: (): StateOverride => ({
        address: '',
        nonce: 100,
      }),
    },
  ]

  const hasStateOverrides = stateOverrides.length > 0

  // Mobile: Collapsible section
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
              <UserIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-sm sm:text-base font-medium">
                State Overrides
              </span>
              {hasStateOverrides && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {stateOverrides.length}
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
            <StateOverrideContent
              stateOverrides={stateOverrides}
              onChange={onChange}
              errors={errors}
              onAddOverride={addStateOverride}
              onRemoveOverride={removeStateOverride}
              onUpdateOverride={updateStateOverride}
              onAddStorageSlot={addStorageSlot}
              onUpdateStorageSlot={updateStorageSlot}
              onRemoveStorageSlot={removeStorageSlot}
              onClearError={clearError}
              onValidateAndSetError={validateAndSetError}
              presetTemplates={getPresetTemplates()}
              copyToClipboard={copyToClipboard}
              compact
            />
          </CardContent>
        )}
      </Card>
    )
  }

  // Desktop: Always expanded
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            State Overrides
            {hasStateOverrides && (
              <Badge variant="secondary">{stateOverrides.length}</Badge>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addStateOverride}
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Override
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <StateOverrideContent
          stateOverrides={stateOverrides}
          onChange={onChange}
          errors={errors}
          onAddOverride={addStateOverride}
          onRemoveOverride={removeStateOverride}
          onUpdateOverride={updateStateOverride}
          onAddStorageSlot={addStorageSlot}
          onUpdateStorageSlot={updateStorageSlot}
          onRemoveStorageSlot={removeStorageSlot}
          onClearError={clearError}
          onValidateAndSetError={validateAndSetError}
          presetTemplates={getPresetTemplates()}
          copyToClipboard={copyToClipboard}
          compact={false}
        />
      </CardContent>
    </Card>
  )
}

interface StateOverrideContentProps {
  stateOverrides: StateOverride[]
  onChange: (stateOverrides: StateOverride[]) => void
  errors: Record<string, string>
  onAddOverride: () => void
  onRemoveOverride: (index: number) => void
  onUpdateOverride: (index: number, updates: Partial<StateOverride>) => void
  onAddStorageSlot: (overrideIndex: number) => void
  onUpdateStorageSlot: (
    overrideIndex: number,
    slotIndex: number,
    updates: Partial<StorageSlot>,
  ) => void
  onRemoveStorageSlot: (overrideIndex: number, slotIndex: number) => void
  onClearError: (field: string) => void
  onValidateAndSetError: (field: string, validator: () => void) => boolean
  presetTemplates: Array<{
    label: string
    description: string
    create: () => StateOverride
  }>
  copyToClipboard: (text: string) => Promise<void>
  compact: boolean
}

function StateOverrideContent({
  stateOverrides,
  onAddOverride,
  onRemoveOverride,
  onUpdateOverride,
  onAddStorageSlot,
  onUpdateStorageSlot,
  onRemoveStorageSlot,
  onClearError,
  onValidateAndSetError,
  presetTemplates,
  copyToClipboard,
  compact,
  errors,
}: StateOverrideContentProps) {
  const [selectedTemplate, setSelectedTemplate] = useState('')

  const addFromTemplate = () => {
    if (!selectedTemplate) return

    const template = presetTemplates.find((t) => t.label === selectedTemplate)
    if (!template) return

    const newOverride = template.create()
    onAddOverride()
    // Add the template override
    const newOverrides = [...stateOverrides, newOverride]
    // This would need to be handled by parent component
    setSelectedTemplate('')
  }

  return (
    <div className="space-y-4">
      {/* No overrides state */}
      {stateOverrides.length === 0 && (
        <div className="text-center py-8 space-y-4">
          <div className="text-4xl">⚙️</div>
          <div>
            <h3 className="font-medium">No State Overrides</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add state overrides to modify account balances, nonces, contract
              code, or storage slots during simulation
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
              onChange={(e) => setSelectedTemplate(e.target.value)}
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
                onClick={addFromTemplate}
                disabled={!selectedTemplate}
                className="flex-1"
              >
                Apply Template
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAddOverride}
                className="flex-1"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                <span className={compact ? 'text-xs' : ''}>
                  Custom Override
                </span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* State overrides list */}
      {stateOverrides.map((override, index) => (
        <StateOverrideCard
          key={index}
          override={override}
          index={index}
          onUpdate={(updates) => onUpdateOverride(index, updates)}
          onRemove={() => onRemoveOverride(index)}
          onAddStorageSlot={() => onAddStorageSlot(index)}
          onUpdateStorageSlot={(slotIndex, updates) =>
            onUpdateStorageSlot(index, slotIndex, updates)
          }
          onRemoveStorageSlot={(slotIndex) =>
            onRemoveStorageSlot(index, slotIndex)
          }
          onClearError={onClearError}
          onValidateAndSetError={onValidateAndSetError}
          copyToClipboard={copyToClipboard}
          compact={compact}
          errors={errors}
        />
      ))}

      {/* Add button for mobile when expanded */}
      {compact && stateOverrides.length > 0 && (
        <Button
          type="button"
          variant="outline"
          onClick={onAddOverride}
          className="w-full"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Another Override
        </Button>
      )}
    </div>
  )
}

interface StateOverrideCardProps {
  override: StateOverride
  index: number
  onUpdate: (updates: Partial<StateOverride>) => void
  onRemove: () => void
  onAddStorageSlot: () => void
  onUpdateStorageSlot: (
    slotIndex: number,
    updates: Partial<StorageSlot>,
  ) => void
  onRemoveStorageSlot: (slotIndex: number) => void
  onClearError: (field: string) => void
  onValidateAndSetError: (field: string, validator: () => void) => boolean
  copyToClipboard: (text: string) => Promise<void>
  compact: boolean
  errors: Record<string, string>
}

function StateOverrideCard({
  override,
  index,
  onUpdate,
  onRemove,
  onAddStorageSlot,
  onUpdateStorageSlot,
  onRemoveStorageSlot,
  onClearError,
  onValidateAndSetError,
  copyToClipboard,
  compact,
  errors,
}: StateOverrideCardProps) {
  const [activeOverrideTypes, setActiveOverrideTypes] = useState<
    Set<OverrideType>
  >(
    new Set(
      Object.entries(override)
        .filter(([key, value]) => key !== 'address' && value != null)
        .map(([key]) => key as OverrideType),
    ),
  )

  const toggleOverrideType = (type: OverrideType) => {
    const newTypes = new Set(activeOverrideTypes)
    if (newTypes.has(type)) {
      newTypes.delete(type)
      // Clear the corresponding field in the override
      const updates: Partial<StateOverride> = {}
      if (type === 'balance') updates.balance = null
      if (type === 'nonce') updates.nonce = null
      if (type === 'code') updates.code = null
      if (type === 'storage') updates.state = null
      onUpdate(updates)
    } else {
      newTypes.add(type)
      // Initialize the field with default values (use decimal format for balance)
      const updates: Partial<StateOverride> = {}
      if (type === 'balance') updates.balance = '0' // Use decimal format for display
      if (type === 'nonce') updates.nonce = 0
      if (type === 'code') updates.code = '0x'
      if (type === 'storage') updates.state = []
      onUpdate(updates)
    }
    setActiveOverrideTypes(newTypes)
  }

  const fieldKey = (field: string) => `override-${index}-${field}`

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3 px-4 sm:px-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Account Override #{index + 1}
          </CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-4 sm:px-6">
        {/* Address field */}
        <Input
          label="Address"
          placeholder="0x..."
          value={override.address || ''}
          onChange={(e) => {
            onUpdate({ address: e.target.value })
            onClearError(fieldKey('address'))
          }}
          onBlur={() =>
            override.address &&
            onValidateAndSetError(fieldKey('address'), () =>
              validateAddress(override.address!, 'address'),
            )
          }
          error={errors[fieldKey('address')]}
          required
          className="font-mono text-sm"
        />

        {/* Override type selection */}
        <div>
          <label className="text-sm font-medium mb-3 block">
            Override Types
          </label>
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {overrideConfigs.map((config) => (
              <button
                key={config.type}
                type="button"
                onClick={() => toggleOverrideType(config.type)}
                className={`p-3 sm:p-4 rounded-lg border transition-all text-left min-h-[80px] ${
                  activeOverrideTypes.has(config.type)
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <config.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium text-sm leading-tight">
                    {config.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-tight">
                  {config.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Override type fields */}
        {activeOverrideTypes.has('balance') && (
          <Input
            label="Balance (wei)"
            placeholder="1000000000000000000"
            value={override.balance || ''}
            onChange={(e) => {
              onUpdate({ balance: e.target.value })
              onClearError(fieldKey('balance'))
            }}
            onBlur={() =>
              override.balance &&
              onValidateAndSetError(fieldKey('balance'), () =>
                validateOptionalData(override.balance!, 'balance'),
              )
            }
            error={errors[fieldKey('balance')]}
            className="font-mono text-sm"
          />
        )}

        {activeOverrideTypes.has('nonce') && (
          <Input
            label="Nonce"
            type="number"
            placeholder="0"
            value={override.nonce?.toString() || ''}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 0
              onUpdate({ nonce: value })
            }}
            description="Account nonce for transaction ordering"
          />
        )}

        {activeOverrideTypes.has('code') && (
          <div>
            <label className="text-sm font-medium">Contract Code</label>
            <Textarea
              placeholder="0x..."
              value={override.code || ''}
              onChange={(e) => {
                onUpdate({ code: e.target.value })
                onClearError(fieldKey('code'))
              }}
              onBlur={() =>
                override.code &&
                onValidateAndSetError(fieldKey('code'), () =>
                  validateOptionalHex(override.code!, 'code'),
                )
              }
              error={errors[fieldKey('code')]}
              className="font-mono text-sm resize-none"
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Contract bytecode in hex format (use 0x for empty contract)
            </p>
          </div>
        )}

        {activeOverrideTypes.has('storage') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Storage Slots</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAddStorageSlot}
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Add Slot
              </Button>
            </div>

            {override.state?.map((slot, slotIndex) => (
              <div
                key={slotIndex}
                className="border rounded-lg p-3 sm:p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Slot #{slotIndex + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveStorageSlot(slotIndex)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="Slot"
                    placeholder="0x"
                    value={slot.slot}
                    onChange={(e) =>
                      onUpdateStorageSlot(slotIndex, { slot: e.target.value })
                    }
                    description="Storage slot key"
                    className="font-mono text-sm"
                  />

                  <Input
                    label="Value"
                    placeholder="0x"
                    value={slot.value}
                    onChange={(e) =>
                      onUpdateStorageSlot(slotIndex, { value: e.target.value })
                    }
                    description="Storage slot value"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            ))}

            {(!override.state || override.state.length === 0) && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No storage slots defined. Click "Add Slot" to add storage
                overrides.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
