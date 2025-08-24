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
    traceHash?: string
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
  request: StoredSimulationRequest
  metadata: {
    title?: string
    tags?: string[]
    description?: string
    traceHash?: string // For storing transaction hash when tracing existing transactions
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
 * Store simulation in Redis (for sharing)
 */
async function storeInRedis(
  id: string,
  simulation: StoredSimulation,
): Promise<void> {
  try {
    const response = await fetch(`/api/storage/${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(simulation),
    })

    if (!response.ok) {
    } else {
      console.error(
        '❌ [Redis Storage] Failed to store:',
        response.status,
        response.statusText,
      )
    }
  } catch (error) {
    console.error('❌ [Redis Storage] Network error:', error)
  }
}

/**
 * Retrieve simulation from Redis (for sharing)
 */
async function retrieveFromRedis(id: string): Promise<StoredSimulation | null> {
  try {
    const response = await fetch(`/api/storage/${id}`)
    if (response.ok) {
      const data = await response.json()

      // Deserialize the data (convert timestamp string back to Date)
      const simulation = data.simulation
      if (simulation.timestamp && typeof simulation.timestamp === 'string') {
        simulation.timestamp = new Date(simulation.timestamp)
      }

      return simulation
    } else {
      console.log(
        '⚠️ [Redis Storage] Simulation not found in Redis:',
        id,
        response.status,
      )
    }
    return null
  } catch (error) {
    console.error('❌ [Redis Storage] Network error during retrieval:', error)
    return null
  }
}

/**
 * Store a simulation request with UUID
 */
export async function store(
  id: string,
  request:
    | StoredSimulationRequest
    | {
        params: SimulationRequest['params']
        options?: SimulationRequest['options']
      },
  metadata: StoredSimulation['metadata'] = {},
): Promise<void> {
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

    // Serialize for storage (Date -> string, bigint -> string)
    const serialized: SerializedStoredSimulation[] = trimmed.map((sim) => ({
      ...sim,
      timestamp: sim.timestamp.toISOString(),
      result: sim.result
        ? {
            ...sim.result,
            gasUsed: sim.result.gasUsed?.toString(),
          }
        : undefined,
    }))

    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized))

    // Also store in Redis for sharing (don't await to avoid blocking UI)
    storeInRedis(id, storedSimulation).catch((error) => {
      console.warn('Failed to store in Redis, but continuing:', error)
    })
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
      result: sim.result
        ? {
            ...sim.result,
            gasUsed: sim.result.gasUsed
              ? BigInt(sim.result.gasUsed)
              : undefined,
          }
        : undefined,
    }))
  } catch (_error) {
    return []
  }
}

/**
 * Retrieve a specific simulation request by ID
 * Tries localStorage first, then Redis for shared simulations
 */
export async function retrieveById(
  id: string,
): Promise<StoredSimulation | null> {
  try {
    // Try localStorage first (fast)
    const allSimulations = retrieveAll()
    const localSim = allSimulations.find((sim) => sim.id === id)
    if (localSim) {
      return localSim
    }

    // Fallback to Redis for shared simulations
    const sharedSim = await retrieveFromRedis(id)
    if (sharedSim) {
      // Cache in localStorage for faster future access
      const existing = retrieveAll()
      existing.unshift(sharedSim)
      const trimmed = existing.slice(0, MAX_STORED_SIMULATIONS)
      const serialized: SerializedStoredSimulation[] = trimmed.map((sim) => ({
        ...sim,
        timestamp: sim.timestamp.toISOString(),
        result: sim.result
          ? {
              ...sim.result,
              gasUsed: sim.result.gasUsed?.toString(),
            }
          : undefined,
      }))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized))
      return sharedSim
    }

    return null
  } catch (error) {
    console.error('❌ [Storage] Error in retrieveById:', error)
    return null
  }
}

/**
 * Get just the request parameters for a simulation (legacy function)
 * Note: This function is deprecated for new code. Use retrieveById instead.
 */
export async function getRequest(id: string): Promise<{
  params: SimulationRequest['params']
  options?: SimulationRequest['options']
} | null> {
  const simulation = await retrieveById(id)
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
      result: sim.result
        ? {
            ...sim.result,
            gasUsed: sim.result.gasUsed?.toString(),
          }
        : undefined,
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
export async function updateResult(
  id: string,
  result: StoredSimulation['result'],
): Promise<boolean> {
  try {
    const existing = retrieveAll()
    const index = existing.findIndex((sim) => sim.id === id)

    if (index === -1) return false

    existing[index].result = result

    // Serialize and store updated list
    const serialized: SerializedStoredSimulation[] = existing.map((sim) => ({
      ...sim,
      timestamp: sim.timestamp.toISOString(),
      result: sim.result
        ? {
            ...sim.result,
            gasUsed: sim.result.gasUsed?.toString(),
          }
        : undefined,
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
export async function updateMetadata(
  id: string,
  metadata: Partial<StoredSimulation['metadata']>,
): Promise<boolean> {
  try {
    const existing = retrieveAll()
    const index = existing.findIndex((sim) => sim.id === id)

    if (index === -1) return false

    existing[index].metadata = { ...existing[index].metadata, ...metadata }

    // Serialize and store updated list
    const serialized: SerializedStoredSimulation[] = existing.map((sim) => ({
      ...sim,
      timestamp: sim.timestamp.toISOString(),
      result: sim.result
        ? {
            ...sim.result,
            gasUsed: sim.result.gasUsed?.toString(),
          }
        : undefined,
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
  const simulation = await retrieveById(id)
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
        result: sim.result
          ? {
              ...sim.result,
              gasUsed: sim.result.gasUsed?.toString(),
            }
          : undefined,
      }))

    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized))
    return true
  } catch (_error) {
    return false
  }
}
