/**
 * @fileoverview Error classes and utilities
 */

/**
 * Base error class for all Altitrace SDK errors.
 */
export class AltitraceError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message)
    this.name = 'AltitraceError'
  }
}

/**
 * Validation error for invalid input parameters.
 */
export class ValidationError extends AltitraceError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}

/**
 * Network error for connectivity issues.
 */
export class AltitraceNetworkError extends AltitraceError {
  public type = 'network' as const
  public override cause?: Error | undefined

  constructor(
    message: string,
    code?: string,
    public statusCode?: number,
    errorCause?: Error,
  ) {
    super(message, code ?? 'NETWORK_ERROR')
    this.name = 'AltitraceNetworkError'
    this.cause = errorCause
  }

  /**
   * Create a network error from an HTTP response.
   */
  static fromResponse(response: Response): AltitraceNetworkError {
    return new AltitraceNetworkError(
      `HTTP ${response.status}: ${response.statusText}`,
      'HTTP_ERROR',
      response.status,
    )
  }

  /**
   * Create a network error from a generic network issue.
   */
  static networkError(cause: Error): AltitraceNetworkError {
    return new AltitraceNetworkError(
      `Network error: ${cause.message}`,
      'NETWORK_ERROR',
      undefined,
      cause,
    )
  }

  /**
   * Create a timeout error.
   */
  static timeout(timeout: number): AltitraceNetworkError {
    return new AltitraceNetworkError(
      `Request timed out after ${timeout}ms`,
      'TIMEOUT_ERROR',
    )
  }

  /**
   * Create a parse error for invalid JSON responses.
   */
  static parseError(cause: Error): AltitraceNetworkError {
    return new AltitraceNetworkError(
      `Failed to parse response: ${cause.message}`,
      'PARSE_ERROR',
      undefined,
      cause,
    )
  }
}

/**
 * API error for server-side errors.
 */
export class AltitraceApiError extends AltitraceError {
  constructor(message: string, code?: string) {
    super(message, code)
    this.name = 'AltitraceApiError'
  }
}

/**
 * Simulation error for simulation-specific issues.
 */
export class SimulationError extends AltitraceError {
  constructor(message: string) {
    super(message, 'SIMULATION_ERROR')
    this.name = 'SimulationError'
  }
}

/**
 * Configuration error for invalid SDK configuration.
 */
export class ConfigurationError extends AltitraceError {
  constructor(
    message: string,
    public configKey?: string,
  ) {
    super(message, 'CONFIGURATION_ERROR')
    this.name = 'ConfigurationError'
  }
}

/**
 * Utilities for working with errors.
 */
export const ErrorUtils = {
  isAltitraceError(error: unknown): error is AltitraceError {
    return error instanceof AltitraceError
  },

  isNetworkError(error: unknown): error is AltitraceNetworkError {
    return error instanceof AltitraceNetworkError
  },

  isApiError(error: unknown): error is AltitraceApiError {
    return error instanceof AltitraceApiError
  },
}
