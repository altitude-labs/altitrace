'use client'

import type { CallResult } from '@altitrace/sdk/types'
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  CoinsIcon,
  FuelIcon,
  HashIcon,
  KeyIcon,
  ListIcon,
  TreePineIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  XCircleIcon,
} from 'lucide-react'
import { useState } from 'react'
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
import type { EnhancedSimulationResult } from '@/utils/trace-integration'
import { AccessListView } from './AccessListView'
import { EnhancedEventDisplay } from './EnhancedEventDisplay'
import { EnhancedGasAnalysis } from './EnhancedGasAnalysis'

interface EnhancedSimulationResultsProps {
  result: EnhancedSimulationResult
}

export function EnhancedSimulationResults({
  result,
}: EnhancedSimulationResultsProps) {
  const [activeTab, setActiveTab] = useState('overview')

  // Use SDK helper methods
  const isSuccess = result.isSuccess()
  const logCount = result.getLogCount()
  const assetChanges = result.getAssetChangesSummary()

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
      disabled: false, // Always enabled since asset tracking is auto-enabled
    },
  ]

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <SimulationQuickStats result={result} />

      {/* Main Content Tabs */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircleIcon className="h-5 w-5 text-green-500" />
            ) : (
              <XCircleIcon className="h-5 w-5 text-red-500" />
            )}
            Simulation Results
            <Badge
              variant={isSuccess ? 'default' : 'destructive'}
              className="ml-2"
            >
              {result.status}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-6">
              {tabConfig.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  disabled={tab.disabled}
                  className="flex items-center gap-1 text-xs"
                >
                  <tab.icon className="h-3 w-3" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.count !== null && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {tab.count}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="mt-6">
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

              <TabsContent value="events">
                <EventsBreakdown result={result} />
              </TabsContent>

              <TabsContent value="assets">
                <AssetChangesBreakdown result={result} />
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
}: {
  result: EnhancedSimulationResult
}) {
  const blockNumberDecimal = Number.parseInt(result.blockNumber, 16)
  const gasUsedDecimal = Number(result.getTotalGasUsed())

  // Smart call count: use trace data if available, fallback to simulation calls
  const callCount = result.hasCallHierarchy
    ? result.traceData?.getCallCount() || result.calls?.length || 0
    : result.calls?.length || 0

  // Event count from simulation data
  const eventCount =
    result.calls?.reduce(
      (sum: number, call) => sum + (call.logs?.length || 0),
      0,
    ) || 0

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card
        className={`${result.isSuccess() ? 'border-green-200' : 'border-red-200'}`}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="flex items-center gap-2">
                {result.isSuccess() ? (
                  <CheckCircleIcon className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircleIcon className="h-4 w-4 text-red-500" />
                )}
                <p className="text-lg font-bold">{result.status}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Gas Used</p>
              <p className="text-xl font-bold">
                {gasUsedDecimal.toLocaleString()}
              </p>
            </div>
            <FuelIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {result.hasCallHierarchy
                  ? 'Total Calls (Trace)'
                  : 'Transaction Calls'}
              </p>
              <p className="text-xl font-bold">{callCount}</p>
              {result.hasCallHierarchy && (
                <Badge variant="secondary" className="text-xs mt-1">
                  Enhanced
                </Badge>
              )}
            </div>
            <TreePineIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Events</p>
              <p className="text-xl font-bold">{eventCount}</p>
              <p className="text-xs text-muted-foreground">
                Block #{blockNumberDecimal.toLocaleString()}
              </p>
            </div>
            <ListIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SimulationOverview({ result }: { result: EnhancedSimulationResult }) {
  const errors = result.getErrors()
  const assetChanges = result.getAssetChangesSummary()

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
      {errors.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangleIcon className="h-4 w-4" />
              Errors ({errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {errors.map((error, index: number) => (
                <div
                  key={`error-${error.reason || error.message || index}`}
                  className="text-sm text-red-600 dark:text-red-400"
                >
                  {error.reason || error.message || 'Unknown error'}
                </div>
              ))}
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
                      {change.netChange}
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
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
            ) : (
              <XCircleIcon className="h-4 w-4 text-red-500" />
            )}
            <span>Call #{callIndex + 1}</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={isSuccess ? 'default' : 'destructive'}>
              {call.status}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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

  return (
    <div className="space-y-4">
      {result.calls.map(
        (call, index: number) =>
          call.logs &&
          call.logs.length > 0 && (
            <EnhancedEventDisplay
              key={`event-${call.status}-${index}`}
              call={call}
              callIndex={index}
            />
          ),
      )}
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
            Asset Tracking Configuration
          </h3>
          <p className="text-sm max-w-md mx-auto">
            Asset tracking parameters are being sent with the simulation
            request. The backend may still be implementing full asset change
            detection.
          </p>
        </div>
        <div className="bg-muted/50 p-4 rounded-lg max-w-lg mx-auto text-xs">
          <p className="font-medium mb-2">📋 Current Status:</p>
          <ul className="text-left space-y-1">
            <li>
              •{' '}
              <code className="bg-background px-1 rounded">
                traceAssetChanges: true
              </code>
            </li>
            <li>
              •{' '}
              <code className="bg-background px-1 rounded">
                traceTransfers: true
              </code>
            </li>
            <li>• Account tracking: Auto-detected from transaction</li>
            <li>
              • Backend response:{' '}
              <code className="bg-background px-1 rounded">
                assetChanges: undefined
              </code>
            </li>
          </ul>
          <p className="mt-3 text-muted-foreground">
            💡 Check the Events tab for token transfer events which may contain
            balance change information.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {assetChanges.map((change, index: number) => (
        <Card key={`${change.tokenAddress}-${change.type}-${index}`}>
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
                <div>
                  <div className="font-medium">{change.symbol}</div>
                  <div className="text-sm text-muted-foreground">
                    {change.tokenAddress}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-lg font-semibold ${
                    change.type === 'gain' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {change.netChange}
                </div>
                <div className="text-sm text-muted-foreground">
                  {change.decimals} decimals
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
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
