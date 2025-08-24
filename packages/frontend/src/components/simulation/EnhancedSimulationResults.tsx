'use client'

import type { CallResult, StateOverride } from '@altitrace/sdk/types'
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  CheckIcon,
  CoinsIcon,
  CopyIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  FuelIcon,
  HashIcon,
  KeyIcon,
  ListIcon,
  SettingsIcon,
  TreePineIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UserIcon,
  WalletIcon,
  XCircleIcon,
} from 'lucide-react'
import React, { useState } from 'react'
import { DecHexToggle } from '@/components/shared/DecHexToggle'
import {
  CallTraceTree,
  CallTraceTreeFallback,
} from '@/components/trace/CallTraceTree'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { getErrorSummary, parseBlockchainError } from '@/utils/error-parser'
import type { EnhancedSimulationResult } from '@/utils/trace-integration'
import { AccessListView } from './AccessListView'
import { EnhancedEventDisplay } from './EnhancedEventDisplay'
import { EnhancedGasAnalysis } from './EnhancedGasAnalysis'
import { StateChangesView } from './StateChangesView'

interface EnhancedSimulationResultsProps {
  result: EnhancedSimulationResult
  simulationRequest?: {
    params: {
      calls: Array<{
        to: string
        from?: string
        data?: string
        value?: string
        gas?: string
      }>
      stateOverrides?: StateOverride[]
      [key: string]: any
    }
    options?: any
  }
  isTraceOnly?: boolean
}

