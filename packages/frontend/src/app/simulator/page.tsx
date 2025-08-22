'use client'

import {
  ClockIcon,
  PlayIcon,
  PlusIcon,
  ShareIcon,
  TrashIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Layout } from '@/components/layout'
import { Button, Card } from '@/components/ui'
import type { StoredSimulation } from '@/utils/storage'
import { SimulationStorage } from '@/utils/storage'

export default function SimulatorDashboard() {
  const router = useRouter()
  const [simulations, setSimulations] = useState<StoredSimulation[]>([])
  const [stats, setStats] = useState({ total: 0, today: 0 })

  useEffect(() => {
    // Load simulations and stats using proper storage system
    const loadedSimulations = SimulationStorage.retrieveAll()
    const loadedStats = SimulationStorage.getStats()

    setSimulations(loadedSimulations)
    setStats(loadedStats)
  }, [])

  const handleDeleteSimulation = (id: string) => {
    const success = SimulationStorage.delete(id)
    if (success) {
      const updatedSimulations = SimulationStorage.retrieveAll()
      const updatedStats = SimulationStorage.getStats()
      setSimulations(updatedSimulations)
      setStats(updatedStats)
    }
  }

  const handleShareSimulation = async (id: string) => {
    const url = `${window.location.origin}/simulator/${id}`
    try {
      await navigator.clipboard.writeText(url)
      // TODO: Add toast notification
      console.log('Copied to clipboard:', url)
    } catch (_e) {}
  }

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - timestamp.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return timestamp.toLocaleDateString()
  }

  const getSimulationType = (request: StoredSimulation['request']) => {
    const callsCount = request.params.calls?.length || 0
    const hasValue = request.params.calls?.some(
      (call) => call.value && call.value !== '0x0',
    )

    if (callsCount > 1)
      return { label: 'Batch', color: 'bg-purple-100 text-purple-800' }
    if (hasValue)
      return { label: 'Transfer', color: 'bg-blue-100 text-blue-800' }
    return { label: 'Call', color: 'bg-green-100 text-green-800' }
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Transaction Simulator</h1>
            <p className="text-muted-foreground mt-1">
              Build, simulate, and analyze HyperEVM transactions with
              professional tooling
            </p>
          </div>
          <Button onClick={() => router.push('/simulator/new')}>
            <PlusIcon className="w-4 h-4 mr-2" />
            New Simulation
          </Button>
        </div>

        {/* Quick Stats */}
        {stats.total > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">
                Total Simulations
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold">{stats.today}</div>
              <div className="text-sm text-muted-foreground">Created Today</div>
            </Card>
          </div>
        )}

        {/* Simulations List */}
        <div className="space-y-4">
          {simulations.length === 0 ? (
            <Card className="p-12">
              <div className="text-center space-y-4">
                <div className="text-6xl">🚀</div>
                <div>
                  <h3 className="text-xl font-semibold">No simulations yet</h3>
                  <p className="text-muted-foreground mt-2">
                    Create your first transaction simulation to get started with
                    HyperEVM analysis
                  </p>
                </div>
                <Button
                  onClick={() => router.push('/simulator/new')}
                  className="mt-4"
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Create First Simulation
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">Recent Simulations</h2>
              {simulations.map((simulation) => (
                <Card
                  key={simulation.id}
                  className="p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium truncate">
                          {simulation.metadata?.title || 'Untitled Simulation'}
                        </h3>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${getSimulationType(simulation.request).color}`}
                        >
                          {getSimulationType(simulation.request).label}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <ClockIcon className="w-3 h-3" />
                          {formatTimestamp(simulation.timestamp)}
                        </div>
                        <div>
                          Calls: {simulation.request.params.calls?.length || 0}
                        </div>
                        {simulation.request.params.blockNumber && (
                          <div>
                            Block:{' '}
                            {typeof simulation.request.params.blockNumber ===
                              'string' &&
                            simulation.request.params.blockNumber.startsWith(
                              '0x',
                            )
                              ? Number.parseInt(
                                  simulation.request.params.blockNumber,
                                  16,
                                ).toLocaleString()
                              : simulation.request.params.blockNumber}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          router.push(`/simulator/${simulation.id}`)
                        }
                      >
                        <PlayIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleShareSimulation(simulation.id)}
                      >
                        <ShareIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSimulation(simulation.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Additional Actions */}
        {simulations.length > 0 && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              onClick={() => router.push('/simulator/new')}
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Create Another Simulation
            </Button>
          </div>
        )}
      </div>
    </Layout>
  )
}
