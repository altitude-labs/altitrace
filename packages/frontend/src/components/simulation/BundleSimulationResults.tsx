'use client'

import {
  AlertTriangleIcon,
  CheckCircleIcon,
  Clock,
  Fuel,
  MinusCircleIcon,
  XCircleIcon,
} from 'lucide-react'
import {
  Alert,
  AlertDescription,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import { EnhancedSimulationResults } from '@/components/simulation/EnhancedSimulationResults'
import type { EnhancedBundleSimulationResult } from '@/utils/bundle-execution'
import type { BundleTransactionResult } from '@/types/bundle'
import type { EnhancedSimulationResult } from '@/utils/trace-integration'

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
    getAssetChangesSummary: () => [],
    getLogCount: () => txResult.logs?.length || 0,
    getDecodedEvents: () => [],

    // Additional properties for enhanced display
    hasCallHierarchy: !!txResult.traceData,
    hasAccessList: false,
    hasGasComparison: false,
  } as unknown as EnhancedSimulationResult
}

export function BundleSimulationResults({
  result,
  className,
}: BundleSimulationResultsProps) {
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
    if (result.isSuccess()) return 'border-green-200 bg-green-100 dark:border-green-700 dark:bg-green-900/20'
    if (result.isPartialSuccess()) return 'border-yellow-200 bg-yellow-100 dark:border-yellow-700 dark:bg-yellow-900/20'
    return 'border-red-200 bg-red-100 dark:border-red-700 dark:bg-red-900/20'
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Bundle Overview */}
      <Card className={getBundleStatusColor()}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            {getBundleStatusIcon()}
            Bundle Execution Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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

          <div className="flex items-center justify-between">
            <p className="text-sm">{getBundleStatusText()}</p>
            <div className="flex gap-2">
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
      <div className="space-y-8">
        <h3 className="font-semibold text-lg">Transaction Results</h3>

        {result.transactionResults.map((txResult, index) => (
          <div key={txResult.transactionId} className="border rounded-lg p-1">
            {/* Transaction Header */}
            <div className="bg-muted/50 px-4 py-3 rounded-t-lg border-b">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-base">
                  Transaction {index + 1}
                  {txResult.originalTransaction?.to && (
                    <span className="text-sm text-muted-foreground ml-2">
                      → {txResult.originalTransaction.to.slice(0, 8)}...
                    </span>
                  )}
                </h4>
                <div className="flex items-center gap-2">
                  {txResult.status === 'success' && (
                    <Badge variant="success">Success</Badge>
                  )}
                  {txResult.status === 'failed' && (
                    <Badge variant="destructive">Failed</Badge>
                  )}
                  {txResult.status === 'skipped' && (
                    <Badge variant="secondary">Skipped</Badge>
                  )}
                  <span className="text-sm text-muted-foreground">
                    Gas: {BigInt(txResult.gasUsed).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

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
                />
              </div>
            )}

            {/* Skipped Transaction Info */}
            {txResult.status === 'skipped' && (
              <div className="p-4 text-center text-muted-foreground">
                <p>Transaction was skipped due to previous failure in bundle</p>
                {txResult.originalTransaction && (
                  <div className="mt-2 text-xs">
                    <p>Intended target: {txResult.originalTransaction.to}</p>
                    {txResult.originalTransaction.data && (
                      <p>
                        Call data:{' '}
                        {txResult.originalTransaction.data.slice(0, 20)}...
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bundle Asset Changes */}
      {result.bundleAssetChanges && result.bundleAssetChanges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Bundle Asset Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Asset changes across the entire bundle execution
            </p>
            {/* Bundle-level asset changes would be displayed here */}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
