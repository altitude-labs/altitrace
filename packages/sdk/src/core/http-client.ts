/**
 * HTTP client implementation for the Altitrace SDK.
 *
 * This module provides a robust HTTP client with retry logic, timeout handling,
 * and proper error management for communicating with the Altitrace API.
 */

import type {
  AltitraceClientConfig,
  ResolvedClientConfig,
  RequestOptions,
  ApiResponse,
  RetryConfig,
  NetworkError,
} from '@sdk/types/client';
import { AltitraceNetworkError, ConfigurationError, ErrorUtils } from './errors';

/**
 * Default retry configuration.
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30_000, // 30 seconds
  backoffMultiplier: 2,
  retryableStatusCodes: new Set([408, 429, 500, 502, 503, 504]),
  shouldRetry: (error: NetworkError, attempt: number): boolean => {
    if (attempt >= DEFAULT_RETRY_CONFIG.maxAttempts) {
      return false;
    }
    return (
      error.statusCode !== undefined &&
      DEFAULT_RETRY_CONFIG.retryableStatusCodes.has(error.statusCode)
    );
  },
} as const;

/**
 * Default configuration values for the HTTP client.
 */
const DEFAULT_CONFIG: Required<AltitraceClientConfig> = {
  baseUrl: 'http://localhost:8080/v1',
  timeout: 30_000, // 30 seconds
  retryConfig: DEFAULT_RETRY_CONFIG,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': '@altitrace/sdk/1.0.0',
  },
  fetch: globalThis.fetch,
  debug: false,
  apiKey: '',
  userAgent: '',
} as const;

/**
 * HTTP client for making requests to the Altitrace API.
 * Handles authentication, retries, timeouts, and error handling.
 */
export class HttpClient {
  private readonly config: ResolvedClientConfig;
  private readonly retryConfig: RetryConfig;

  /**
   * Create a new HTTP client instance.
   * @param config - Client configuration options
   */
  constructor(config: AltitraceClientConfig = {}) {
    this.config = this.resolveConfig(config);
    this.retryConfig = DEFAULT_RETRY_CONFIG;

    this.validateConfig();
  }

  /**
   * Resolve the client configuration with defaults.
   */
  private resolveConfig(config: AltitraceClientConfig): ResolvedClientConfig {
    return {
      baseUrl: config.baseUrl ?? DEFAULT_CONFIG.baseUrl,
      timeout: config.timeout ?? DEFAULT_CONFIG.timeout,
      retries: config.retryConfig ?? DEFAULT_CONFIG.retryConfig,
      headers: { ...DEFAULT_CONFIG.headers, ...config.headers },
      fetch: config.fetch ?? DEFAULT_CONFIG.fetch,
      debug: config.debug ?? DEFAULT_CONFIG.debug,
    };
  }

  /**
   * Validate the resolved configuration.
   */
  private validateConfig(): void {
    if (!this.config.baseUrl) {
      throw new ConfigurationError('Base URL is required', 'baseUrl');
    }

    if (!this.config.baseUrl.startsWith('http://') && !this.config.baseUrl.startsWith('https://')) {
      throw new ConfigurationError('Base URL must start with http:// or https://', 'baseUrl');
    }

    if (this.config.timeout <= 0) {
      throw new ConfigurationError('Timeout must be a positive number', 'timeout');
    }

    if (this.config.retries.maxAttempts < 0) {
      throw new ConfigurationError('Retries must be a non-negative number', 'retries');
    }

    if (typeof this.config.fetch !== 'function') {
      throw new ConfigurationError('Fetch must be a function', 'fetch');
    }
  }

