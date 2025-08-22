/**
 * @fileoverview Trace configuration helpers
 */

import type { TraceConfig } from '@sdk/types/trace'

/**
 * Utility functions for creating common trace configurations.
 */
export const TraceHelpers = {
  /**
   * Create a comprehensive trace configuration with all tracers enabled.
   */
  allTracers(): TraceConfig {
    return {
      callTracer: { onlyTopCall: false, withLogs: true },
      prestateTracer: {
        diffMode: true,
        disableCode: false,
        disableStorage: false,
      },
      structLogger: {
        disableMemory: true,
        disableStack: false,
        disableStorage: false,
        disableReturnData: false,
        cleanStructLogs: true,
      },
      '4byteTracer': true,
    }
  },

  /**
   * Create a minimal trace configuration for basic call tracking.
   */
  basicCallTrace(): TraceConfig {
    return {
      '4byteTracer': false,
      callTracer: { onlyTopCall: false, withLogs: true },
      prestateTracer: null,
      structLogger: null,
    }
  },

  /**
   * Create a configuration optimized for state analysis.
   */
  stateAnalysis(): TraceConfig {
    return {
      '4byteTracer': false,
      prestateTracer: {
        diffMode: true,
        disableCode: false,
        disableStorage: false,
      },
      callTracer: { onlyTopCall: false, withLogs: false },
      structLogger: null,
    }
  },

  /**
   * Create a configuration for detailed EVM execution analysis.
   */
  detailedExecution(): TraceConfig {
    return {
      '4byteTracer': false,
      structLogger: {
        disableMemory: false,
        disableStack: false,
        disableStorage: false,
        disableReturnData: false,
        cleanStructLogs: false,
      },
      callTracer: { onlyTopCall: false, withLogs: true },
      prestateTracer: null,
    }
  },

  /**
   * Create a configuration for function call analysis.
   */
  functionAnalysis(): TraceConfig {
    return {
      '4byteTracer': true,
      callTracer: { onlyTopCall: false, withLogs: false },
      prestateTracer: null,
      structLogger: null,
    }
  },
}
