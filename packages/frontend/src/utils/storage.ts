import type { SimulationRequest } from '@altitrace/sdk/types'
import type { BundleSimulationRequest } from '@/types/bundle'
import type { EnhancedSimulationResult } from './trace-integration'

/**
 * Single simulation request storage
 */
export interface SingleSimulationRequest {
  type: 'single'
  params: SimulationRequest['params']
  options?: SimulationRequest['options']
}

/**
 * Bundle simulation request storage
 */
export interface BundleSimulationRequestStorage {
  type: 'bundle'
  bundleRequest: BundleSimulationRequest
}

/**
 * Union type for all simulation requests
 */
type StoredSimulationRequest =
  | SingleSimulationRequest
  | BundleSimulationRequestStorage

/**
 * Storage schema for persisting simulation data
 */
export interface StoredSimulation {
  id: string
  timestamp: Date
  request: StoredSimulationRequest
  metadata: {
    title?: string
    tags?: string[]
    description?: string
  }
}

/**
 * Storage interface for serialization (Date -> string)
 */
interface SerializedStoredSimulation {
  id: string
  timestamp: string
  request: StoredSimulationRequest
  metadata: {
    title?: string
    tags?: string[]
    description?: string
  }
}

const STORAGE_KEY = 'altitrace_simulations'
const MAX_STORED_SIMULATIONS = 50

/**
 * Store a simulation request with UUID
 */
export function store(
  id: string,
  request:
    | StoredSimulationRequest
    | {
        params: SimulationRequest['params']
        options?: SimulationRequest['options']
      },
  metadata: StoredSimulation['metadata'] = {},
): void {
  try {
    // Normalize request to new format if it's the old format
    const normalizedRequest: StoredSimulationRequest =
      'type' in request
        ? request
        : { type: 'single', params: request.params, options: request.options }

    const storedSimulation: StoredSimulation = {
      id,
      timestamp: new Date(),
      request: normalizedRequest,
      metadata,
    }

    // Get existing simulations
    const existing = retrieveAll()

    // Add new simulation to the beginning
    existing.unshift(storedSimulation)

    // Keep only the most recent simulations
    const trimmed = existing.slice(0, MAX_STORED_SIMULATIONS)

    // Serialize for storage (Date -> string)
    const serialized: SerializedStoredSimulation[] = trimmed.map((sim) => ({
      ...sim,
      timestamp: sim.timestamp.toISOString(),
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

    // Deserialize (string -> Date) and keep raw results
    return serialized.map((sim) => ({
      ...sim,
      timestamp: new Date(sim.timestamp),
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
 * Get just the request parameters for a simulation (legacy function)
 * Note: This function is deprecated for new code. Use retrieveById instead.
 */
export function getRequest(id: string): {
  params: SimulationRequest['params']
  options?: SimulationRequest['options']
} | null {
  const simulation = retrieveById(id)
  if (!simulation?.request) return null

  // Handle different request types
  if ('type' in simulation.request && simulation.request.type === 'single') {
    return {
      params: simulation.request.params,
      options: simulation.request.options,
    }
  }

  // For bundle requests or legacy format, try to extract if it looks like old format
  const legacyRequest = simulation.request as any
  if (legacyRequest.params) {
    return legacyRequest
  }

  return null
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
    // Convert new format to old format for the execution function
    let requestForExecution: {
      params: SimulationRequest['params']
      options?: SimulationRequest['options']
    }

    if ('type' in simulation.request && simulation.request.type === 'single') {
      requestForExecution = {
        params: simulation.request.params,
        options: simulation.request.options,
      }
    } else {
      // For bundle or legacy format, try to extract compatible format
      const legacyRequest = simulation.request as any
      if (legacyRequest.params) {
        requestForExecution = legacyRequest
      } else {
        // Cannot export bundle simulations with single simulation executor
        console.warn(
          'Cannot export bundle simulation with single simulation executor',
        )
        return null
      }
    }

    // Execute fresh simulation for complete data
    const result = await executeSimulation(requestForExecution)

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
      }))

    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized))
    return true
  } catch (_error) {
    return false
  }
}
