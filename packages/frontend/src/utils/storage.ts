import type { SimulationRequest } from '@altitrace/sdk';
import type { EnhancedSimulationResult } from './trace-integration';

/**
 * Storage schema for persisting simulation data
 */
export interface StoredSimulation {
  id: string;
  timestamp: Date;
  request: {
    params: SimulationRequest['params'];
    options?: SimulationRequest['options'];
  };
  metadata: {
    title?: string;
    tags?: string[];
    description?: string;
  };
}

/**
 * Storage interface for serialization (Date -> string)
 */
interface SerializedStoredSimulation {
  id: string;
  timestamp: string;
  request: {
    params: SimulationRequest['params'];
    options?: SimulationRequest['options'];
  };
  metadata: {
    title?: string;
    tags?: string[];
    description?: string;
  };
}

/**
 * Simulation result storage manager with proper ExtendedSimulationResult reconstruction
 */
export class SimulationStorage {
  private static readonly STORAGE_KEY = 'altitrace_simulations';
  private static readonly MAX_STORED_SIMULATIONS = 50;

  /**
   * Store a simulation request with UUID
   */
  static store(
    id: string,
    request: { params: SimulationRequest['params']; options?: SimulationRequest['options'] },
    metadata: StoredSimulation['metadata'] = {}
  ): void {
    try {
      const storedSimulation: StoredSimulation = {
        id,
        timestamp: new Date(),
        request,
        metadata
      };

      // Get existing simulations
      const existing = this.retrieveAll();

      // Add new simulation to the beginning
      existing.unshift(storedSimulation);

      // Keep only the most recent simulations
      const trimmed = existing.slice(0, this.MAX_STORED_SIMULATIONS);

      // Serialize for storage (Date -> string)
      const serialized: SerializedStoredSimulation[] = trimmed.map(sim => ({
        ...sim,
        timestamp: sim.timestamp.toISOString()
      }));

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(serialized));
    } catch (error) {
      console.error('Failed to store simulation:', error);
    }
  }

  /**
   * Retrieve all stored simulations with properly reconstructed ExtendedSimulationResult
   */
  static retrieveAll(): StoredSimulation[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];

      const serialized: SerializedStoredSimulation[] = JSON.parse(stored);

      // Deserialize (string -> Date) and keep raw results
      return serialized.map(sim => ({
        ...sim,
        timestamp: new Date(sim.timestamp)
      }));
    } catch (error) {
      console.error('Failed to retrieve simulations:', error);
      return [];
    }
  }

  /**
   * Retrieve a specific simulation request by ID
   */
  static retrieveById(id: string): StoredSimulation | null {
    try {
      const allSimulations = this.retrieveAll();
      return allSimulations.find(sim => sim.id === id) || null;
    } catch (error) {
      console.error('Failed to retrieve simulation by ID:', error);
      return null;
    }
  }

  /**
   * Get just the request parameters for a simulation
   */
  static getRequest(id: string): { params: SimulationRequest['params']; options?: SimulationRequest['options'] } | null {
    const simulation = this.retrieveById(id);
    return simulation?.request || null;
  }

  /**
   * Delete a simulation by ID
   */
  static delete(id: string): boolean {
    try {
      const existing = this.retrieveAll();
      const filtered = existing.filter(sim => sim.id !== id);

      if (filtered.length === existing.length) {
        return false; // Simulation not found
      }

      // Serialize and store updated list
      const serialized: SerializedStoredSimulation[] = filtered.map(sim => ({
        ...sim,
        timestamp: sim.timestamp.toISOString()
      }));

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(serialized));
      return true;
    } catch (error) {
      console.error('Failed to delete simulation:', error);
      return false;
    }
  }

  /**
   * Update simulation metadata
   */
  static updateMetadata(id: string, metadata: Partial<StoredSimulation['metadata']>): boolean {
    try {
      const existing = this.retrieveAll();
      const index = existing.findIndex(sim => sim.id === id);

      if (index === -1) return false;

      existing[index].metadata = { ...existing[index].metadata, ...metadata };

      // Serialize and store updated list
      const serialized: SerializedStoredSimulation[] = existing.map(sim => ({
        ...sim,
        timestamp: sim.timestamp.toISOString()
      }));

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(serialized));
      return true;
    } catch (error) {
      console.error('Failed to update simulation metadata:', error);
      return false;
    }
  }

  /**
   * Clear all stored simulations
   */
  static clearAll(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear simulations:', error);
    }
  }

  /**
   * Get storage statistics
   */
  static getStats(): {
    total: number;
    today: number;
  } {
    const simulations = this.retrieveAll();
    const today = new Date().toDateString();

    return {
      total: simulations.length,
      today: simulations.filter(s => s.timestamp.toDateString() === today).length
    };
  }

  /**
   * Export simulation data for backup/sharing - will execute fresh simulation
   */
  static async exportSimulation(
    id: string,
    executeSimulation: (request: { params: SimulationRequest['params']; options?: SimulationRequest['options'] }) => Promise<EnhancedSimulationResult>
  ): Promise<string | null> {
    const simulation = this.retrieveById(id);
    if (!simulation) return null;

    try {
      // Execute fresh simulation for complete data
      const result = await executeSimulation(simulation.request);

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
          assetChanges: result.assetChanges
        },
        traceData: result.traceData ? {
          callTracer: result.traceData.callTracer,
          '4byteTracer': result.traceData['4byteTracer']
        } : null,
        metadata: {
          ...simulation.metadata,
          exportedAt: new Date().toISOString(),
          version: '1.0'
        }
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Failed to export simulation:', error);
      return null;
    }
  }

  /**
   * Import simulation data from backup
   */
  static importSimulation(data: string): boolean {
    try {
      const importData = JSON.parse(data);

      // Validate the imported data structure
      if (!importData.id || !importData.request) {
        throw new Error('Invalid simulation data format');
      }

      const simulation: StoredSimulation = {
        id: importData.id,
        timestamp: new Date(importData.timestamp),
        request: importData.request,
        metadata: importData.metadata || {}
      };

      // Store the imported simulation
      const existing = this.retrieveAll();
      existing.unshift(simulation);

      const serialized: SerializedStoredSimulation[] = existing.slice(0, this.MAX_STORED_SIMULATIONS).map(sim => ({
        ...sim,
        timestamp: sim.timestamp.toISOString()
      }));

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(serialized));
      return true;
    } catch (error) {
      console.error('Failed to import simulation:', error);
      return false;
    }
  }
}