export function EnhancedSimulationResults({
  result,
  simulationRequest,
  isTraceOnly = false,
}: EnhancedSimulationResultsProps) {
  const [activeTab, setActiveTab] = useState('overview')

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    // Scroll to the content section after tab change
    setTimeout(() => {
      const contentElement = document.querySelector('[data-tab-content]')
      if (contentElement) {
        contentElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest',
        })
      }
    }, 100) // Small delay to ensure tab content is rendered
  }

  // Use SDK helper methods
  const isSuccess = result.isSuccess()
  const logCount = result.getLogCount()
  const assetChanges = result.getAssetChangesSummary()

  const stateOverrides =
    simulationRequest?.options?.stateOverrides ||
    simulationRequest?.params?.stateOverrides ||
    []
  const hasStateOverrides = stateOverrides.length > 0

  const tabConfig = [
    {
      id: 'overview',
      label: 'Overview',
      icon: HashIcon,
      count: null,
    },
    {
      id: 'calls',
      label: 'Calls',
      icon: ListIcon,
      count: result.calls?.length || 0,
    },
    {
      id: 'trace',
      label: 'Call Trace',
      icon: TreePineIcon,
      count: result.hasCallHierarchy
        ? result.traceData?.getCallCount?.() || 0
        : null,
      disabled: !result.hasCallHierarchy,
    },
    {
      id: 'accesslist',
      label: 'Access List',
      icon: KeyIcon,
      count: result.hasAccessList
        ? result.accessListData?.getAccountCount() || 0
        : null,
      disabled: !result.hasAccessList && !result.hasGasComparison,
    },
    {
      id: 'statechanges',
      label: 'State Changes',
      icon: DatabaseIcon,
      count: result.hasStateChanges
        ? result.getStateChangesCount?.() || 0
        : null,
      disabled: !result.hasStateChanges,
    },
    {
      id: 'events',
      label: 'Events',
      icon: ListIcon,
      count: logCount,
    },
    {
      id: 'assets',
      label: 'Asset Changes',
      icon: CoinsIcon,
      count: assetChanges.length,
      disabled: assetChanges.length === 0, // Disable only if there are no asset changes
    },
    {
      id: 'request',
      label: 'Request',
      icon: SettingsIcon,
      count: hasStateOverrides ? stateOverrides.length : null,
      disabled: false,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <SimulationQuickStats
        result={result}
        simulationRequest={simulationRequest}
      />

      {/* Main Content Tabs */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircleIcon className="h-5 w-5 text-green-500" />
            ) : (
              <XCircleIcon className="h-5 w-5 text-red-500" />
            )}
            {isTraceOnly ? 'Execution Results' : 'Simulation Results'}
            <Badge
              variant={isSuccess ? 'default' : 'destructive'}
              className="ml-2"
            >
              {result.status}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            {/* Mobile: Vertical list, Desktop: Horizontal tabs */}
            <div className="sm:hidden">
              <div className="space-y-1">
                {tabConfig.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    disabled={tab.disabled}
                    className={`w-full flex items-center justify-between p-3 text-left rounded-lg border transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card hover:bg-muted border-border'
                    } ${tab.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center gap-3">
                      <tab.icon className="h-4 w-4 flex-shrink-0" />
                      <span className="font-medium">{tab.label}</span>
                    </div>
                    {tab.count !== null && (
                      <Badge
                        variant={activeTab === tab.id ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {tab.count}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop: Horizontal tabs - Allow wrapping for better tab visibility */}
            <TabsList className="hidden sm:flex w-full flex-wrap gap-1 h-auto min-h-10 p-1">
              {tabConfig.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  disabled={tab.disabled}
                  className="flex items-center gap-1 text-xs p-2 min-w-fit whitespace-nowrap"
                >
                  <tab.icon className="h-3 w-3 flex-shrink-0" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.count !== null && (
                    <Badge
                      variant="secondary"
                      className="text-xs min-w-[1.25rem] h-4 px-1"
                    >
                      {tab.count}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="mt-6" data-tab-content>
              <TabsContent value="overview">
                <SimulationOverview result={result} />
              </TabsContent>

              <TabsContent value="calls">
                <CallsBreakdown result={result} setActiveTab={setActiveTab} />
              </TabsContent>

              <TabsContent value="trace">
                {result.hasCallHierarchy && result.traceData ? (
                  <CallTraceTree traceData={result.traceData} />
                ) : (
                  <CallTraceTreeFallback message="Call trace data is not available. This feature requires the trace API." />
                )}
              </TabsContent>

              <TabsContent value="accesslist">
                {result.hasAccessList && result.accessListData ? (
                  <AccessListView
                    accessListData={result.accessListData}
                    gasComparison={result.gasComparison}
                  />
                ) : (
                  <AccessListFallback />
                )}
              </TabsContent>

              <TabsContent value="statechanges">
                {result.hasStateChanges && result.traceData?.prestateTracer ? (
                  <StateChangesView
                    prestateData={result.traceData.prestateTracer}
                  />
                ) : (
                  <StateChangesFallback />
                )}
              </TabsContent>

              <TabsContent value="events">
                <EventsBreakdown result={result} />
              </TabsContent>

              <TabsContent value="assets">
                <AssetChangesBreakdown result={result} />
              </TabsContent>

              <TabsContent value="request">
                <RequestParametersView simulationRequest={simulationRequest} />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

function SimulationQuickStats({
  result,
  simulationRequest,
}: {
  result: EnhancedSimulationResult
  simulationRequest?: EnhancedSimulationResultsProps['simulationRequest']
}) {
  // For trace results with receipt, use receipt block number, otherwise parse hex
  const traceResult = result as any
  const receiptData = traceResult.receipt
  const blockNumberDecimal = receiptData?.blockNumber
    ? Number(receiptData.blockNumber)
    : result.blockNumber
      ? Number.parseInt(result.blockNumber, 16)
      : 0

  const gasUsedDecimal = Number(result.getTotalGasUsed())

  // Smart call count: use trace data if available, fallback to simulation calls
  const callCount = result.hasCallHierarchy
    ? result.traceData?.getCallCount() || result.calls?.length || 0
    : result.calls?.length || 0

  // Event count: prioritize trace data logs, then simulation calls
  const eventCount =
    result.hasCallHierarchy && result.traceData
      ? result.traceData.getAllLogs?.()?.length || 0
      : result.calls?.reduce(
          (sum: number, call) => sum + (call.logs?.length || 0),
          0,
        ) || 0

  // Transaction value from the first call
  const transactionValue = simulationRequest?.params?.calls?.[0]?.value
  const hasTransactionValue = transactionValue && transactionValue !== '0x0'

  // Calculate transaction value in ETH for display
  const transactionValueEth = hasTransactionValue
    ? (BigInt(transactionValue) / BigInt(10 ** 18)).toString() +
      '.' +
      (BigInt(transactionValue) % BigInt(10 ** 18))
        .toString()
        .padStart(18, '0')
        .slice(0, 4)
    : null

  // State overrides count
  const allStateOverrides =
    simulationRequest?.options?.stateOverrides ||
    simulationRequest?.params?.stateOverrides ||
    []
  const stateOverridesCount = allStateOverrides.length

  // Block gas information from receipt (for trace results)
  const hasReceiptData = !!receiptData
  const blockGasUsed = receiptData?.blockGasUsed

  // Grid columns: show more columns based on what data we have
  const extraColumns = [
    hasTransactionValue,
    stateOverridesCount > 0,
    hasReceiptData,
  ].filter(Boolean).length
  const totalColumns = Math.min(4 + extraColumns, 6) // Max 6 columns
  const gridCols =
    totalColumns <= 4
      ? 'grid-cols-2 lg:grid-cols-4'
      : totalColumns === 5
        ? 'grid-cols-2 lg:grid-cols-5'
        : 'grid-cols-2 lg:grid-cols-6'

  return (
    <div className={`grid ${gridCols} gap-3 sm:gap-4`}>
      <Card
        className={`${result.isSuccess() ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}`}
      >
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">
                Status
              </p>
              <div className="flex items-center gap-1.5">
                {result.isSuccess() ? (
                  <CheckCircleIcon className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 flex-shrink-0" />
                ) : (
                  <XCircleIcon className="h-3 w-3 sm:h-4 sm:w-4 text-red-500 flex-shrink-0" />
                )}
                <p className="text-sm sm:text-lg font-bold truncate">
                  {result.isSuccess() ? result.status : 'failed'}
                </p>
              </div>
              {!result.isSuccess() && result.getErrors().length > 0 && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1 line-clamp-2">
                  {(() => {
                    const errors = result.getErrors()
                    // Find the most specific error (contract error data)
                    const specificError = errors.find(error => {
                      const normalizedError = typeof error === 'string' ? error : {
                        reason: error.reason,
                        message: error.message || undefined
                      }
                      const parsed = parseBlockchainError(normalizedError)
                      return parsed.type === 'revert' && parsed.details && 
                        parsed.details !== 'execution reverted' &&
                        parsed.details !== 'The transaction was reverted by the contract'
                    })
                    
                    if (specificError) {
                      const errorMessage = typeof specificError === 'string' ? specificError : (specificError.reason || specificError.message || '')
                      return `Transaction reverted: ${errorMessage}`
                    }
                    
                    const normalizedFirstError = typeof errors[0] === 'string' ? errors[0] : {
                      reason: errors[0].reason,
                      message: errors[0].message || undefined
                    }
                    return getErrorSummary(normalizedFirstError)
                  })()}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">
                Gas Used
              </p>
              <p className="text-sm sm:text-lg font-bold truncate">
                {gasUsedDecimal.toLocaleString()}
              </p>
            </div>
            <FuelIcon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0 mt-1" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">
                {result.hasCallHierarchy
                  ? 'Total Calls (Trace)'
                  : 'Transaction Calls'}
              </p>
              <p className="text-sm sm:text-lg font-bold">{callCount}</p>
              {result.hasCallHierarchy && (
                <Badge variant="secondary" className="text-xs mt-1">
                  Enhanced
                </Badge>
              )}
            </div>
            <TreePineIcon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0 mt-1" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">
                Events
              </p>
              <p className="text-sm sm:text-lg font-bold">{eventCount}</p>
              <p className="text-xs text-muted-foreground">
                Block #{blockNumberDecimal.toLocaleString()}
              </p>
            </div>
            <ListIcon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0 mt-1" />
          </div>
        </CardContent>
      </Card>

      {/* Transaction Value Card */}
      {hasTransactionValue && (
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">
                  Transaction Value
                </p>
                <p className="text-sm sm:text-lg font-bold">
                  {transactionValueEth} ETH
                </p>
                <p className="text-xs text-muted-foreground font-mono break-all">
                  {transactionValue}
                </p>
              </div>
              <WalletIcon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0 mt-1" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* State Overrides Card */}
      {stateOverridesCount > 0 && (
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">
                  State Overrides
                </p>
                <p className="text-sm sm:text-lg font-bold">
                  {stateOverridesCount}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stateOverridesCount === 1 ? 'account' : 'accounts'}
                </p>
              </div>
              <UserIcon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0 mt-1" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Block Gas Card (for trace results with receipt data) */}
      {hasReceiptData && blockGasUsed && (
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">
                  Block Gas Used
                </p>
                <p className="text-sm sm:text-lg font-bold">
                  {Number(blockGasUsed).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  Cumulative in block
                </p>
              </div>
              <FuelIcon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0 mt-1" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SimulationOverview({ result }: { result: EnhancedSimulationResult }) {
  const errors = result.getErrors()
  const assetChanges = result.getAssetChangesSummary()

  // Get transaction hash from receipt data (for trace results)
  const receiptData = (result as any).receipt
  const transactionHash = receiptData?.transactionHash
  
  // Process errors to combine generic revert messages with actual error data
  const processedErrors = React.useMemo(() => {
    if (errors.length <= 1) return errors
    
    // Parse all errors
    const parsedErrors = errors.map(error => {
      const normalizedError = typeof error === 'string' ? error : {
        reason: error.reason,
        message: error.message || undefined
      }
      return {
        original: error,
        parsed: parseBlockchainError(normalizedError)
      }
    })
    
    // Look for pairs of generic revert + specific error data
    const genericReverts = parsedErrors.filter(e => 
      e.parsed.type === 'revert' && 
      (e.parsed.details === 'execution reverted' || 
       e.parsed.details === 'The transaction was reverted by the contract' ||
       !e.parsed.details)
    )
    
    const specificErrors = parsedErrors.filter(e => {
      // Contract error codes or specific error messages
      if (e.parsed.type === 'revert' && e.parsed.details) {
        const details = e.parsed.details
        return details !== 'execution reverted' && 
               details !== 'The transaction was reverted by the contract'
      }
      return e.parsed.type !== 'revert'
    })
    
    // If we have both generic and specific errors, prefer specific ones
    if (genericReverts.length > 0 && specificErrors.length > 0) {
      return specificErrors.map(e => e.original)
    }
    
    // Otherwise return all errors
    return errors
  }, [errors])

  return (
    <div className="space-y-6">
      {/* Gas Analysis */}
      <EnhancedGasAnalysis result={result} />

      {/* Block & Trace Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Block Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {transactionHash && (
              <div>
                <label
                  htmlFor="transaction-hash"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Transaction Hash
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono bg-muted px-2 py-1 rounded break-all">
                    {transactionHash}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      navigator.clipboard.writeText(transactionHash)
                    }
                    className="h-7 w-7 p-0"
                  >
                    <CopyIcon className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
            <div>
              <label
                htmlFor="block-number"
                className="text-sm font-medium text-muted-foreground"
              >
                Block Number
              </label>
              <div className="mt-1">
                <DecHexToggle value={result.blockNumber} />
              </div>
            </div>
            <div>
              <label
                htmlFor="gas-used"
                className="text-sm font-medium text-muted-foreground"
              >
                Gas Used
              </label>
              <div className="mt-1">
                <DecHexToggle value={result.gasUsed} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trace Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge
                variant={result.hasCallHierarchy ? 'default' : 'secondary'}
              >
                Call Hierarchy:{' '}
                {result.hasCallHierarchy ? 'Available' : 'Not Available'}
              </Badge>
              {result.hasCallHierarchy && result.traceData && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>
                    Max depth: {result.traceData.getMaxDepth?.() || 'Unknown'}
                  </div>
                  <div>
                    Total calls:{' '}
                    {result.traceData.getCallCount?.() || 'Unknown'}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Errors */}
      {processedErrors.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-red-100 dark:bg-red-900/20">
                <AlertTriangleIcon className="h-4 w-4 text-red-600 dark:text-red-500" />
              </div>
              {processedErrors.length === 1 ? 'Error' : `Errors (${processedErrors.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {processedErrors.map((error, index: number) => {
                const normalizedError = typeof error === 'string' ? error : {
                  reason: error.reason,
                  message: error.message || undefined
                }
                const parsedError = parseBlockchainError(normalizedError)
                // For short error codes or specific contract errors, show them prominently
                const isContractError = parsedError.type === 'revert' && parsedError.details && 
                  parsedError.details !== 'The transaction was reverted by the contract'
                
                return (
                  <div
                    key={`error-${error.reason || error.message || index}`}
                    className="flex gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div className="mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="font-medium">
                        {isContractError ? 'Contract Error' : parsedError.title}
                      </div>
                      {parsedError.details && (
                        <div className={`text-sm ${isContractError ? 'font-mono text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                          {parsedError.details}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Asset Changes Summary */}
      {assetChanges.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <CoinsIcon className="h-4 w-4" />
              Asset Changes Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {assetChanges.map((change, index: number) => (
                <div
                  key={`asset-${change.tokenAddress}-${change.type}-${index}`}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{change.symbol}</span>
                    <Badge variant="outline" className="text-xs">
                      {change.tokenAddress.slice(0, 6)}...
                    </Badge>
                  </div>
                  <div
                    className={`flex items-center gap-1 ${
                      change.type === 'gain' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {change.type === 'gain' ? (
                      <TrendingUpIcon className="h-3 w-3" />
                    ) : (
                      <TrendingDownIcon className="h-3 w-3" />
                    )}
                    <span className="font-mono text-sm">
                      {formatTokenAmount(
                        change.netChange,
                        change.decimals ?? undefined,
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function CallsBreakdown({
  result,
  setActiveTab,
}: {
  result: EnhancedSimulationResult
  setActiveTab: (tab: string) => void
}) {
  if (!result.calls || result.calls.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ListIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No calls in this simulation</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {result.calls.map((call, index: number) => (
        <CallCard
          key={`call-${call.callIndex}-${index}`}
          call={call}
          callIndex={index}
          setActiveTab={setActiveTab}
        />
      ))}
    </div>
  )
}

function CallCard({
  call,
  callIndex,
  setActiveTab,
}: {
  call: CallResult
  callIndex: number
  setActiveTab: (tab: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isSuccess = call.status === 'success'

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
            ) : (
              <XCircleIcon className="h-4 w-4 text-red-500 flex-shrink-0" />
            )}
            <span className="text-sm sm:text-base">Call #{callIndex + 1}</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant={isSuccess ? 'default' : 'destructive'}
              className="text-xs"
            >
              {call.status}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
          <div>
            <label
              htmlFor="gas-used"
              className="text-xs font-medium text-muted-foreground"
            >
              Gas Used
            </label>
            <div className="mt-1">
              <DecHexToggle value={call.gasUsed} showLabel={false} />
            </div>
          </div>

          <div>
            <label
              htmlFor="return-data"
              className="text-xs font-medium text-muted-foreground"
            >
              Return Data
            </label>
            <div className="mt-1 font-mono text-xs">
              {call.returnData ? `${call.returnData.slice(0, 10)}...` : '0x'}
            </div>
          </div>

          <div>
            <label
              htmlFor="logs"
              className="text-xs font-medium text-muted-foreground"
            >
              Logs
            </label>
            <div className="mt-1 text-sm">{call.logs?.length || 0} events</div>
          </div>
        </div>

        {isExpanded && (
          <div className="space-y-4 border-t pt-4">
            {call.returnData && (
              <div>
                <label
                  htmlFor="return-data"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Return Data
                </label>
                <div className="bg-muted p-3 rounded font-mono text-sm break-all mt-1">
                  {call.returnData}
                </div>
              </div>
            )}

            {call.error && (
              <div className="p-3 bg-red-50 dark:bg-red-950 rounded border border-red-200 dark:border-red-800">
                <h4 className="font-medium text-red-900 dark:text-red-100 mb-1">
                  Error
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300">
                  {call.error.reason}
                </p>
              </div>
            )}

            {call.logs && call.logs.length > 0 && (
              <div>
                <label
                  htmlFor="event-logs"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Event Logs Summary
                </label>
                <div className="mt-2 text-sm text-muted-foreground">
                  {call.logs.length} event{call.logs.length > 1 ? 's' : ''}{' '}
                  emitted.
                  <button
                    type="button"
                    className="text-primary ml-1 cursor-pointer hover:underline bg-transparent border-none p-0"
                    onClick={() => setActiveTab('events')}
                  >
                    View in Events tab →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function EventsBreakdown({ result }: { result: EnhancedSimulationResult }) {
  if (!result.calls || result.calls.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ListIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No events in this simulation</p>
      </div>
    )
  }

  // Extract ABI information if available (for trace results with auto-fetched ABIs)
  const availableABI = (result as any).combinedABI || undefined
  const fetchedContracts = (result as any).fetchedContracts || undefined

  // Filter calls that have logs
  const callsWithLogs = result.calls.filter(
    (call) => call.logs && call.logs.length > 0,
  )

  if (callsWithLogs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ListIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No events in this simulation</p>
        {result.calls.length > 0 && (
          <p className="text-xs mt-2">
            Found {result.calls.length} call(s) but no events were emitted
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {callsWithLogs.map((call, index: number) => (
        <EnhancedEventDisplay
          key={`event-${call.status}-${index}`}
          call={call}
          callIndex={index}
          availableABI={availableABI}
          fetchedContracts={fetchedContracts}
          assetChanges={result.assetChanges || undefined}
        />
      ))}
    </div>
  )
}

function AssetChangesBreakdown({
  result,
}: {
  result: EnhancedSimulationResult
}) {
  const assetChanges = result.getAssetChangesSummary()

  if (assetChanges.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground space-y-4">
        <CoinsIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-foreground">
            No Asset Changes Detected
          </h3>
          <p className="text-sm max-w-md mx-auto">
            This simulation didn't result in any ERC-20 or ERC-721 token balance
            changes. This could mean the transaction doesn't interact with
            tokens, or only performs read operations.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {assetChanges.map((change, index: number) => (
        <AssetChangeCard
          key={`${change.tokenAddress}-${change.type}-${index}`}
          change={change}
        />
      ))}
    </div>
  )
}

// Helper function to format token amounts with proper decimals
const formatTokenAmount = (amount: string, decimals?: number) => {
  if (!amount || amount === '0') return '0'

  try {
    const value = BigInt(amount)
    if (decimals && decimals > 0) {
      const divisor = BigInt(10 ** decimals)
      const wholePart = value / divisor
      const fractionalPart = value % divisor

      if (fractionalPart === 0n) {
        return wholePart.toString()
      }
      const fractionalStr = fractionalPart.toString().padStart(decimals, '0')
      const trimmed = fractionalStr.replace(/0+$/, '')
      return `${wholePart}.${trimmed}`
    }
    return value.toString()
  } catch {
    return amount
  }
}

function AssetChangeCard({ change }: { change: any }) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Failed to copy to clipboard
    }
  }

  const getExplorerUrl = (address: string) => {
    // Using HyperScan for HyperEVM
    return `https://hyperscan.com/address/${address}`
  }

  const displaySymbol =
    change.symbol && change.symbol !== 'null'
      ? change.symbol
      : change.tokenAddress === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
        ? 'HYPE'
        : `Token (${change.tokenAddress.slice(0, 6)}...)`

  const isHYPE =
    change.tokenAddress === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-full ${
                change.type === 'gain'
                  ? 'bg-green-100 dark:bg-green-900'
                  : 'bg-red-100 dark:bg-red-900'
              }`}
            >
              {change.type === 'gain' ? (
                <TrendingUpIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDownIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="font-medium">{displaySymbol}</div>
                {change.symbol && change.symbol !== 'null' && (
                  <Badge variant="outline" className="text-xs">
                    {isHYPE ? 'Native' : 'ERC-20'}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-mono">
                  {isHYPE ? 'Native Token' : change.tokenAddress}
                </span>
                {!isHYPE && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(change.tokenAddress)}
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      title="Copy token address"
                    >
                      {copied ? (
                        <CheckIcon className="h-3 w-3 text-green-500" />
                      ) : (
                        <CopyIcon className="h-3 w-3" />
                      )}
                    </Button>
                    <a
                      href={getExplorerUrl(change.tokenAddress)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-4 w-4 p-0 hover:bg-muted rounded transition-colors flex items-center justify-center"
                      title="View on explorer"
                    >
                      <ExternalLinkIcon className="h-3 w-3" />
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div
              className={`text-lg font-semibold ${
                change.type === 'gain' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatTokenAmount(change.netChange, change.decimals)}
            </div>
            <div className="text-sm text-muted-foreground">
              {change.decimals || 18} decimals
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AccessListFallback() {
  return (
    <div className="text-center py-12 text-muted-foreground space-y-4">
      <KeyIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <div className="space-y-2">
        <h3 className="text-lg font-medium text-foreground">
          Gas Optimization Not Available
        </h3>
        <p className="text-sm max-w-md mx-auto">
          Access list generation failed or is not supported for this
          transaction. We couldn't perform gas optimization analysis to compare
          simulations with and without access lists.
        </p>
      </div>
      <div className="bg-muted/50 border rounded-lg max-w-lg mx-auto p-4 text-xs">
        <p className="font-medium mb-2 text-foreground">
          💡 About Gas Optimization with Access Lists (
          <a
            href="https://eips.ethereum.org/EIPS/eip-2930"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            EIP-2930
          </a>
          )
        </p>
        <ul className="text-left space-y-1 text-muted-foreground">
          <li>• Pre-warm accounts and storage slots to reduce gas costs</li>
          <li>• Compare gas usage with and without access lists</li>
          <li>• Get recommendations on whether to use access lists</li>
          <li>• See detailed gas savings analysis</li>
          <li>• Particularly effective for complex contract interactions</li>
        </ul>
      </div>
    </div>
  )
}

function StateChangesFallback() {
  return (
    <div className="text-center py-12 text-muted-foreground space-y-4">
      <DatabaseIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <div className="space-y-2">
        <h3 className="text-lg font-medium text-foreground">
          State Changes Not Available
        </h3>
        <p className="text-sm max-w-md mx-auto">
          State changes tracking failed or is not supported for this simulation.
          This feature requires trace data with the prestate tracer enabled in
          diff mode.
        </p>
      </div>
      <div className="bg-muted/50 border rounded-lg max-w-lg mx-auto p-4 text-xs">
        <p className="font-medium mb-2 text-foreground">
          🔍 About State Changes Tracking
        </p>
        <ul className="text-left space-y-1 text-muted-foreground">
          <li>• Track all account balance changes during execution</li>
          <li>• Monitor nonce updates for transaction accounts</li>
          <li>• View storage slot modifications with before/after values</li>
          <li>• Identify contract code updates and deployments</li>
          <li>• Essential for understanding transaction side effects</li>
        </ul>
      </div>
    </div>
  )
}

function RequestParametersView({
  simulationRequest,
}: {
  simulationRequest?: EnhancedSimulationResultsProps['simulationRequest']
}) {
  if (!simulationRequest) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No request parameters available</p>
      </div>
    )
  }

  const { params, options } = simulationRequest
  const stateOverrides = options?.stateOverrides || params.stateOverrides || []
  const hasStateOverrides = stateOverrides.length > 0
  const transactionCalls = params.calls || []
  const isBundleContext = options?.bundleContext === true

  // Format transaction value for display
  const formatTransactionValue = (value?: string) => {
    if (!value || value === '0x0') return null
    try {
      const valueInWei = BigInt(value)
      const valueInEth = Number(valueInWei) / 1e18
      return {
        wei: value,
        eth: valueInEth.toFixed(6),
        formatted:
          valueInEth > 0.001
            ? `${valueInEth.toFixed(4)} HYPE`
            : `${Number(valueInWei)} wei`,
      }
    } catch {
      return { wei: value, eth: 'Invalid', formatted: value }
    }
  }

  // Get state override summary
  const getStateOverrideSummary = (override: StateOverride) => {
    const parts = []
    if (override.balance) parts.push('Balance')
    if (override.nonce !== null && override.nonce !== undefined)
      parts.push('Nonce')
    if (override.code) parts.push('Code')
    if (override.state && override.state.length > 0)
      parts.push(`Storage (${override.state.length})`)
    return parts.join(', ') || 'Empty override'
  }

  return (
    <div className="space-y-6">
      {/* Bundle Context Information */}
      {isBundleContext && (
        <div>
          <h3 className="font-semibold text-lg mb-4">Bundle Context</h3>
          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {options?.bundleId && (
                  <div>
                    <div className="font-medium text-muted-foreground">
                      Bundle ID
                    </div>
                    <p className="font-mono text-xs break-all mt-1">
                      {options.bundleId}
                    </p>
                  </div>
                )}
                {options?.bundleIndex !== undefined && (
                  <div>
                    <div className="font-medium text-muted-foreground">
                      Transaction Position
                    </div>
                    <p className="mt-1">
                      Transaction #{options.bundleIndex + 1} in bundle
                    </p>
                  </div>
                )}
                <div>
                  <div className="font-medium text-muted-foreground">
                    Execution Context
                  </div>
                  <p className="mt-1">
                    Part of sequential bundle execution with state dependency
                  </p>
                </div>
                <div>
                  <div className="font-medium text-muted-foreground">
                    Block Context
                  </div>
                  <p className="font-mono text-sm mt-1">
                    {params.blockNumber || params.blockTag || 'latest'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transaction Calls */}
      <div>
        <h3 className="font-semibold text-lg mb-4">
          {isBundleContext ? 'Transaction Details' : 'Transaction Calls'} (
          {transactionCalls.length})
        </h3>
        <div className="space-y-4">
          {transactionCalls.map((call, index) => {
            const value = formatTransactionValue(call.value)
            return (
              <Card key={index} className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Call #{index + 1}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {call.from && (
                    <div>
                      <label
                        htmlFor="from-address"
                        className="text-sm font-medium text-muted-foreground"
                      >
                        From Address
                      </label>
                      <p className="font-mono text-sm bg-muted px-2 py-1 rounded mt-1 break-all sm:break-normal">
                        <span className="sm:hidden">{`${call.from.slice(0, 10)}...${call.from.slice(-8)}`}</span>
                        <span className="hidden sm:inline">{call.from}</span>
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label
                        htmlFor="to-address"
                        className="text-sm font-medium text-muted-foreground"
                      >
                        To Address
                      </label>
                      <p className="font-mono text-sm bg-muted px-2 py-1 rounded mt-1 break-all sm:break-normal">
                        <span className="sm:hidden">{`${call.to.slice(0, 10)}...${call.to.slice(-8)}`}</span>
                        <span className="hidden sm:inline">{call.to}</span>
                      </p>
                    </div>

                    {call.data && (
                      <div>
                        <label
                          htmlFor="call-data"
                          className="text-sm font-medium text-muted-foreground"
                        >
                          Call Data
                        </label>
                        <p className="font-mono text-xs bg-muted px-2 py-1 rounded mt-1 break-all">
                          <span className="sm:hidden">
                            {call.data.length > 50
                              ? `${call.data.slice(0, 50)}...`
                              : call.data}
                          </span>
                          <span className="hidden sm:inline">
                            {call.data.length > 100
                              ? `${call.data.slice(0, 100)}...`
                              : call.data}
                          </span>
                        </p>
                      </div>
                    )}

                    {value && (
                      <div>
                        <label
                          htmlFor="value"
                          className="text-sm font-medium text-muted-foreground"
                        >
                          Value
                        </label>
                        <div className="mt-1">
                          <p className="font-semibold text-sm">
                            {value.formatted}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground break-all">
                            {value.wei}
                          </p>
                        </div>
                      </div>
                    )}

                    {call.gas && (
                      <div>
                        <label
                          htmlFor="gas-limit"
                          className="text-sm font-medium text-muted-foreground"
                        >
                          Gas Limit
                        </label>
                        <div className="mt-1">
                          <DecHexToggle
                            value={call.gas}
                            className="font-mono text-sm bg-muted px-2 py-1 rounded"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* State Overrides */}
      {hasStateOverrides && (
        <div>
          <h3 className="font-semibold text-lg mb-4">
            State Overrides ({stateOverrides.length})
          </h3>
          <div className="space-y-4">
            {stateOverrides.map((override: StateOverride, index: number) => (
              <Card key={index} className="border-l-4 border-l-orange-500">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Override #{index + 1}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {getStateOverrideSummary(override)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label
                      htmlFor="address"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      Address
                    </label>
                    <p className="font-mono text-sm bg-muted px-2 py-1 rounded mt-1 break-all sm:break-normal">
                      <span className="sm:hidden">{`${override.address?.slice(0, 10)}...${override.address?.slice(-8)}`}</span>
                      <span className="hidden sm:inline">
                        {override.address || 'N/A'}
                      </span>
                    </p>
                  </div>

                  {override.balance && (
                    <div>
                      <label
                        htmlFor="balance-override"
                        className="text-sm font-medium text-muted-foreground"
                      >
                        Balance Override
                      </label>
                      <div className="mt-1">
                        <DecHexToggle
                          value={override.balance}
                          className="font-mono text-sm bg-muted px-2 py-1 rounded break-all"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          ≈{' '}
                          {(Number(BigInt(override.balance)) / 1e18).toFixed(6)}{' '}
                          ETH
                        </p>
                      </div>
                    </div>
                  )}

                  {override.nonce !== null && override.nonce !== undefined && (
                    <div>
                      <label
                        htmlFor="nonce-override"
                        className="text-sm font-medium text-muted-foreground"
                      >
                        Nonce Override
                      </label>
                      <p className="font-mono text-sm bg-muted px-2 py-1 rounded mt-1">
                        {override.nonce}
                      </p>
                    </div>
                  )}

                  {override.code && (
                    <div>
                      <label
                        htmlFor="code-override"
                        className="text-sm font-medium text-muted-foreground"
                      >
                        Code Override
                      </label>
                      <p className="font-mono text-xs bg-muted px-2 py-1 rounded mt-1 break-all">
                        {override.code.length > 100
                          ? `${override.code.slice(0, 100)}...`
                          : override.code}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {override.code === '0x'
                          ? 'Empty contract'
                          : `${(override.code.length - 2) / 2} bytes`}
                      </p>
                    </div>
                  )}

                  {override.state && override.state.length > 0 && (
                    <div>
                      <label
                        htmlFor="storage-overrides"
                        className="text-sm font-medium text-muted-foreground"
                      >
                        Storage Overrides
                      </label>
                      <div className="mt-1 space-y-2">
                        {override.state.map(
                          (
                            slot: { slot: string; value: string },
                            slotIndex: number,
                          ) => (
                            <div
                              key={slotIndex}
                              className="border rounded p-2 bg-muted/30"
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="font-medium">Slot:</span>
                                  <p className="font-mono bg-background px-1 py-0.5 rounded mt-1 break-all">
                                    {slot.slot}
                                  </p>
                                </div>
                                <div>
                                  <span className="font-medium">Value:</span>
                                  <p className="font-mono bg-background px-1 py-0.5 rounded mt-1 break-all">
                                    {slot.value}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Other Parameters */}
      <div>
        <h3 className="font-semibold text-lg mb-4">Simulation Parameters</h3>
        <Card>
          <CardContent className="p-4 space-y-3">
            {params.blockNumber && (
              <div>
                <label
                  htmlFor="block-number"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Block Number
                </label>
                <div className="mt-1">
                  <DecHexToggle
                    value={params.blockNumber}
                    className="font-mono text-sm bg-muted px-2 py-1 rounded"
                  />
                </div>
              </div>
            )}

            {params.blockTag && (
              <div>
                <label
                  htmlFor="block-tag"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Block Tag
                </label>
                <p className="font-mono text-sm bg-muted px-2 py-1 rounded mt-1">
                  {params.blockTag}
                </p>
              </div>
            )}

            {params.account && (
              <div>
                <label
                  htmlFor="account"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Account (for asset tracking)
                </label>
                <p className="font-mono text-sm bg-muted px-2 py-1 rounded mt-1 break-all sm:break-normal">
                  <span className="sm:hidden">{`${params.account.slice(0, 10)}...${params.account.slice(-8)}`}</span>
                  <span className="hidden sm:inline">{params.account}</span>
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {params.traceAssetChanges && (
                <Badge variant="secondary">Asset Tracking</Badge>
              )}
              {params.traceTransfers && (
                <Badge variant="secondary">Transfer Tracking</Badge>
              )}
              {params.validation !== false && (
                <Badge variant="secondary">Validation Enabled</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
