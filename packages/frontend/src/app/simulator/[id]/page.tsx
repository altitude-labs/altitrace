'use client'

import {
  ArrowLeftIcon,
  ClockIcon,
  DownloadIcon,
  EditIcon,
  PencilIcon,
  ShareIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { EnhancedSimulationResults } from '@/components/simulation/EnhancedSimulationResults'
import { InlineTitleEditor } from '@/components/simulation/InlineTitleEditor'
import { Alert, AlertDescription, Button } from '@/components/ui'
import { createAltitraceClient } from '@/utils/client'
import type { StoredSimulation } from '@/utils/storage'
import { exportSimulation, retrieveById, updateResult } from '@/utils/storage'
import {
  type EnhancedSimulationResult,
  type EnhancedTraceResult,
  executeEnhancedSimulation,
  executeTransactionTrace,
} from '@/utils/trace-integration'
import {
  executeBundleSimulation,
  enhanceBundleSimulationResult,
  type EnhancedBundleSimulationResult,
} from '@/utils/bundle-execution'
import { BundleSimulationResults } from '@/components/simulation/BundleSimulationResults'

/**
 * Create synthetic "calls" from trace data so EventsBreakdown can display logs
 */
function createCallsFromTraceData(traceData: any): any[] {
  if (!traceData?.callTracer?.rootCall) {
    return []
  }

  // Recursively collect all logs from all nested calls
  function collectAllLogs(call: any): any[] {
    const logs = [...(call.logs || [])]

    if (call.calls && call.calls.length > 0) {
      for (const nestedCall of call.calls) {
        logs.push(...collectAllLogs(nestedCall))
      }
    }

    return logs
  }

  const rootCall = traceData.callTracer.rootCall
  const allLogs = collectAllLogs(rootCall)

  // Create a call object that mimics the CallResult interface
  const call = {
    callIndex: 0,
    status: rootCall.reverted ? 'failed' : 'success',
    gasUsed: rootCall.gasUsed || '0',
    to: rootCall.to || '',
    from: rootCall.from || '',
    input: rootCall.input || '0x',
    output: rootCall.output || '0x',
    value: rootCall.value || '0x0',
    logs: allLogs, // Use all collected logs instead of just rootCall.logs
    calls: [],
    error: rootCall.error || undefined,
  }

  return [call]
}

interface ResultsViewerProps {
  params: Promise<{
    id: string
  }>
}

export default function ResultsViewer({ params }: ResultsViewerProps) {
  const router = useRouter()
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(
    null,
  )
  const [simulation, setSimulation] = useState<StoredSimulation | null>(null)
  const [simulationResult, setSimulationResult] =
    useState<EnhancedSimulationResult | null>(null)
  const [bundleResult, setBundleResult] =
    useState<EnhancedBundleSimulationResult | null>(null)
  const [traceResult, setTraceResult] = useState<EnhancedTraceResult | null>(
    null,
  )
  const [requestType, setRequestType] = useState<
    'simulation' | 'trace' | 'bundle'
  >('simulation')

  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditingTitle, setIsEditingTitle] = useState(false)

  useEffect(() => {
    params.then(setResolvedParams)
  }, [params])

  useEffect(() => {
    if (!resolvedParams) return

    const loadAndExecuteSimulation = async () => {
      setLoading(true)
      setError(null)

      try {
        // Load simulation parameters
        const storedSimulation = retrieveById(resolvedParams.id)

        if (!storedSimulation) {
          setError('Simulation not found')
          setLoading(false)
          return
        }

        setSimulation(storedSimulation)
        setExecuting(true)

        const client = createAltitraceClient()

        // Check request type: bundle simulation, trace request, or single simulation
        const isTraceRequest = !!storedSimulation.metadata.traceHash
        const isBundleRequest = storedSimulation.request.type === 'bundle'

        if (isBundleRequest) {
          // Bundle simulation
          setRequestType('bundle')
          console.log('🔗 [Results Page] Executing bundle simulation...')
          const bundleReq = storedSimulation.request as any
          console.log(
            '   Bundle transactions:',
            bundleReq.bundleRequest?.transactions?.length || 0,
          )

          const bundleResult = await executeBundleSimulation(
            client,
            bundleReq.bundleRequest,
          )

          const enhancedBundleResult =
            enhanceBundleSimulationResult(bundleResult)

          console.log('📬 [Bundle Results] Bundle simulation completed:')
          console.log('   Bundle status:', enhancedBundleResult.bundleStatus)
          console.log(
            '   Success count:',
            enhancedBundleResult.getSuccessCount(),
          )
          console.log(
            '   Failure count:',
            enhancedBundleResult.getFailureCount(),
          )
          console.log(
            '   Total gas used:',
            enhancedBundleResult.getTotalGasUsed(),
          )

          setBundleResult(enhancedBundleResult)

          // Save result data to storage for status display in the history
          const resultData: StoredSimulation['result'] = {
            status: enhancedBundleResult.bundleStatus as any,
            gasUsed: enhancedBundleResult.getTotalGasUsed(),
            callsCount: enhancedBundleResult.transactionResults.length,
            hasErrors:
              enhancedBundleResult.isFailed() ||
              enhancedBundleResult.isPartialSuccess(),
          }
          updateResult(resolvedParams.id, resultData)
        } else if (isTraceRequest && storedSimulation.metadata.traceHash) {
          // Transaction trace
          setRequestType('trace')
          console.log('🔍 [Results Page] Executing transaction trace...')
          console.log(
            '   Transaction hash:',
            storedSimulation.metadata.traceHash,
          )

          const result = await executeTransactionTrace(
            client,
            storedSimulation.metadata.traceHash,
          )

          setTraceResult(result)

          // Save result data to storage for status display in the history
          const resultData: StoredSimulation['result'] = {
            status: result.status as any,
            gasUsed: result.gasUsed,
            callsCount: result.traceData.callTracer?.rootCall ? 1 : 0,
            hasErrors: !result.success,
          }
          updateResult(resolvedParams.id, resultData)
        } else {
          // Single simulation
          setRequestType('simulation')
          console.log('🚀 [Results Page] Executing single simulation...')
          const singleReq = storedSimulation.request as any
          console.log('   Request params:', singleReq.params)
          console.log('   Options:', singleReq.options)

          const result = await executeEnhancedSimulation(client, singleReq)

          console.log('📬 [Results Page] Simulation completed:')
          console.log('   Success:', result.isSuccess())
          console.log('   Status:', result.status)
          if (result.isSuccess()) {
            console.log('   Gas used:', result.getTotalGasUsed())
            console.log('✅ [Results Page] Displaying successful results')
          } else {
            console.log('   Errors:', result.getErrors())
            console.log('❌ [Results Page] Displaying error results')
          }

          setSimulationResult(result)

          // Save result data to storage for status display in the history
          const resultData: StoredSimulation['result'] = {
            status: result.status,
            gasUsed: result.getTotalGasUsed(),
            callsCount: result.calls?.length || 0,
            hasErrors: result.isFailed(),
          }
          updateResult(resolvedParams.id, resultData)
        }

        // Auto-switch to trace tab if we have call hierarchy
      } catch (err) {
        setError(`An unexpected error occurred: ${err}`)
      } finally {
        setLoading(false)
        setExecuting(false)
      }
    }

    loadAndExecuteSimulation()
  }, [resolvedParams])

  const handleShare = async () => {
    if (!resolvedParams) return
    const url = `${window.location.origin}/simulator/${resolvedParams.id}`
    try {
      await navigator.clipboard.writeText(url)
      // TODO: Add toast notification
    } catch (_e) {}
  }

  const handleRerun = () => {
    if (simulation) {
      // Navigate to new simulation with pre-filled data
      router.push(`/simulator/new?rerun=${simulation.id}`)
    }
  }

  const handleExport = async () => {
    if (resolvedParams && simulationResult) {
      try {
        const client = createAltitraceClient()

        const exportData = await exportSimulation(
          resolvedParams.id,
          (request) => executeEnhancedSimulation(client, request),
        )

        if (exportData) {
          const blob = new Blob([exportData], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `simulation-${resolvedParams.id}.json`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }
      } catch (_error) {
        setError('Failed to export simulation')
      }
    }
  }

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleString()
  }

  const handleEditTitle = () => {
    setIsEditingTitle(true)
  }

  const handleTitleUpdated = (newTitle: string) => {
    if (simulation) {
      setSimulation({
        ...simulation,
        metadata: {
          ...simulation.metadata,
          title: newTitle,
        },
      })
    }
    setIsEditingTitle(false)
  }

  const handleCancelEdit = () => {
    setIsEditingTitle(false)
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-48 sm:h-64">
            <div className="text-center space-y-4">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <div>
                <h3 className="text-base sm:text-lg font-semibold">
                  {executing
                    ? requestType === 'trace'
                      ? 'Tracing Transaction'
                      : 'Executing Simulation'
                    : 'Loading Request'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {executing
                    ? requestType === 'trace'
                      ? 'Tracing original transaction execution...'
                      : 'Running fresh simulation with trace data...'
                    : 'Loading request parameters...'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (
    error ||
    !simulation ||
    (!simulationResult && !bundleResult && !traceResult)
  ) {
    return (
      <div className="p-4 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/simulator')}
            >
              <ArrowLeftIcon className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Back to Simulator</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </div>

          <Alert variant="destructive">
            <AlertDescription className="text-sm">
              {error || 'Simulation not found'}
            </AlertDescription>
          </Alert>

          <div className="text-center">
            <Button onClick={() => router.push('/simulator/new')} size="sm">
              Create New Simulation
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* Header with Navigation and Actions */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/simulator')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Back to Simulator</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                {isEditingTitle && resolvedParams ? (
                  <InlineTitleEditor
                    simulationId={resolvedParams.id}
                    currentTitle={
                      simulation.metadata?.title ||
                      (requestType === 'trace'
                        ? 'Transaction Execution Results'
                        : 'Simulation Results')
                    }
                    onTitleUpdated={handleTitleUpdated}
                    onCancel={handleCancelEdit}
                  />
                ) : (
                  <>
                    <h1 className="text-lg sm:text-xl font-bold truncate min-w-0 flex-1">
                      {simulation.metadata?.title ||
                        (requestType === 'trace'
                          ? 'Transaction Execution Results'
                          : 'Simulation Results')}
                    </h1>
                    <button
                      onClick={handleEditTitle}
                      className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
                      title="Edit title"
                    >
                      <PencilIcon className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <ClockIcon className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="text-xs sm:text-sm">
                    {formatTimestamp(simulation.timestamp)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm">ID:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                    {resolvedParams?.id.slice(0, 8) || '...'}...
                  </code>
                </div>
                <div
                  className={`px-2 py-1 rounded-full text-xs self-start ${
                    bundleResult
                      ? bundleResult.isSuccess()
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                        : bundleResult.isPartialSuccess()
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                      : (simulationResult?.isSuccess() || traceResult?.success)
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                  }`}
                >
                  {bundleResult
                    ? bundleResult.isSuccess()
                      ? 'Bundle Success'
                      : bundleResult.isPartialSuccess()
                        ? 'Partial Success'
                        : 'Bundle Failed'
                    : traceResult
                      ? traceResult.success
                        ? 'Trace Success'
                        : 'Trace Failed'
                      : simulationResult?.isSuccess()
                        ? 'Success'
                        : 'Failed'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="flex-1 sm:flex-none"
              >
                <ShareIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                <span className="hidden sm:inline">Share</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="flex-1 sm:flex-none"
              >
                <DownloadIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                <span className="hidden sm:inline">Export</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRerun}
                className="flex-1 sm:flex-none"
              >
                <EditIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Results Display - Conditional based on simulation type */}
        {bundleResult ? (
          <BundleSimulationResults result={bundleResult} />
        ) : traceResult ? (
          <EnhancedSimulationResults
            result={
              {
                ...traceResult.traceData,
                // Map trace result to simulation result interface for display compatibility
                status: traceResult.status,
                gasUsed: traceResult.gasUsed.toString(),
                calls: createCallsFromTraceData(traceResult.traceData),
                errors: traceResult.errors,
                traceData: traceResult.traceData,
                hasCallHierarchy: traceResult.hasCallHierarchy,
                hasAccessList: false,
                hasGasComparison: false,
                isSuccess: () => traceResult.success,
                isFailed: () => !traceResult.success,
                getTotalGasUsed: () => traceResult.gasUsed,
                getErrors: () => traceResult.errors,
                getAllLogs:
                  traceResult.traceData.getAllLogs?.bind(
                    traceResult.traceData,
                  ) || (() => []),
                getLogCount: () =>
                  traceResult.traceData.getAllLogs?.()?.length || 0,
                getAssetChangesSummary: () => [],
                // Include receipt data from trace result
                receipt: traceResult.receipt,
                blockNumber: traceResult.receipt?.blockNumber
                  ? `0x${traceResult.receipt.blockNumber.toString(16)}`
                  : undefined,
                // Include auto-fetched ABI information for enhanced event decoding
                combinedABI: traceResult.combinedABI,
                fetchedContracts: traceResult.fetchedContracts,
              } as any
            }
            simulationRequest={undefined}
            isTraceOnly={true}
          />
        ) : simulationResult ? (
          <EnhancedSimulationResults
            result={simulationResult}
            simulationRequest={
              simulation?.request && requestType === 'simulation'
                ? {
                    ...(simulation.request as any),
                    params: {
                      ...(simulation.request as any).params,
                      calls:
                        (simulation.request as any).params?.calls
                          ?.map((call: any) => ({
                            to: call.to || '',
                            from: call.from || undefined,
                            data: call.data || undefined,
                            value: call.value || undefined,
                            gas: call.gas || undefined,
                          }))
                          .filter((call: any) => call.to) || [],
                    },
                  }
                : undefined
            }
          />
        ) : null}
      </div>
    </div>
  )
}
