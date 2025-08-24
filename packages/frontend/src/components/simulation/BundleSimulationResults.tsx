'use client'

import {
  AlertTriangleIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Clock,
  CopyIcon,
  ExternalLinkIcon,
  Fuel,
  MinusCircleIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  XCircleIcon,
} from 'lucide-react'
import { useState } from 'react'
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import { EnhancedSimulationResults } from '@/components/simulation/EnhancedSimulationResults'
import type { EnhancedBundleSimulationResult } from '@/utils/bundle-execution'
import type { BundleTransactionResult } from '@/types/bundle'
import type { EnhancedSimulationResult } from '@/utils/trace-integration'
import {
  hasPrestateChanges,
  getStateChangesCount,
} from '@/utils/trace-integration'
import { formatWeiValue } from '@/utils/abi'

interface BundleSimulationResultsProps {
  result: EnhancedBundleSimulationResult
  className?: string
}

// Convert a BundleTransactionResult to EnhancedSimulationResult for reusing the rich display
function convertToSimulationResult(
  txResult: BundleTransactionResult,
  index: number,
  bundleId: string,
  blockNumber: string,
): EnhancedSimulationResult {
  return {
    simulationId: `${bundleId}-tx${index}`,
    blockNumber,
    status: txResult.status === 'success' ? 'success' : 'failed',
    gasUsed: txResult.gasUsed,
    blockGasUsed: txResult.gasUsed, // Use transaction gas as block gas for individual display
    calls: [
      {
        callIndex: 0,
        status: txResult.status === 'success' ? 'success' : 'reverted',
        gasUsed: txResult.gasUsed,
        returnData: txResult.returnData || '0x',
        logs: txResult.logs || [],
        error: txResult.error
          ? {
              errorType: txResult.error.type,
              reason: txResult.error.reason,
              message: txResult.error.message,
              contractAddress: null,
            }
          : undefined,
      },
    ],
    assetChanges: txResult.assetChanges || [],
    traceData: txResult.traceData,

    // Helper methods
    isSuccess: () => txResult.status === 'success',
    isFailed: () => txResult.status === 'failed',
    getTotalGasUsed: () => BigInt(txResult.gasUsed),
    getCallGasUsed: (callIndex: number) => BigInt(txResult.gasUsed), // Single call, so always return same gas
    getErrors: () =>
      txResult.error
        ? [
            {
              errorType: txResult.error.type,
              reason: txResult.error.reason,
              message: txResult.error.message,
              contractAddress: null,
            },
          ]
        : [],
    getAssetChangesSummary: () => {
      if (!txResult.assetChanges || txResult.assetChanges.length === 0) {
        return []
      }

      // Convert to AssetChangeSummary format
      return txResult.assetChanges.map((change: any) => ({
        tokenAddress: change.tokenAddress,
        symbol: change.symbol,
        decimals: change.decimals,
        netChange: change.netChange,
        type: change.type as 'gain' | 'loss',
      }))
    },
    getLogCount: () => txResult.logs?.length || 0,
    getDecodedEvents: () => [],

    // Additional properties for enhanced display
    hasCallHierarchy: !!txResult.traceData,
    hasAccessList: false,
    hasGasComparison: false,
    hasStateChanges: (() => {
      const hasPrestate = !!txResult.traceData?.prestateTracer
      if (!hasPrestate || !txResult.traceData) return false

      return hasPrestateChanges(txResult.traceData.prestateTracer)
    })(),
    getStateChangesCount: () =>
      getStateChangesCount(txResult.traceData?.prestateTracer),
  } as unknown as EnhancedSimulationResult
}

/**
 * Bundle asset change card with copy/explorer functionality matching events display
 */
