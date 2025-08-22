'use client'

import {
  AltitraceApiError,
  AltitraceClient,
  AltitraceNetworkError,
  ValidationError as SdkValidationError,
} from '@altitrace/sdk'
import {
  ArrowLeftIcon,
  ClockIcon,
  DownloadIcon,
  EditIcon,
  ShareIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Layout } from '@/components/layout'
import { EnhancedSimulationResults } from '@/components/simulation/EnhancedSimulationResults'
import { Alert, AlertDescription, Button } from '@/components/ui'
import type { StoredSimulation } from '@/utils/storage'
import { SimulationStorage } from '@/utils/storage'
import {
  type EnhancedSimulationResult,
  executeEnhancedSimulation,
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

  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        const storedSimulation = SimulationStorage.retrieveById(
          resolvedParams.id,
        )

        if (!storedSimulation) {
          setError('Simulation not found')
          setLoading(false)
          return
        }

        setSimulation(storedSimulation)
        setExecuting(true)

        // Execute fresh simulation with trace data
        const client = new AltitraceClient({
          baseUrl: process.env.NEXT_PUBLIC_API_URL
            ? `${process.env.NEXT_PUBLIC_API_URL}/v1`
            : undefined,
        })

        const result = await executeEnhancedSimulation(
          client,
          storedSimulation.request,
        )
        setSimulationResult(result)

        // Auto-switch to trace tab if we have call hierarchy
      } catch (err) {
        if (err instanceof SdkValidationError)
          setError(`Validation error: ${err.message}`)
        else if (err instanceof AltitraceApiError)
          setError(`API error: ${err.message}`)
        else if (err instanceof AltitraceNetworkError)
          setError(`Network error: ${err.message}`)
        else setError('Failed to execute simulation')
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
      console.log('Copied to clipboard:', url)
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
        const client = new AltitraceClient({
          baseUrl: process.env.NEXT_PUBLIC_API_URL
            ? `${process.env.NEXT_PUBLIC_API_URL}/v1`
            : undefined,
        })

        const exportData = await SimulationStorage.exportSimulation(
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

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-4">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">
                  {executing ? 'Executing Simulation' : 'Loading Simulation'}
                </h3>
                <p className="text-muted-foreground">
                  {executing
                    ? 'Running fresh simulation with trace data...'
                    : 'Loading simulation parameters...'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  if (error || !simulation || !simulationResult) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/simulator')}
            >
              <ArrowLeftIcon className="w-4 h-4 mr-1" />
              Back to Simulator
            </Button>
          </div>

          <Alert variant="destructive">
            <AlertDescription>
              {error || 'Simulation not found'}
            </AlertDescription>
          </Alert>

          <div className="text-center">
            <Button onClick={() => router.push('/simulator/new')}>
              Create New Simulation
            </Button>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8">
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
              Back to Simulator
            </Button>
          </div>

          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">
                {simulation.metadata?.title || 'Simulation Results'}
              </h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <ClockIcon className="w-4 h-4" />
                  {formatTimestamp(simulation.timestamp)}
                </div>
                <div className="flex items-center gap-2">
                  <span>ID:</span>
                  <code className="bg-muted px-2 py-1 rounded text-xs font-mono">
                    {resolvedParams?.id.slice(0, 8) || '...'}...
                  </code>
                </div>
                <div
                  className={`px-2 py-1 rounded-full text-xs ${
                    simulationResult.isSuccess()
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {simulationResult.isSuccess() ? 'Success' : 'Failed'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleShare}>
                <ShareIcon className="w-4 h-4 mr-1" />
                Share
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <DownloadIcon className="w-4 h-4 mr-1" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={handleRerun}>
                <EditIcon className="w-4 h-4 mr-1" />
                Edit & Re-run
              </Button>
            </div>
          </div>
        </div>

        {/* Enhanced Simulation Results */}
        <EnhancedSimulationResults result={simulationResult} />
      </div>
    </Layout>
  )
}
