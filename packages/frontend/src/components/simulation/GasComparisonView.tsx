'use client'

import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CheckCircleIcon,
  FuelIcon,
  SparklesIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  XCircleIcon,
} from 'lucide-react'
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import type { GasComparisonAnalysis } from '@/utils/trace-integration'

interface GasComparisonViewProps {
  gasComparison: GasComparisonAnalysis
}

export function GasComparisonView({ gasComparison }: GasComparisonViewProps) {
  const { comparison, originalSimulation, optimizedSimulation } = gasComparison

  return (
    <div className="space-y-6">
      {/* Comparison Overview */}
      <ComparisonOverview comparison={comparison} />

      {/* Detailed Analysis */}
      {comparison.status === 'success' && optimizedSimulation && (
        <DetailedAnalysis
          originalSimulation={originalSimulation}
          optimizedSimulation={optimizedSimulation}
          comparison={comparison}
        />
      )}

      {/* Error Display */}
      {comparison.status === 'failed' && (
        <ErrorDisplay error={comparison.error || 'Unknown error occurred'} />
      )}

      {/* Recommendation */}
      <RecommendationDisplay recommendation={comparison.recommendation} />
    </div>
  )
}

interface ComparisonOverviewProps {
  comparison: GasComparisonAnalysis['comparison']
}