function BundleAssetChangeCard({ change }: { change: any }) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.warn('Failed to copy to clipboard:', error)
    }
  }

  const getExplorerUrl = (address: string) => {
    return `https://hyperevmscan.io/address/${address}`
  }

  const isETH =
    change.tokenAddress === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  const displaySymbol =
    change.symbol && change.symbol !== 'null'
      ? change.symbol
      : isETH
        ? 'HYPE'
        : `Token (${change.tokenAddress.slice(0, 6)}...)`

  return (
    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
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
        <div>
          <div className="flex items-center gap-2">
            <div className="font-medium">{displaySymbol}</div>
            <Badge variant="outline" className="text-xs">
              {isETH ? 'Native' : 'ERC-20'}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {isETH ? (
              <span className="text-sm text-muted-foreground">
                Native Token
              </span>
            ) : (
              <>
                <a
                  href={getExplorerUrl(change.tokenAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-mono text-blue-600 hover:text-blue-800 transition-colors"
                  title={change.tokenAddress}
                >
                  {change.tokenAddress.slice(0, 8)}...
                  {change.tokenAddress.slice(-6)}
                </a>
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
          {change.type === 'gain' ? '+' : '-'}
          {formatWeiValue(change.netChange, change.decimals || 18)}
        </div>
        <div className="text-sm text-muted-foreground">
          {change.decimals || 18} decimals
        </div>
      </div>
    </div>
  )
}

export function BundleSimulationResults({
  result,
  className,
}: BundleSimulationResultsProps) {
  // State for managing collapsed/expanded transactions
  const [expandedTransactions, setExpandedTransactions] = useState<Set<string>>(
    new Set(result.transactionResults.map((tx) => tx.transactionId)), // Start with all expanded
  )

  const toggleTransaction = (txId: string) => {
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

  // Create simulation request for individual transaction to show in Request tab
  const createSimulationRequestForTransaction = (
    txResult: BundleTransactionResult,
    txIndex: number,
  ) => {
    if (!txResult.originalTransaction) return undefined

    return {
      params: {
        calls: [
          {
            to: txResult.originalTransaction.to || '',
            from: txResult.originalTransaction.from || '',
            data: txResult.originalTransaction.data || '0x',
            value: txResult.originalTransaction.value || '0x0',
            gas: txResult.originalTransaction.gas || undefined,
          },
        ],
        account: txResult.originalTransaction.from || '',
        blockNumber: result.blockNumber,
        blockTag: result.blockNumber,
      },
      options: {
        // Include bundle context information
        bundleIndex: txIndex,
        bundleId: result.bundleId,
        bundleContext: true,
      },
    }
  }

  const getBundleStatusIcon = () => {
    if (result.isSuccess()) {
      return <CheckCircleIcon className="h-5 w-5 text-green-600" />
    }
    if (result.isPartialSuccess()) {
      return <AlertTriangleIcon className="h-5 w-5 text-yellow-600" />
    }
    return <XCircleIcon className="h-5 w-5 text-red-600" />
  }

  const getBundleStatusText = () => {
    if (result.isSuccess()) {
      return 'All transactions executed successfully'
    }
    if (result.isPartialSuccess()) {
      return `${result.getSuccessCount()} of ${result.transactionResults.length} transactions succeeded`
    }
    return 'Bundle execution failed'
  }

  const getBundleStatusColor = () => {
    if (result.isSuccess())
      return 'border-green-200 bg-green-100 dark:border-green-700 dark:bg-green-900/20'
    if (result.isPartialSuccess())
      return 'border-yellow-200 bg-yellow-100 dark:border-yellow-700 dark:bg-yellow-900/20'
    return 'border-red-200 bg-red-100 dark:border-red-700 dark:bg-red-900/20'
  }

  return (
    <div className={`space-y-4 sm:space-y-6 ${className}`}>
      {/* Bundle Overview */}
      <Card className={getBundleStatusColor()}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            {getBundleStatusIcon()}
            Bundle Execution Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Bundle ID</p>
              <p className="font-mono text-xs break-all">{result.bundleId}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Block Number</p>
              <p className="font-mono text-sm">{result.blockNumber}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Gas Used</p>
              <div className="flex items-center gap-1">
                <Fuel className="h-3 w-3 text-muted-foreground" />
                <p className="font-mono text-sm">
                  {result.getTotalGasUsed().toLocaleString()}
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Execution Time</p>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <p className="text-sm">{result.executionTimeMs}ms</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm">{getBundleStatusText()}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">
                {result.getSuccessCount()} Success
              </Badge>
              {result.getFailureCount() > 0 && (
                <Badge variant="destructive">
                  {result.getFailureCount()} Failed
                </Badge>
              )}
              {result.transactionResults.filter((tx) => tx.status === 'skipped')
                .length > 0 && (
                <Badge variant="secondary">
                  {
                    result.transactionResults.filter(
                      (tx) => tx.status === 'skipped',
                    ).length
                  }{' '}
                  Skipped
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bundle Errors (if any) */}
      {result.bundleErrors && result.bundleErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertDescription>
            <strong>Bundle Execution Errors:</strong>
            <ul className="mt-1 list-disc list-inside">
              {result.bundleErrors.map((error, index) => (
                <li key={index} className="text-sm">
                  {error}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Transaction Results */}
      <div className="space-y-4 sm:space-y-8">
        <h3 className="font-semibold text-lg">Transaction Results</h3>

        {result.transactionResults.map((txResult, index) => {
          const isExpanded = expandedTransactions.has(txResult.transactionId)

          return (
            <div key={txResult.transactionId} className="border rounded-lg p-1">
              {/* Transaction Header - Clickable */}
              <div
                className="bg-muted/50 px-4 py-3 rounded-t-lg border-b cursor-pointer hover:bg-muted/70 transition-colors"
                onClick={() => toggleTransaction(txResult.transactionId)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDownIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <h4 className="font-semibold text-base">
                      Transaction {index + 1}
                      {txResult.originalTransaction?.to && (
                        <span className="text-sm text-muted-foreground ml-2 hidden sm:inline">
                          → {txResult.originalTransaction.to.slice(0, 8)}...
                        </span>
                      )}
                    </h4>
                  </div>
                  {/* Mobile: Full address on new line, Desktop: Inline */}
                  {txResult.originalTransaction?.to && (
                    <div className="sm:hidden text-xs text-muted-foreground font-mono ml-7">
                      → {txResult.originalTransaction.to.slice(0, 12)}...
                      {txResult.originalTransaction.to.slice(-8)}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 sm:ml-0 ml-7">
                    {txResult.status === 'success' && (
                      <Badge variant="success">Success</Badge>
                    )}
                    {txResult.status === 'failed' && (
                      <Badge variant="destructive">Failed</Badge>
                    )}
                    {txResult.status === 'skipped' && (
                      <Badge variant="secondary">Skipped</Badge>
                    )}
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      Gas: {BigInt(txResult.gasUsed).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Transaction Content - Collapsible */}
              {isExpanded && (
                <>
                  {/* Full Simulation Results for this Transaction */}
                  {txResult.status !== 'skipped' && (
                    <div className="p-4">
                      <EnhancedSimulationResults
                        result={convertToSimulationResult(
                          txResult,
                          index,
                          result.bundleId,
                          result.blockNumber,
                        )}
                        simulationRequest={createSimulationRequestForTransaction(
                          txResult,
                          index,
                        )}
                      />
                    </div>
                  )}

                  {/* Skipped Transaction Info */}
                  {txResult.status === 'skipped' && (
                    <div className="p-4 text-center text-muted-foreground">
                      <p>
                        Transaction was skipped due to previous failure in
                        bundle
                      </p>
                      {txResult.originalTransaction && (
                        <div className="mt-2 text-xs">
                          <p>
                            Intended target: {txResult.originalTransaction.to}
                          </p>
                          {txResult.originalTransaction.data && (
                            <p>
                              Call data:{' '}
                              {txResult.originalTransaction.data.slice(0, 20)}
                              ...
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Bundle Asset Changes */}
      {result.bundleAssetChanges && result.bundleAssetChanges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Bundle Asset Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Asset changes across the entire bundle execution
            </p>
            <div className="space-y-4">
              {result.bundleAssetChanges.map((change, index) => (
                <BundleAssetChangeCard
                  key={`bundle-asset-${change.tokenAddress}-${change.type}-${index}`}
                  change={change}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
