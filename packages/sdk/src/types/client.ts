/**
 * @fileoverview Client configuration and core types
 */

/**
 * Configuration options for the Altitrace client.
 */
export interface AltitraceClientConfig {
  /** API base URL (default: http://localhost:8080/v1) */
  baseUrl?: string
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number
  /** Enable debug logging (default: false) */
  debug?: boolean
  /** Custom headers to include in requests */
  headers?: Record<string, string>
  /** API key for authentication (if required) */
  apiKey?: string
  /** Retry configuration */
  retryConfig?: RetryConfig
  /** Custom fetch implementation */
  fetch?: typeof globalThis.fetch
  /** User agent string */
  userAgent?: string
  /** Optional viem public client for blockchain data access */
  viemClient?: unknown // Avoiding direct viem dependency in types
}

/**
 * Retry configuration for failed requests.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts: number
  /** Base delay between retries in milliseconds (default: 1000) */
  baseDelay: number
  /** Maximum delay between retries in milliseconds (default: 10000) */
  maxDelay: number
  /** Backoff multiplier for exponential backoff (default: 2) */
  backoffMultiplier: number
  /** HTTP status codes that should trigger retries */
  retryableStatusCodes: Set<number>
  /** Function to determine if an error should trigger a retry */
  shouldRetry: (error: NetworkError, attempt: number) => boolean
}

/**
 * Resolved client configuration with all defaults applied.
 */
export interface ResolvedClientConfig {
  /** API base URL */
  baseUrl: string
  /** Request timeout in milliseconds */
  timeout: number
  /** Retry configuration */
  retries: RetryConfig
  /** Headers to include in requests */
  headers: Record<string, string>
  /** Fetch implementation to use */
  fetch: typeof globalThis.fetch
  /** Enable debug logging */
  debug: boolean
  /** Optional viem public client for blockchain data access */
  viemClient?: unknown
}

/**
 * Options for individual requests.
 */
export interface RequestOptions {
  /** HTTP method for the request */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  /** Request body data */
  body?: unknown
  /** Query parameters for GET requests */
  params?: Record<string, any>
  /** Override default timeout */
  timeout?: number
  /** Additional headers for this request */
  headers?: Record<string, string>
  /** Whether to retry this request on failure */
  retry?: boolean
  /** Custom retry configuration for this request */
  retryConfig?: Partial<RetryConfig>
}

/**
 * Generic API response wrapper.
 */
export interface ApiResponse<T> {
  /** Whether the request was successful */
  success: boolean
  /** Response data (if successful) */
  data?: T
  /** Error details (if failed) */
  error?: ApiError
  /** Request metadata */
  metadata: ResponseMetadata
}

/**
 * API error information.
 */
export interface ApiError {
  /** Machine-readable error code */
  code: string
  /** Human-readable error message */
  message: string
  /** Optional detailed error information */
  details?: unknown
  /** Suggested resolution */
  suggestion?: string
  /** Stack trace (debug builds only) */
  trace?: string
}

/**
 * Request metadata included in responses.
 */
export interface ResponseMetadata {
  /** Unique request identifier */
  requestId: string
  /** Response timestamp */
  timestamp: string
  /** Execution time in milliseconds */
  executionTime?: number
}

/**
 * Network error class for connectivity issues.
 */
export interface NetworkError extends Error {
  /** Error type discriminator */
  type: 'network'
  /** HTTP status code (if available) */
  statusCode?: number | undefined
  /** Original error cause */
  cause?: Error | undefined
}

/**
 * Generic result type for operations that can succeed or fail.
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }
