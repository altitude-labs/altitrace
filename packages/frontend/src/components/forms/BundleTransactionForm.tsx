'use client'

import type {
  Address,
  BlockTag,
  BlockOverrides,
  HexString as Hex,
  StateOverride,
} from '@altitrace/sdk/types'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  HashIcon,
  Loader2Icon,
  PlusIcon,
  PlayIcon,
  SendIcon,
  TrashIcon,
} from 'lucide-react'
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
import { StateOverrideForm } from './StateOverrideForm'
import { BlockOverrideForm } from './BlockOverrideForm'
import { useBlockOverrides } from '@/hooks/useBlockOverrides'
import {
  isValidTransactionHash,
  loadTransactionFromHash,
} from '@/services/transaction-loader'
import type { ParsedAbi } from '@/types/api'
import type {
  BundleFormData,
  BundleSimulationRequest,
  BundleTransaction,
} from '@/types/bundle'
import {
  createDefaultBundleTransaction,
  createDefaultBundleFormData,
} from '@/types/bundle'
import {
  ValidationError,
  validateAddress,
  validateOptionalBlockNumber,
  validateOptionalGas,
  validateOptionalHex,
  validateValue,
  hexToDecimal,
  isHexFormat,
} from '@/utils/validation'

interface BundleTransactionFormProps {
  onSubmit: (request: BundleSimulationRequest) => void
  loading?: boolean
  abi?: ParsedAbi | null
  functionData?: {
    data: Hex
    functionName: string
    parameters: Record<string, string>
  } | null
  initialData?: Partial<BundleFormData>
  compact?: boolean
  onManualDataChange?: () => void
}

export function BundleTransactionForm({
  onSubmit,
  loading,
  functionData,
  initialData,
  compact = false,
  onManualDataChange,
}: BundleTransactionFormProps) {
  const [formData, setFormData] = useState<BundleFormData>(() => ({
    ...createDefaultBundleFormData(),
    ...initialData,
  }))
  const [errors, setErrors] = useState<Record<string, Record<string, string>>>(
    {},
  )
  const [useBlockNumber, setUseBlockNumber] = useState(
    !!initialData?.blockNumber,
  )
  const [showAdvanced, setShowAdvanced] = useState(!compact)
  const [activeTab, setActiveTab] = useState<'manual' | 'hash'>('manual')
  const [txHash, setTxHash] = useState('')
  const [loadingTx, setLoadingTx] = useState(false)
  const [txLoadError, setTxLoadError] = useState<string | null>(null)

  // Block overrides
  const {
    blockOverrides,
    setBlockOverrides,
    getCleanOverrides: getCleanBlockOverrides,
  } = useBlockOverrides(initialData?.blockOverrides)
  const [expandedTransactions, setExpandedTransactions] = useState<Set<string>>(
    new Set(formData.transactions.map((tx) => tx.id)),
  )

  // Update data field when function data is generated (apply to first transaction)
  useEffect(() => {
    if (functionData && formData.transactions.length > 0) {
      updateTransaction(formData.transactions[0].id, {
        data: functionData.data,
      })
    }
  }, [functionData])

  // Update form when initial data changes
  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({
        ...prev,
        ...initialData,
        // Convert state override balance values from hex to decimal for display
        stateOverrides:
          initialData.stateOverrides?.map((override) => ({
            ...override,
            balance:
              override.balance && isHexFormat(override.balance)
                ? hexToDecimal(override.balance)
                : override.balance,
          })) || prev.stateOverrides,
      }))
      setUseBlockNumber(!!initialData.blockNumber)

      // Set block overrides if provided
      if (initialData.blockOverrides) {
        setBlockOverrides(initialData.blockOverrides)
      }
    }
  }, [initialData, setBlockOverrides])

  const blockTagOptions = [
    { value: 'latest', label: 'Latest' },
    { value: 'earliest', label: 'Earliest' },
    { value: 'safe', label: 'Safe' },
    { value: 'finalized', label: 'Finalized' },
  ]

  const updateTransaction = (
    txId: string,
    updates: Partial<BundleTransaction['transaction']>,
  ) => {
    setFormData((prev) => ({
      ...prev,
      transactions: prev.transactions.map((tx) =>
        tx.id === txId
          ? { ...tx, transaction: { ...tx.transaction, ...updates } }
          : tx,
      ),
    }))

    // Clear errors for updated fields
    const txErrors = errors[txId] || {}
    const updatedFields = Object.keys(updates)
    if (updatedFields.some((field) => txErrors[field])) {
      setErrors((prev) => ({
        ...prev,
        [txId]: Object.fromEntries(
          Object.entries(txErrors).filter(
            ([key]) => !updatedFields.includes(key),
          ),
        ),
      }))
    }
  }

  const updateTransactionMeta = (
    txId: string,
    updates: Partial<Omit<BundleTransaction, 'transaction'>>,
  ) => {
    setFormData((prev) => ({
      ...prev,
      transactions: prev.transactions.map((tx) =>
        tx.id === txId ? { ...tx, ...updates } : tx,
      ),
    }))
  }

  const addTransaction = () => {
    const newTx = createDefaultBundleTransaction()
    setFormData((prev) => ({
      ...prev,
      transactions: [...prev.transactions, newTx],
    }))
    setExpandedTransactions((prev) => new Set([...prev, newTx.id]))
  }

  const removeTransaction = (txId: string) => {
    if (formData.transactions.length <= 1) return // Keep at least one transaction

    setFormData((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((tx) => tx.id !== txId),
    }))
    setExpandedTransactions((prev) => {
      const newSet = new Set(prev)
      newSet.delete(txId)
      return newSet
    })
    setErrors((prev) => {
      const newErrors = { ...prev }
      delete newErrors[txId]
      return newErrors
    })
  }

  const toggleTransactionExpanded = (txId: string) => {
    setExpandedTransactions((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(txId)) {
        newSet.delete(txId)
      } else {
        newSet.add(txId)
      }
      return newSet
    })
  }

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

      // Load into first transaction
      if (formData.transactions.length > 0) {
        updateTransaction(formData.transactions[0].id, {
          to: txData.to || '',
          from: txData.from,
          data: txData.data,
          value: txData.value,
          gas: txData.gas || '',
        })
      }

      // Set block number mode if we have a block number
      if (txData.blockNumber) {
        setFormData((prev) => ({
          ...prev,
          blockNumber: txData.blockNumber || '',
        }))
        setUseBlockNumber(true)
      }

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

  const validateTransaction = (
    tx: BundleTransaction,
  ): Record<string, string> => {
    const txErrors: Record<string, string> = {}

    try {
      validateAddress(tx.transaction.to || '', 'to')
    } catch (error) {
      if (error instanceof ValidationError) {
        txErrors.to = error.message
      }
    }

    try {
      if (tx.transaction.from) {
        validateAddress(tx.transaction.from, 'from')
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        txErrors.from = error.message
      }
    }

    try {
      if (tx.transaction.data) {
        validateOptionalHex(tx.transaction.data, 'data')
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        txErrors.data = error.message
      }
    }

    try {
      // Ensure value has a default and isn't empty
      const value = tx.transaction.value || '0x0'
      if (value.trim() === '') {
        validateValue('0x0', 'value')
      } else {
        validateValue(value, 'value')
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        txErrors.value = error.message
      }
    }

    try {
      if (tx.transaction.gas) {
        validateOptionalGas(tx.transaction.gas, 'gas')
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        txErrors.gas = error.message
      }
    }

    return txErrors
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, Record<string, string>> = {}
    let isValid = true

    // Validate each transaction
    for (const tx of formData.transactions) {
      if (!tx.enabled) continue // Skip disabled transactions

      const txErrors = validateTransaction(tx)
      if (Object.keys(txErrors).length > 0) {
        newErrors[tx.id] = txErrors
        isValid = false
      }
    }

    // Validate block number if used
    if (useBlockNumber && formData.blockNumber) {
      try {
        validateOptionalBlockNumber(formData.blockNumber, 'blockNumber')
      } catch (error) {
        if (error instanceof ValidationError) {
          newErrors.form = { blockNumber: error.message }
          isValid = false
        }
      }
    }

    // Check that at least one transaction is enabled
    if (!formData.transactions.some((tx) => tx.enabled)) {
      newErrors.form = { bundle: 'At least one transaction must be enabled' }
      isValid = false
    }

    setErrors(newErrors)
    return isValid
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    const enabledTransactions = formData.transactions.filter((tx) => tx.enabled)

    const request: BundleSimulationRequest = {
      transactions: enabledTransactions,
      ...(useBlockNumber && formData.blockNumber
        ? { blockNumber: formData.blockNumber }
        : { blockTag: formData.blockTag || 'latest' }),
      validation: formData.validation,
      account:
        (enabledTransactions[0]?.transaction.from as Address) ||
        (enabledTransactions[0]?.transaction.to as Address),
      traceAssetChanges: true,
      traceTransfers: true,
      // Include state overrides if any are defined
      ...(formData.stateOverrides.length > 0 && {
        stateOverrides: formData.stateOverrides
          .filter((override) => override.address) // Only include overrides with addresses
          .map((override) => ({
            ...override,
            // Convert balance back to hex for API
            balance:
              override.balance && !isHexFormat(override.balance)
                ? `0x${BigInt(override.balance).toString(16)}`
                : override.balance,
          })),
      }),
      // Include block overrides if any are defined
      ...(getCleanBlockOverrides() && {
        blockOverrides: getCleanBlockOverrides(),
      }),
    }

    onSubmit(request)
  }

  const renderTransactionCard = (tx: BundleTransaction, index: number) => {
    const isExpanded = expandedTransactions.has(tx.id)
    const txErrors = errors[tx.id] || {}
    const hasErrors = Object.keys(txErrors).length > 0

    return (
      <Card
        key={tx.id}
        className={`${!tx.enabled ? 'opacity-60' : ''} ${hasErrors ? 'border-red-200' : ''}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={tx.enabled}
                onChange={(e) =>
                  updateTransactionMeta(tx.id, { enabled: e.target.checked })
                }
                className="rounded"
              />
              <CardTitle className="text-base">
                Transaction {index + 1}
                {tx.label && (
                  <span className="text-sm text-muted-foreground ml-2">
                    - {tx.label}
                  </span>
                )}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleTransactionExpanded(tx.id)}
                className="h-8 w-8 p-0"
              >
                {isExpanded ? (
                  <ChevronUpIcon className="h-4 w-4" />
                ) : (
                  <ChevronDownIcon className="h-4 w-4" />
                )}
              </Button>
              {formData.transactions.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTransaction(tx.id)}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="pt-0 space-y-4">
            <Input
              label="Label (optional)"
              placeholder="e.g., Approve tokens"
              value={tx.label || ''}
              onChange={(e) =>
                updateTransactionMeta(tx.id, { label: e.target.value })
              }
              description="Optional label to describe this transaction"
            />

            <Input
              label="To Address"
              placeholder="0x..."
              value={tx.transaction.to || ''}
              onChange={(e) => updateTransaction(tx.id, { to: e.target.value })}
              error={txErrors.to}
              required
            />

            <Input
              label="From Address (optional)"
              placeholder="0x0000000000000000000000000000000000000000"
              value={tx.transaction.from || ''}
              onChange={(e) =>
                updateTransaction(tx.id, { from: e.target.value })
              }
              error={txErrors.from}
            />

            <Input
              label="Call Data"
              placeholder="0x..."
              value={tx.transaction.data || ''}
              onChange={(e) => {
                updateTransaction(tx.id, { data: e.target.value })
                onManualDataChange?.()
              }}
              error={txErrors.data}
              className="font-mono text-sm"
            />

            <Input
              label="Value (HYPE)"
              placeholder="0x0"
              value={tx.transaction.value || '0x0'}
              onChange={(e) =>
                updateTransaction(tx.id, { value: e.target.value })
              }
              error={txErrors.value}
            />

            {showAdvanced && (
              <Input
                label="Gas Limit (optional)"
                placeholder="0x5208"
                value={tx.transaction.gas || ''}
                onChange={(e) =>
                  updateTransaction(tx.id, { gas: e.target.value })
                }
                error={txErrors.gas}
              />
            )}

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={`continueOnFailure-${tx.id}`}
                checked={tx.continueOnFailure}
                onChange={(e) =>
                  updateTransactionMeta(tx.id, {
                    continueOnFailure: e.target.checked,
                  })
                }
                className="rounded"
              />
              <label htmlFor={`continueOnFailure-${tx.id}`} className="text-sm">
                Continue bundle if this transaction fails
              </label>
            </div>
          </CardContent>
        )}
      </Card>
    )
  }

  const totalErrors = Object.values(errors).reduce(
    (count, txErrors) => count + Object.keys(txErrors).length,
    0,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SendIcon className="h-5 w-5" />
          Bundle Transaction Builder
          <span className="text-sm font-normal text-muted-foreground">
            ({formData.transactions.filter((tx) => tx.enabled).length} enabled)
          </span>
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
              Manual Bundle
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
                  description="Enter a transaction hash to load into the first transaction"
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
            </div>
          </TabsContent>

          <TabsContent value="manual">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Transaction Bundle */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Transaction Bundle</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addTransaction}
                    className="flex items-center gap-2"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Add Transaction
                  </Button>
                </div>

                {formData.transactions.map((tx, index) =>
                  renderTransactionCard(tx, index),
                )}
              </div>

              {/* Block Parameters */}
              {showAdvanced && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Block Parameters</h3>

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
                        setFormData((prev) => ({
                          ...prev,
                          blockNumber: e.target.value,
                        }))
                      }
                      error={errors.form?.blockNumber}
                      description="Specific block number in decimal or hex format"
                    />
                  ) : (
                    <Select
                      options={blockTagOptions}
                      label="Block Tag"
                      value={formData.blockTag ?? 'latest'}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          blockTag: e.target.value as BlockTag,
                        }))
                      }
                      description="Which block to simulate the bundle against"
                    />
                  )}
                </div>
              )}

              {/* State Overrides */}
              {showAdvanced && (
                <StateOverrideForm
                  stateOverrides={formData.stateOverrides}
                  onChange={(stateOverrides) =>
                    setFormData((prev) => ({
                      ...prev,
                      stateOverrides,
                    }))
                  }
                  compact={compact}
                />
              )}

              {/* Block Overrides */}
              {showAdvanced && (
                <BlockOverrideForm
                  blockOverrides={blockOverrides}
                  onChange={setBlockOverrides}
                  compact={compact}
                />
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

              {/* Bundle Features Info */}
              {!compact && (
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h3 className="font-semibold text-sm mb-2">
                    🔗 Bundle Simulation Features
                  </h3>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      • <strong>Sequential Execution:</strong> Transactions
                      execute in order with state persistence
                    </p>
                    <p>
                      • <strong>Dependency Support:</strong> Each transaction
                      sees the results of previous ones
                    </p>
                    <p>
                      • <strong>Failure Handling:</strong> Configure whether to
                      continue on individual transaction failures
                    </p>
                    <p>
                      • <strong>Bundle Analysis:</strong> Comprehensive gas and
                      asset tracking across the entire bundle
                    </p>
                  </div>
                </div>
              )}

              {totalErrors > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Please fix the {totalErrors} validation error(s) above
                    before submitting.
                  </AlertDescription>
                </Alert>
              )}

              {errors.form?.bundle && (
                <Alert variant="destructive">
                  <AlertDescription>{errors.form.bundle}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                size={compact ? 'md' : 'lg'}
                loading={loading}
                disabled={
                  formData.transactions.filter((tx) => tx.enabled).length === 0
                }
              >
                <PlayIcon className="h-4 w-4 mr-2" />
                {compact
                  ? 'Simulate Bundle'
                  : `Simulate Bundle (${formData.transactions.filter((tx) => tx.enabled).length} transactions)`}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