function ComparisonOverview({ comparison }: ComparisonOverviewProps) {
  const formatGas = (gas: bigint) => Number(gas).toLocaleString()
  const hasOptimized = comparison.optimizedGasUsed !== undefined
  const gasSaved = comparison.gasDifference ? -comparison.gasDifference : 0n
  const isSaving = gasSaved > 0n
  const isOverhead = gasSaved < 0n

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FuelIcon className="h-5 w-5" />
          Gas Usage Comparison
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Original Gas Usage */}
          <div className="text-center space-y-2">
            <div className="text-sm text-muted-foreground">
              Original Simulation
            </div>
            <div className="text-2xl font-bold font-mono">
              {formatGas(comparison.originalGasUsed)}
            </div>
            <Badge variant="secondary">Without Access List</Badge>
          </div>

          {/* Arrow/Status */}
          <div className="flex items-center justify-center">
            {hasOptimized ? (
              <div className="flex flex-col items-center space-y-2">
                {isSaving ? (
                  <ArrowDownIcon className="h-8 w-8 text-green-500" />
                ) : isOverhead ? (
                  <ArrowUpIcon className="h-8 w-8 text-red-500" />
                ) : (
                  <ArrowRightIcon className="h-8 w-8 text-muted-foreground" />
                )}
                <div className="text-xs text-center">
                  {isSaving && (
                    <span className="text-green-600 font-medium">
                      -{formatGas(gasSaved)} gas saved
                    </span>
                  )}
                  {isOverhead && (
                    <span className="text-red-600 font-medium">
                      +{formatGas(-gasSaved)} gas overhead
                    </span>
                  )}
                  {!isSaving && !isOverhead && (
                    <span className="text-muted-foreground">
                      No significant difference
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <XCircleIcon className="h-8 w-8 text-red-500" />
                <div className="text-xs text-red-600">Optimization Failed</div>
              </div>
            )}
          </div>

          {/* Optimized Gas Usage */}
          <div className="text-center space-y-2">
            <div className="text-sm text-muted-foreground">
              Optimized Simulation
            </div>
            {hasOptimized ? (
              <>
                <div className="text-2xl font-bold font-mono">
                  {formatGas(comparison.optimizedGasUsed!)}
                </div>
                <Badge variant="default">With Access List</Badge>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold font-mono text-muted-foreground">
                  N/A
                </div>
                <Badge variant="destructive">Failed</Badge>
              </>
            )}
          </div>
        </div>

        {/* Percentage Change */}
        {hasOptimized && comparison.percentageChange !== undefined && (
          <div className="mt-6 pt-6 border-t text-center">
            <div className="text-sm text-muted-foreground mb-2">
              Percentage Change
            </div>
            <div
              className={`text-3xl font-bold ${
                comparison.percentageChange < 0
                  ? 'text-green-600'
                  : comparison.percentageChange > 0
                    ? 'text-red-600'
                    : 'text-muted-foreground'
              }`}
            >
              {comparison.percentageChange > 0 ? '+' : ''}
              {comparison.percentageChange.toFixed(2)}%
            </div>
            {Math.abs(comparison.percentageChange) > 0.01 && (
              <div className="text-xs text-muted-foreground mt-1">
                {comparison.percentageChange < 0
                  ? 'Gas savings'
                  : 'Gas overhead'}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface DetailedAnalysisProps {
  originalSimulation: any
  optimizedSimulation: any
  comparison: GasComparisonAnalysis['comparison']
}

function DetailedAnalysis({
  originalSimulation,
  optimizedSimulation,
  comparison,
}: DetailedAnalysisProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SparklesIcon className="h-5 w-5" />
          Detailed Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Original Simulation Details */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">
              Original Simulation
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Status:</span>
                <Badge
                  variant={
                    originalSimulation.isSuccess() ? 'default' : 'destructive'
                  }
                  className="text-xs"
                >
                  {originalSimulation.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Gas Used:</span>
                <span className="font-mono">
                  {Number(comparison.originalGasUsed).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Calls:</span>
                <span>{originalSimulation.calls?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Access List:</span>
                <span className="text-muted-foreground">None</span>
              </div>
            </div>
          </div>

          {/* Optimized Simulation Details */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">
              Optimized Simulation
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Status:</span>
                <Badge
                  variant={
                    optimizedSimulation.isSuccess() ? 'default' : 'destructive'
                  }
                  className="text-xs"
                >
                  {optimizedSimulation.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Gas Used:</span>
                <span className="font-mono">
                  {Number(comparison.optimizedGasUsed!).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Calls:</span>
                <span>{optimizedSimulation.calls?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Access List:</span>
                <CheckCircleIcon className="h-4 w-4 text-green-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Gas Difference Breakdown */}
        {comparison.gasDifference !== undefined && (
          <div className="mt-6 pt-6 border-t">
            <h4 className="font-medium text-sm text-muted-foreground mb-4">
              Gas Impact Analysis
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-lg font-bold">
                  {Number(comparison.gasDifference).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  Gas Difference
                </div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-lg font-bold">
                  {comparison.percentageChange?.toFixed(3)}%
                </div>
                <div className="text-xs text-muted-foreground">
                  Percentage Change
                </div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-lg font-bold">
                  {comparison.isBeneficial ? 'Yes' : 'No'}
                </div>
                <div className="text-xs text-muted-foreground">Beneficial</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface ErrorDisplayProps {
  error: string
}

function ErrorDisplay({ error }: ErrorDisplayProps) {
  return (
    <Card className="border-red-200 bg-red-50 dark:bg-red-950">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
          <XCircleIcon className="h-5 w-5" />
          Optimization Failed
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 rounded border text-xs text-red-700 dark:text-red-300">
          <strong>Note:</strong> The original simulation was successful, but we
          couldn't generate an optimized version with the access list. This
          could be due to:
          <ul className="mt-2 ml-4 list-disc space-y-1">
            <li>Access list generation failed</li>
            <li>Optimized simulation execution failed</li>
            <li>Network or API issues</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

interface RecommendationDisplayProps {
  recommendation: GasComparisonAnalysis['comparison']['recommendation']
}

function RecommendationDisplay({ recommendation }: RecommendationDisplayProps) {
  const recommendations = {
    'use-access-list': {
      icon: TrendingDownIcon,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950/20',
      borderColor: 'border-green-200 dark:border-green-800',
      title: '✅ Recommended: Use Access List',
      description:
        'This transaction would benefit significantly from using an access list. Include the access list when submitting this transaction to save gas.',
    },
    'skip-access-list': {
      icon: TrendingUpIcon,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-950/20',
      borderColor: 'border-red-200 dark:border-red-800',
      title: '❌ Not Recommended: Skip Access List',
      description:
        'This transaction would cost more gas with an access list due to overhead. Submit the transaction without an access list.',
    },
    neutral: {
      icon: ArrowRightIcon,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/50',
      borderColor: 'border',
      title: '⚪ Neutral: Minor Impact',
      description:
        'The access list has minimal impact on gas usage. You can use it or skip it based on your preference.',
    },
    unknown: {
      icon: AlertTriangleIcon,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-950/20',
      borderColor: 'border-orange-200 dark:border-orange-800',
      title: '❓ Unknown: Cannot Determine',
      description:
        "We couldn't determine the gas impact due to optimization failures. The original simulation data is still available.",
    },
  }

  const rec = recommendations[recommendation]

  return (
    <Card className={`${rec.bgColor} ${rec.borderColor}`}>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 ${rec.color}`}>
          <rec.icon className="h-5 w-5" />
          Recommendation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <h4 className={`font-medium ${rec.color}`}>{rec.title}</h4>
          <p className="text-sm text-muted-foreground">{rec.description}</p>

          {recommendation === 'use-access-list' && (
            <div className="mt-4 p-3 bg-background border rounded text-xs">
              <strong>Implementation Tips:</strong>
              <ul className="mt-2 ml-4 list-disc space-y-1 text-muted-foreground">
                <li>
                  Copy the access list from the "Raw Access List" section below
                </li>
                <li>
                  Include it in your transaction as the `accessList` parameter
                </li>
                <li>
                  Most wallets and libraries support EIP-2930 access lists
                </li>
                <li>
                  The gas savings will apply when the transaction is mined
                </li>
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
