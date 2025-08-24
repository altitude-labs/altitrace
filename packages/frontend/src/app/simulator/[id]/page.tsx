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
  const [traceResult, setTraceResult] =
    useState<EnhancedTraceResult | null>(null)
  const [requestType, setRequestType] = useState<'simulation' | 'trace'>('simulation')

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
        
        // Check if this is a trace request or simulation request
        const isTraceRequest = !!storedSimulation.metadata.traceHash
        setRequestType(isTraceRequest ? 'trace' : 'simulation')
        
        if (isTraceRequest && storedSimulation.metadata.traceHash) {
          
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
          // Execute simulation with trace data on results page
          
          const result = await executeEnhancedSimulation(
            client,
            storedSimulation.request,
          )
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
                    ? (requestType === 'trace' ? 'Tracing Transaction' : 'Executing Simulation')
                    : 'Loading Request'
                  }
                </h3>
                <p className="text-sm text-muted-foreground">
                  {executing
                    ? (requestType === 'trace' 
                        ? 'Tracing original transaction execution...' 
                        : 'Running fresh simulation with trace data...')
                    : 'Loading request parameters...'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !simulation || (!simulationResult && !traceResult)) {
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
                    currentTitle={simulation.metadata?.title || (requestType === 'trace' ? 'Transaction Trace Results' : 'Simulation Results')}
                    onTitleUpdated={handleTitleUpdated}
                    onCancel={handleCancelEdit}
                  />
                ) : (
                  <>
                    <h1 className="text-lg sm:text-xl font-bold truncate min-w-0 flex-1">
                      {simulation.metadata?.title || (requestType === 'trace' ? 'Transaction Trace Results' : 'Simulation Results')}
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
                    (simulationResult?.isSuccess() || traceResult?.success)
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                  }`}
                >
                  {(simulationResult?.isSuccess() || traceResult?.success) ? 'Success' : 'Failed'}
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

        {/* Results Display */}
        {simulationResult && (
          <EnhancedSimulationResults 
            result={simulationResult} 
            simulationRequest={simulation?.request ? {
              ...simulation.request,
              params: {
                ...simulation.request.params,
                calls: simulation.request.params.calls?.map(call => ({
                  to: call.to || '',
                  from: call.from || undefined,
                  data: call.data || undefined,
                  value: call.value || undefined,
                  gas: call.gas || undefined
                })).filter(call => call.to) || []
              }
            } : undefined}
          />
        )}
        
        {traceResult && (() => {
          return (
            <EnhancedSimulationResults 
              result={{
                ...traceResult.traceData,
                // Map trace result to simulation result interface for display compatibility
                status: traceResult.status,
                gasUsed: traceResult.gasUsed.toString(),
                calls: [],
                errors: traceResult.errors,
                traceData: traceResult.traceData,
                hasCallHierarchy: traceResult.hasCallHierarchy,
                hasAccessList: false,
                hasGasComparison: false,
                isSuccess: () => traceResult.success,
                isFailed: () => !traceResult.success,
                getTotalGasUsed: () => traceResult.gasUsed,
                getErrors: () => traceResult.errors,
                getAllLogs: traceResult.traceData.getAllLogs?.bind(traceResult.traceData) || (() => []),
                getLogCount: () => traceResult.traceData.getAllLogs?.()?.length || 0,
                getAssetChangesSummary: () => [],
                // Include receipt data from trace result
                receipt: traceResult.receipt,
                blockNumber: traceResult.receipt?.blockNumber ? `0x${traceResult.receipt.blockNumber.toString(16)}` : undefined,
              } as any}
              simulationRequest={undefined}
              isTraceOnly={true}
            />
          )
        })()}
      </div>
    </div>
  )
}
