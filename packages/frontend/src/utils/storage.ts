import type { SimulationRequest } from '@altitrace/sdk/types'
import type { EnhancedSimulationResult } from './trace-integration'

/**
 * Storage schema for persisting simulation data
 */
export interface StoredSimulation {
  id: string
  timestamp: Date
  request: {
    params: SimulationRequest['params']
    options?: SimulationRequest['options']
  }
  metadata: {
    title?: string
    tags?: string[]
    description?: string
  }
  result?: {
    status: 'success' | 'reverted' | 'failed'
    gasUsed?: bigint
    callsCount?: number
    hasErrors?: boolean
  }
}

/**
 * Storage interface for serialization (Date -> string)
 */
interface SerializedStoredSimulation {
  id: string
  timestamp: string
  request: {
    params: SimulationRequest['params']
    options?: SimulationRequest['options']
  }
  metadata: {
    title?: string
    tags?: string[]
    description?: string
  }
  result?: {
    status: 'success' | 'reverted' | 'failed'
    gasUsed?: string // bigint serialized as string
    callsCount?: number
    hasErrors?: boolean
  }
}

const STORAGE_KEY = 'altitrace_simulations'
const MAX_STORED_SIMULATIONS = 50

/**
 * Store a simulation request with UUID
 */
export function store(
  id: string,
  request: {
    params: SimulationRequest['params']
    options?: SimulationRequest['options']
  },
  metadata: StoredSimulation['metadata'] = {},
): void {
  try {
    const storedSimulation: StoredSimulation = {
      id,
      timestamp: new Date(),
      request,
      metadata,
    }

    // Get existing simulations
    const existing = retrieveAll()

    // Add new simulation to the beginning
    existing.unshift(storedSimulation)

    // Keep only the most recent simulations
    const trimmed = existing.slice(0, MAX_STORED_SIMULATIONS)

    // Serialize for storage (Date -> string, bigint -> string)
    const serialized: SerializedStoredSimulation[] = trimmed.map((sim) => ({
      ...sim,
      timestamp: sim.timestamp.toISOString(),
      result: sim.result ? {
        ...sim.result,
        gasUsed: sim.result.gasUsed?.toString()
      } : undefined,
    }))

    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized))
  } catch (_error) {}
}

/**
 * Retrieve all stored simulations with properly reconstructed ExtendedSimulationResult
 */
export function retrieveAll(): StoredSimulation[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []

    const serialized: SerializedStoredSimulation[] = JSON.parse(stored)

    // Deserialize (string -> Date, string -> bigint)
    return serialized.map((sim) => ({
      ...sim,
      timestamp: new Date(sim.timestamp),
      result: sim.result ? {
        ...sim.result,
        gasUsed: sim.result.gasUsed ? BigInt(sim.result.gasUsed) : undefined
      } : undefined,
    }))
  } catch (_error) {
    return []
  }
}

/**
 * Retrieve a specific simulation request by ID
 */
export function retrieveById(id: string): StoredSimulation | null {
  try {
    const allSimulations = retrieveAll()
    return allSimulations.find((sim) => sim.id === id) || null
  } catch (_error) {
    return null
  }
}

/**
 * Get just the request parameters for a simulation
 */
export function getRequest(id: string): {
  params: SimulationRequest['params']
  options?: SimulationRequest['options']
} | null {
  const simulation = retrieveById(id)
  return simulation?.request || null
}

/**
 * Delete a simulation by ID
 */
export function deleteSimulation(id: string): boolean {
  try {
    const existing = retrieveAll()
    const filtered = existing.filter((sim) => sim.id !== id)

    if (filtered.length === existing.length) {
      return false // Simulation not found
    }

    // Serialize and store updated list
    const serialized: SerializedStoredSimulation[] = filtered.map((sim) => ({
      ...sim,
      timestamp: sim.timestamp.toISOString(),
      result: sim.result ? {
        ...sim.result,
        gasUsed: sim.result.gasUsed?.toString()
      } : undefined,
    }))

    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized))
    return true
  } catch (_error) {
    return false
  }
}

