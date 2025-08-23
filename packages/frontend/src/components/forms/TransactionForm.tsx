'use client'

import type {
  Address,
  BlockTag,
  HexString as Hex,
  SimulationParams,
  SimulationRequest,
} from '@altitrace/sdk/types'
import { HashIcon, Loader2Icon, PlayIcon, SendIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Hash } from 'viem'
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import {
  isValidTransactionHash,
  loadTransactionFromHash,
} from '@/services/transaction-loader'
import type { ParsedAbi } from '@/types/api'
import {
  ValidationError,
  validateAddress,
  validateOptionalBlockNumber,
  validateOptionalGas,
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
  onManualDataChange?: () => void
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
  onManualDataChange,
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
  const [activeTab, setActiveTab] = useState<'manual' | 'hash'>('manual')
  const [txHash, setTxHash] = useState('')
  const [loadingTx, setLoadingTx] = useState(false)
  const [txLoadError, setTxLoadError] = useState<string | null>(null)

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

  const handleLoadTransaction = async () => {
    if (!isValidTransactionHash(txHash)) {
      setTxLoadError('Invalid transaction hash format')
      return
    }

    setLoadingTx(true)
    setTxLoadError(null)

    try {
      const txData = await loadTransactionFromHash(txHash as Hash)

      if (!txData) {
        setTxLoadError('Transaction not found or failed to load')
        return
      }

      // Update form data with loaded transaction data
      setFormData({
        to: txData.to || '',
        from: txData.from,
        data: txData.data,
        value: txData.value,
        gas: txData.gas || '',
        blockTag: 'latest',
        blockNumber: txData.blockNumber || '',
        validation: true,
      })

      // Set block number mode if we have a block number
      if (txData.blockNumber) {
        setUseBlockNumber(true)
      }

      // Switch to manual tab to show the loaded data
      setActiveTab('manual')
    } catch (error) {
      setTxLoadError(
        error instanceof Error
          ? error.message
          : 'Failed to load transaction data',
      )
    } finally {
      setLoadingTx(false)
    }
  }

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
      // Ensure value has a default and isn't empty
      const value = formData.value || '0x0'
      if (value.trim() === '') {
        validateValue('0x0', 'value')
      } else {
        validateValue(value, 'value')
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        newErrors.value = error.message
        isValid = false
      }
    }

    try {
      if (formData.gas) {
        validateOptionalGas(formData.gas, 'gas')
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
        validateOptionalBlockNumber(formData.blockNumber, 'blockNumber')
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
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'manual' | 'hash')}
        >
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="manual">
              <SendIcon className="h-4 w-4 mr-2" />
              Manual Input
            </TabsTrigger>
            <TabsTrigger value="hash">
              <HashIcon className="h-4 w-4 mr-2" />
              Load from Hash
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hash" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Input
                  label="Transaction Hash"
                  placeholder="0x..."
                  value={txHash}
                  onChange={(e) => {
                    setTxHash(e.target.value)
                    setTxLoadError(null)
                  }}
                  error={txLoadError || undefined}
                  description="Enter a transaction hash to load its data"
                  className="font-mono text-sm"
                />
              </div>

              <Button
                onClick={handleLoadTransaction}
                loading={loadingTx}
                disabled={!txHash || loadingTx}
                className="w-full"
              >
                {loadingTx ? (
                  <>
                    <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                    Loading Transaction...
                  </>
                ) : (
                  <>
                    <HashIcon className="h-4 w-4 mr-2" />
                    Load Transaction Data
                  </>
                )}
              </Button>

              {!loadingTx && !txLoadError && (
                <Alert>
                  <AlertDescription>
                    This will load the transaction parameters from the
                    blockchain and populate the manual form for simulation.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>

          <TabsContent value="manual">
            <form
              onSubmit={handleSubmit}
              className={compact ? 'space-y-3' : 'space-y-6'}
            >
              {/* Transaction Parameters */}
              <div className={compact ? 'space-y-2' : 'space-y-4'}>
                {!compact && (
                  <h3 className="font-semibold text-lg">
                    Transaction Parameters
                  </h3>
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

                {functionData ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Call Data</label>
                    <div className="bg-muted/50 p-3 rounded border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          ✅ Generated from {functionData.functionName}()
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, data: '' }))
                            onManualDataChange?.()
                          }}
                          className="text-xs h-6"
                        >
                          Edit manually
                        </Button>
                      </div>
                      <div className="font-mono text-xs break-all text-muted-foreground bg-background p-2 rounded">
                        {formData.data}
                      </div>
                    </div>
                  </div>
                ) : (
                  <Input
                    label="Call Data"
                    placeholder="0x... (generate using function builder above)"
                    value={formData.data}
                    onChange={(e) => {
                      handleInputChange('data', e.target.value)
                      if (e.target.value !== formData.data) {
                        onManualDataChange?.()
                      }
                    }}
                    error={errors.data}
                    description={
                      compact
                        ? undefined
                        : 'Contract function call data (use Contract Manager above for automatic generation)'
                    }
                    className="font-mono text-sm"
                  />
                )}

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
                          : 'Specific block number in decimal or hex format (e.g., 123456 or 0x1e240)'
                      }
                    />
                  ) : (
                    <Select
                      options={blockTagOptions}
                      label="Block Tag"
                      value={formData.blockTag ?? 'latest'}
                      onChange={(e) =>
                        handleInputChange(
                          'blockTag',
                          e.target.value as BlockTag,
                        )
                      }
                      description={
                        compact ? undefined : 'Which block to simulate against'
                      }
                    />
                  )}
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
                      • <strong>Asset Changes:</strong> ERC-20/ERC-721 token
                      balance tracking
                    </p>
                    <p>
                      • <strong>HYPE Transfers:</strong> Native HYPE movement
                      detection
                    </p>
                    <p>
                      • <strong>Call Hierarchy:</strong> Full call tree (when
                      trace API available)
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
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
