'use client'

import type { CallResult, ExtendedSimulationResult } from '@altitrace/sdk/types'
import {
  CheckCircleIcon,
  ClockIcon,
  FuelIcon,
  HashIcon,
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
import { formatWeiValue } from '@/utils/abi'

interface SimulationResultsProps {
  result: ExtendedSimulationResult
}

export function SimulationResults({ result }: SimulationResultsProps) {
  const gasUsedDecimal = Number.parseInt(result.gasUsed, 16)
  const blockNumberDecimal = Number.parseInt(result.blockNumber, 16)

  return (
    <div className="space-y-6">
      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HashIcon className="h-5 w-5" />
            Simulation Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ClockIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Block Number
                </span>
              </div>
              <div className="font-mono text-lg">
                {blockNumberDecimal.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                {result.blockNumber}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FuelIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Gas Used</span>
              </div>
              <div className="font-mono text-lg">
                {gasUsedDecimal.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                {result.gasUsed}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Calls</span>
              </div>
              <div className="font-mono text-lg">
                {result.calls?.length || 0}
              </div>
              <div className="text-xs text-muted-foreground">
                {result.calls?.filter((c: CallResult) => c.status === 'success')
                  .length || 0}{' '}
                successful
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Call Results */}
      <div className="space-y-4">
        {result.calls?.map((call: CallResult, index: number) => (
          <CallResultCard key={index} call={call} />
        ))}
      </div>

      {/* Asset Changes */}
      {result.assetChanges && result.assetChanges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUpIcon className="h-5 w-5" />
              Asset Changes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {result.assetChanges.map((change, index) => (
                <AssetChangeCard key={index} change={change} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface CallResultCardProps {
  call: CallResult
}

function CallResultCard({ call }: CallResultCardProps) {
  const gasUsedDecimal = Number.parseInt(call.gasUsed, 16)
  const isSuccess = call.status === 'success'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircleIcon className="h-5 w-5 text-green-500" />
            ) : (
              <XCircleIcon className="h-5 w-5 text-red-500" />
            )}
            <span>Call #{call.callIndex + 1}</span>
          </div>
          <Badge variant={isSuccess ? 'success' : 'destructive'}>
            {call.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gas Usage */}
        <div>
          <label
            htmlFor="gas-used"
            className="text-sm font-medium text-muted-foreground"
          >
            Gas Used
          </label>
          <div className="font-mono text-sm">
            {gasUsedDecimal.toLocaleString()} ({call.gasUsed})
          </div>
        </div>

        {/* Return Data */}
        <div>
          <label
            htmlFor="return-data"
            className="text-sm font-medium text-muted-foreground"
          >
            Return Data
          </label>
          <div className="bg-muted p-3 rounded font-mono text-sm break-all">
            {call.returnData || '0x'}
          </div>
        </div>

        {/* Error Details */}
        {call.error && (
          <div className="bg-red-50 dark:bg-red-950 p-4 rounded border border-red-200 dark:border-red-800">
            <div className="space-y-2">
              <div>
                <label
                  htmlFor="error-type"
                  className="text-sm font-medium text-red-700 dark:text-red-300"
                >
                  Error Type
                </label>
                <div className="text-sm text-red-600 dark:text-red-400">
                  {call.error.errorType}
                </div>
              </div>

              {call.error.reason && (
                <div>
                  <label
                    htmlFor="error-reason"
                    className="text-sm font-medium text-red-700 dark:text-red-300"
                  >
                    Reason
                  </label>
                  <div className="text-sm text-red-600 dark:text-red-400">
                    {call.error.reason}
                  </div>
                </div>
              )}

              {call.error.message && (
                <div>
                  <label
                    htmlFor="error-message"
                    className="text-sm font-medium text-red-700 dark:text-red-300"
                  >
                    Message
                  </label>
                  <div className="text-sm text-red-600 dark:text-red-400">
                    {call.error.message}
                  </div>
                </div>
              )}

              {call.error.contractAddress && (
                <div>
                  <label
                    htmlFor="error-contract"
                    className="text-sm font-medium text-red-700 dark:text-red-300"
                  >
                    Contract
                  </label>
                  <div className="text-sm text-red-600 dark:text-red-400 font-mono">
                    {call.error.contractAddress}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Event Logs */}
        {call.logs && call.logs.length > 0 && (
          <div>
            <label
              htmlFor="event-logs"
              className="text-sm font-medium text-muted-foreground mb-2 block"
            >
              Event Logs ({call.logs.length})
            </label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {call.logs.map(
                (
                  log: NonNullable<CallResult['logs']>[number],
                  logIndex: number,
                ) => (
                  <div key={logIndex} className="bg-muted p-3 rounded text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs">{log.address}</span>
                      {log.decoded && (
                        <Badge variant="outline" className="text-xs">
                          {log.decoded.name}
                        </Badge>
                      )}
                    </div>

                    {log.decoded ? (
                      <div className="space-y-1">
                        <div className="font-medium">{log.decoded.summary}</div>
                        {log.decoded.standard && (
                          <div className="text-xs text-muted-foreground">
                            Standard: {log.decoded.standard}
                          </div>
                        )}
                        {log.decoded.params.length > 0 && (
                          <div className="space-y-1 mt-2">
                            {log.decoded.params.map(
                              (
                                param: {
                                  name: string
                                  value: string
                                  indexed?: boolean
                                },
                                paramIndex: number,
                              ) => (
                                <div key={paramIndex} className="text-xs">
                                  <span className="font-medium">
                                    {param.name}:
                                  </span>{' '}
                                  {param.value}
                                  {param.indexed && (
                                    <Badge
                                      variant="outline"
                                      className="ml-1 text-xs"
                                    >
                                      indexed
                                    </Badge>
                                  )}
                                </div>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-xs">
                          <span className="font-medium">Topics:</span>{' '}
                          {log.topics.length}
                        </div>
                        <div className="text-xs font-mono break-all">
                          {log.data}
                        </div>
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface AssetChangeCardProps {
  change: NonNullable<ExtendedSimulationResult['assetChanges']>[0]
}

function AssetChangeCard({ change }: AssetChangeCardProps) {
  if (!change) return null

  const preValue = BigInt(change.value.pre)
  const postValue = BigInt(change.value.post)
  const diffValue = BigInt(change.value.diff)
  const isPositive = diffValue > 0n
  const isNegative = diffValue < 0n

  const formatBalance = (value: bigint) => {
    const decimals = change.token.decimals || 18
    return formatWeiValue(value.toString(), decimals)
  }

  return (
    <div className="bg-muted p-4 rounded border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="font-mono text-sm">{change.token.address}</div>
          {change.token.symbol && (
            <Badge variant="outline">{change.token.symbol}</Badge>
          )}
        </div>

        <div className="flex items-center gap-1 text-sm">
          {isPositive && <TrendingUpIcon className="h-4 w-4 text-green-500" />}
          {isNegative && <TrendingDownIcon className="h-4 w-4 text-red-500" />}
          <span
            className={
              isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : ''
            }
          >
            {isPositive && '+'}
            {formatBalance(diffValue)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Before:</span>
          <div className="font-mono">{formatBalance(preValue)}</div>
        </div>
        <div>
          <span className="text-muted-foreground">After:</span>
          <div className="font-mono">{formatBalance(postValue)}</div>
        </div>
      </div>
    </div>
  )
}