/**
 * Update simulation result data
 */
export function updateResult(
  id: string,
  result: StoredSimulation['result'],
): boolean {
  try {
    const existing = retrieveAll()
    const index = existing.findIndex((sim) => sim.id === id)

    if (index === -1) return false

    existing[index].result = result

    // Serialize and store updated list
    const serialized: SerializedStoredSimulation[] = existing.map((sim) => ({
      ...sim,
      timestamp: sim.timestamp.toISOString(),
      result: sim.result ? {
        ...sim.result,
        gasUsed: sim.result.gasUsed?.toString()
      } : undefined,
    }))

    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized))
    return true
  } catch (_error) {
    return false
  }
}

/**
 * Update simulation metadata
 */
export function updateMetadata(
  id: string,
  metadata: Partial<StoredSimulation['metadata']>,
): boolean {
  try {
    const existing = retrieveAll()
    const index = existing.findIndex((sim) => sim.id === id)

    if (index === -1) return false

    existing[index].metadata = { ...existing[index].metadata, ...metadata }

    // Serialize and store updated list
    const serialized: SerializedStoredSimulation[] = existing.map((sim) => ({
      ...sim,
      timestamp: sim.timestamp.toISOString(),
      result: sim.result ? {
        ...sim.result,
        gasUsed: sim.result.gasUsed?.toString()
      } : undefined,
    }))

    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized))
    return true
  } catch (_error) {
    return false
  }
}

/**
 * Clear all stored simulations
 */
export function clearAll(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (_error) {}
}

/**
 * Get storage statistics
 */
export function getStats(): {
  total: number
  today: number
} {
  const simulations = retrieveAll()
  const today = new Date().toDateString()

  return {
    total: simulations.length,
    today: simulations.filter((s) => s.timestamp.toDateString() === today)
      .length,
  }
}

/**
 * Export simulation data for backup/sharing - will execute fresh simulation
 */
export async function exportSimulation(
  id: string,
  executeSimulation: (request: {
    params: SimulationRequest['params']
    options?: SimulationRequest['options']
  }) => Promise<EnhancedSimulationResult>,
): Promise<string | null> {
  const simulation = retrieveById(id)
  if (!simulation) return null

  try {
    // Execute fresh simulation for complete data
    const result = await executeSimulation(simulation.request)

    const exportData = {
      request: simulation.request,
      result: {
        // Core simulation data
        simulationId: result.simulationId,
        blockNumber: result.blockNumber,
        status: result.status,
        calls: result.calls,
        gasUsed: result.gasUsed,
        blockGasUsed: result.blockGasUsed,
        assetChanges: result.assetChanges,
      },
      traceData: result.traceData
        ? {
            callTracer: result.traceData.callTracer,
            '4byteTracer': result.traceData['4byteTracer'],
          }
        : null,
      metadata: {
        ...simulation.metadata,
        exportedAt: new Date().toISOString(),
        version: '1.0',
      },
    }

    return JSON.stringify(exportData, null, 2)
  } catch (_error) {
    return null
  }
}

/**
 * Import simulation data from backup
 */
export function importSimulation(data: string): boolean {
  try {
    const importData = JSON.parse(data)

    // Validate the imported data structure
    if (!importData.id || !importData.request) {
      throw new Error('Invalid simulation data format')
    }

    const simulation: StoredSimulation = {
      id: importData.id,
      timestamp: new Date(importData.timestamp),
      request: importData.request,
      metadata: importData.metadata || {},
    }

    // Store the imported simulation
    const existing = retrieveAll()
    existing.unshift(simulation)

    const serialized: SerializedStoredSimulation[] = existing
      .slice(0, MAX_STORED_SIMULATIONS)
      .map((sim) => ({
        ...sim,
        timestamp: sim.timestamp.toISOString(),
        result: sim.result ? {
          ...sim.result,
          gasUsed: sim.result.gasUsed?.toString()
        } : undefined,
      }))

    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized))
    return true
  } catch (_error) {
    return false
  }
}