  /**
   * Make an HTTP request with retry logic and error handling.
   * @param path - API path relative to base URL
   * @param options - Request options
   * @returns Promise resolving to the response data
   */
  public async request<T>(path: string, options: RequestOptions): Promise<ApiResponse<T>> {
    const url = this.buildUrl(path);
    let lastError: AltitraceNetworkError | undefined;

    for (let attempt = 1; attempt <= this.config.retries.maxAttempts + 1; attempt++) {
      try {
        if (this.config.debug && attempt > 1) {
          console.debug(
            `[Altitrace SDK] Retry attempt ${attempt - 1} for ${options.method} ${url}`
          );
        }

        const response = await this.makeRequest(url, options, attempt);

        if (this.config.debug) {
          console.debug(`[Altitrace SDK] ${options.method} ${url} completed in attempt ${attempt}`);
        }

        return response as ApiResponse<T>;
      } catch (error) {
        if (!(error instanceof AltitraceNetworkError)) {
          // Unexpected error type, wrap it
          lastError = AltitraceNetworkError.networkError(error as Error);
        } else {
          lastError = error;
        }

        const shouldRetry =
          attempt <= this.config.retries.maxAttempts &&
          this.retryConfig.shouldRetry(lastError, attempt);

        if (!shouldRetry) {
          if (this.config.debug) {
            console.debug(
              `[Altitrace SDK] ${options.method} ${url} failed after ${attempt} attempts:`,
              lastError
            );
          }
          throw lastError;
        }

        // Calculate delay for next attempt
        const delay = this.calculateRetryDelay(attempt - 1);
        if (this.config.debug) {
          console.debug(`[Altitrace SDK] Waiting ${delay}ms before retry ${attempt}`);
        }

        await this.sleep(Math.floor(delay));
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new AltitraceNetworkError('Unknown error occurred');
  }

  /**
   * Make a single HTTP request attempt.
   */
  private async makeRequest<T>(
    url: string,
    options: RequestOptions,
    attempt: number
  ): Promise<ApiResponse<T>> {
    const requestTimeout = options.timeout ?? this.config.timeout;
    const abortController = new AbortController();

    // Set up timeout
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, requestTimeout);

    try {
      const requestHeaders = {
        ...this.config.headers,
        ...options.headers,
      };

      const requestInit: RequestInit = {
        method: options.method,
        headers: requestHeaders,
        signal: abortController.signal,
      };

      // Add body for methods that support it
      if (options.body !== undefined && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
        if (typeof options.body === 'string') {
          requestInit.body = options.body;
        } else {
          requestInit.body = JSON.stringify(options.body);
        }
      }

      if (this.config.debug) {
        console.debug(`[Altitrace SDK] ${options.method} ${url}`, {
          attempt,
          headers: requestHeaders,
          body: requestInit.body,
        });
      }

      const response = await this.config.fetch(url, requestInit);

      if (!response.ok) {
        throw AltitraceNetworkError.fromResponse(response);
      }

      // Parse response
      const responseText = await response.text();
      let parsedResponse: ApiResponse<T>;

      try {
        parsedResponse = JSON.parse(responseText) as ApiResponse<T>;
      } catch (parseError) {
        throw AltitraceNetworkError.parseError(parseError as Error);
      }

      if (this.config.debug) {
        console.debug(`[Altitrace SDK] ${options.method} ${url} response:`, {
          status: response.status,
          success: parsedResponse.success,
          hasData: parsedResponse.data !== undefined,
          hasError: parsedResponse.error !== undefined,
        });
      }

      return parsedResponse;
    } catch (error) {
      if (abortController.signal.aborted) {
        throw AltitraceNetworkError.timeout(requestTimeout);
      }

      if (error instanceof AltitraceNetworkError) {
        throw error;
      }

      // Handle fetch-level errors
      if (error instanceof TypeError) {
        // Network errors in fetch are typically TypeErrors
        throw AltitraceNetworkError.networkError(error);
      }

      // Unknown error
      throw new AltitraceNetworkError(
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        'UNKNOWN_ERROR'
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Build a complete URL from the base URL and path.
   */
  private buildUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const cleanBaseUrl = this.config.baseUrl.endsWith('/')
      ? this.config.baseUrl.slice(0, -1)
      : this.config.baseUrl;

    return `${cleanBaseUrl}/${cleanPath}`;
  }

  /**
   * Calculate the delay before the next retry attempt.
   */
  private calculateRetryDelay(attempt: number): number {
    const exponentialDelay =
      this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt);

    // Add some jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * exponentialDelay;

    return Math.min(exponentialDelay + jitter, this.retryConfig.maxDelay);
  }

  /**
   * Sleep for the specified number of milliseconds.
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Make a GET request.
   * @param path - API path
   * @param options - Additional request options
   * @returns Promise resolving to the response
   */
  public async get<T>(
    path: string,
    options: Partial<RequestOptions> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'GET',
      ...options,
    });
  }

  /**
   * Make a POST request.
   * @param path - API path
   * @param body - Request body
   * @param options - Additional request options
   * @returns Promise resolving to the response
   */
  public async post<T>(
    path: string,
    body?: unknown,
    options: Partial<RequestOptions> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'POST',
      body,
      ...options,
    });
  }

  /**
   * Make a PUT request.
   * @param path - API path
   * @param body - Request body
   * @param options - Additional request options
   * @returns Promise resolving to the response
   */
  public async put<T>(
    path: string,
    body?: unknown,
    options: Partial<RequestOptions> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'PUT',
      body,
      ...options,
    });
  }

  /**
   * Make a DELETE request.
   * @param path - API path
   * @param options - Additional request options
   * @returns Promise resolving to the response
   */
  public async delete<T>(
    path: string,
    options: Partial<RequestOptions> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'DELETE',
      ...options,
    });
  }

  /**
   * Get the current configuration.
   * @returns The resolved client configuration
   */
  public getConfig(): Readonly<ResolvedClientConfig> {
    return { ...this.config };
  }
}
