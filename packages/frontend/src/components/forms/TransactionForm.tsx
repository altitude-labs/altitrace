'use client'

import type {
  Address,
  BlockTag,
  HexString as Hex,
  SimulationParams,
  SimulationRequest,
} from '@altitrace/sdk/types'
import { PlayIcon, SendIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
} from '@/components/ui'
import type { ParsedAbi } from '@/types/api'
import {
  ValidationError,
  validateAddress,
  validateOptionalHex,
  validateValue,
} from '@/utils/validation'

interface TransactionFormProps {
  onSubmit: (request: SimulationRequest) => void
  loading?: boolean
  abi?: ParsedAbi | null
  functionData?: {
    data: Hex
    functionName: string
    parameters: Record<string, string>
  } | null
  initialData?: Partial<FormData>
  compact?: boolean
}

interface FormData {
  to: string
  from: string
  data: string
  value: string
  gas: string
  blockTag: SimulationParams['blockTag']
  blockNumber: string
  validation: boolean
}

const initialFormData: FormData = {
  to: '',
  from: '',
  data: '',
  value: '0x0',
  gas: '',
  blockTag: 'latest',
  blockNumber: '',
  validation: true,
}

export function TransactionForm({
  onSubmit,
  loading,
  functionData,
  initialData,
  compact = false,
}: TransactionFormProps) {
  const [formData, setFormData] = useState<FormData>(() => ({
    ...initialFormData,
    ...initialData,
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [useBlockNumber, setUseBlockNumber] = useState(
    !!initialData?.blockNumber,
  )
  const [showAdvanced, setShowAdvanced] = useState(!compact)

  // Update data field when function data is generated
  useEffect(() => {
    if (functionData) {
      setFormData((prev) => ({
        ...prev,
        data: functionData.data,
      }))
    }
  }, [functionData])

  // Update form when initial data changes (for pre-filling)
  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({
        ...prev,
        ...initialData,
      }))
      setUseBlockNumber(!!initialData.blockNumber)
    }
  }, [initialData])

  const blockTagOptions = [
    { value: 'latest', label: 'Latest' },
    { value: 'earliest', label: 'Earliest' },
    { value: 'safe', label: 'Safe' },
    { value: 'finalized', label: 'Finalized' },
  ]

  const handleInputChange = (
    field: keyof FormData,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))

    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    let isValid = true

    try {
      // Validate required fields
      validateAddress(formData.to, 'to')
    } catch (error) {
      if (error instanceof ValidationError) {
        newErrors.to = error.message
        isValid = false
      }
    }

    try {
      if (formData.from) {
        validateAddress(formData.from, 'from')
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        newErrors.from = error.message
        isValid = false
      }
    }

    try {
      if (formData.data) {
        validateOptionalHex(formData.data, 'data')
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        newErrors.data = error.message
        isValid = false
      }
    }

    try {
      validateValue(formData.value, 'value')
    } catch (error) {
      if (error instanceof ValidationError) {
        newErrors.value = error.message
        isValid = false
      }
    }

    try {
      if (formData.gas) {
        validateOptionalHex(formData.gas, 'gas')
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        newErrors.gas = error.message
        isValid = false
      }
    }

    // Validate block number if used
    if (useBlockNumber && formData.blockNumber) {
      try {
        validateOptionalHex(formData.blockNumber, 'blockNumber')
      } catch (error) {
        if (error instanceof ValidationError) {
          newErrors.blockNumber = error.message
          isValid = false
        }
      }
    }

    setErrors(newErrors)
    return isValid
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    const request: SimulationRequest = {
      params: {
        calls: [
          {
            to: formData.to as Address,
            ...(formData.from && { from: formData.from as Address }),
            ...(formData.data && { data: formData.data as Hex }),
            ...(formData.value &&
              formData.value !== '0x0' && { value: formData.value as Hex }),
            ...(formData.gas && { gas: formData.gas as Hex }),
          },
        ],
        // Always set account for asset tracking (use 'from' if available, otherwise 'to')
        account: (formData.from || formData.to) as Address,
        ...(useBlockNumber && formData.blockNumber
          ? { blockNumber: formData.blockNumber }
          : { blockTag: formData.blockTag }),
        validation: formData.validation,
        // Auto-enable asset tracking for better UX
        traceAssetChanges: true,
        traceTransfers: true,
      },
    }

    onSubmit(request)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SendIcon className="h-5 w-5" />
          Transaction Builder
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form
          onSubmit={handleSubmit}
          className={compact ? 'space-y-3' : 'space-y-6'}
        >
          {/* Transaction Parameters */}
          <div className={compact ? 'space-y-2' : 'space-y-4'}>
            {!compact && (
              <h3 className="font-semibold text-lg">Transaction Parameters</h3>
            )}

            <Input
              label="To Address"
              placeholder="0x..."
              value={formData.to}
              onChange={(e) => handleInputChange('to', e.target.value)}
              error={errors.to}
              description={
                compact
                  ? undefined
                  : 'Contract or wallet address to send transaction to'
              }
              required
            />

            <Input
              label={compact ? 'From' : 'From Address (optional)'}
              placeholder="0x..."
              value={formData.from}
              onChange={(e) => handleInputChange('from', e.target.value)}
              error={errors.from}
              description={
                compact
                  ? undefined
                  : 'Address to simulate transaction from (account impersonation)'
              }
            />

            <Input
              label="Call Data"
              placeholder="0x..."
              value={formData.data}
              onChange={(e) => handleInputChange('data', e.target.value)}
              error={errors.data}
              description={
                compact
                  ? undefined
                  : functionData
                    ? `Generated from ${functionData.functionName}() function`
                    : 'Contract function call data (use ABI import for automatic generation)'
              }
              className="font-mono text-sm"
            />

            <Input
              label={compact ? 'Value' : 'Value (HYPE)'}
              placeholder="0x0"
              value={formData.value}
              onChange={(e) => handleInputChange('value', e.target.value)}
              error={errors.value}
              description={
                compact
                  ? undefined
                  : 'Amount of HYPE to send with transaction (in wei, hex format)'
              }
            />

            {showAdvanced && (
              <Input
                label={compact ? 'Gas' : 'Gas Limit (optional)'}
                placeholder="0x5208"
                value={formData.gas}
                onChange={(e) => handleInputChange('gas', e.target.value)}
                error={errors.gas}
                description={
                  compact
                    ? undefined
                    : 'Gas limit for transaction (will be estimated if not provided)'
                }
              />
            )}
          </div>

          {/* Block Parameters */}
          {showAdvanced && (
            <div className={compact ? 'space-y-2' : 'space-y-4'}>
              {!compact && (
                <h3 className="font-semibold text-lg">Block Parameters</h3>
              )}

              <div className="flex items-center space-x-2 mb-2">
                <input
                  type="checkbox"
                  id="useBlockNumber"
                  checked={useBlockNumber}
                  onChange={(e) => setUseBlockNumber(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="useBlockNumber" className="text-sm">
                  Use specific block number
                </label>
              </div>

              {useBlockNumber ? (
                <Input
                  label="Block Number"
                  placeholder="0x123abc"
                  value={formData.blockNumber}
                  onChange={(e) =>
                    handleInputChange('blockNumber', e.target.value)
                  }
                  error={errors.blockNumber}
                  description={
                    compact
                      ? undefined
                      : 'Specific block number in hex format (e.g., 0x123abc)'
                  }
                />
              ) : (
                <Select
                  options={blockTagOptions}
                  label="Block Tag"
                  value={formData.blockTag ?? 'latest'}
                  onChange={(e) =>
                    handleInputChange('blockTag', e.target.value as BlockTag)
                  }
                  description={
                    compact ? undefined : 'Which block to simulate against'
                  }
                />
              )}
            </div>
          )}

          {/* Simulation Options */}
          {showAdvanced && (
            <div className={compact ? 'space-y-2' : 'space-y-4'}>
              {!compact && (
                <h3 className="font-semibold text-lg">Simulation Options</h3>
              )}

              <div className={compact ? 'space-y-1' : 'space-y-3'}>
                <div className={compact ? 'space-y-1' : 'space-y-2'}>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="validation"
                      checked={formData.validation}
                      onChange={(e) =>
                        handleInputChange('validation', e.target.checked)
                      }
                      className="rounded"
                    />
                    <label htmlFor="validation" className="text-sm">
                      Full EVM Validation
                    </label>
                  </div>
                  {!compact && (
                    <p className="text-xs text-muted-foreground ml-6">
                      Perform full validation (gas limits, balances, etc.)
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Advanced Options Toggle */}
          {compact && (
            <div className="flex items-center justify-between py-2">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {showAdvanced ? '← Less options' : '+ More options'}
              </button>
              <span className="text-xs text-muted-foreground">
                Auto-tracing enabled
              </span>
            </div>
          )}

          {/* Auto-enabled Features Info */}
          {!compact && (
            <div className="bg-muted/50 p-4 rounded-lg">
              <h3 className="font-semibold text-sm mb-2">
                🔍 Auto-enabled Tracing Features
              </h3>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  • <strong>Asset Changes:</strong> ERC-20/ERC-721 token balance
                  tracking
                </p>
                <p>
                  • <strong>HYPE Transfers:</strong> Native HYPE movement
                  detection
                </p>
                <p>
                  • <strong>Call Hierarchy:</strong> Full call tree (when trace
                  API available)
                </p>
                <p>
                  • <strong>Gas Profiling:</strong> Detailed gas consumption
                  analysis
                </p>
              </div>
            </div>
          )}

          {Object.keys(errors).length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                Please fix the validation errors above before submitting.
              </AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full"
            size={compact ? 'md' : 'lg'}
            loading={loading}
            disabled={!formData.to}
          >
            <PlayIcon className="h-4 w-4 mr-2" />
            {compact ? 'Simulate' : 'Simulate Transaction'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
