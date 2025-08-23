/**
 * @fileoverview Altitrace SDK
 *
 * @author Altitude Labs @quertyeth @johntoz
 * @version 1.0.0
 * @license MIT
 */

import { AltitraceClient as _AltitraceClient } from './client/altitrace-client'
import type { AltitraceClientConfig } from './types/client'

/**
 * Main client class
 */
export const AltitraceClient = _AltitraceClient

/**
 * Essential types
 */
export type { AltitraceClientConfig }

/**
 * SDK version
 */
export const VERSION = '0.1.0'

/**
 * Default config
 */
export const DEFAULT_CONFIG = {
  BASE_URL: 'http://localhost:8080/v1',
  TIMEOUT: 30_000,
  RETRIES: 3,
  USER_AGENT: '@altitrace/sdk/0.1.0',
} as const

/**
 * Common addresses
 */
export const COMMON_ADDRESSES = {
  ZERO: '0x0000000000000000000000000000000000000000',
  HYPE: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  WHYPE: '0x5555555555555555555555555555555555555555',
} as const

/**
 * Client factory functions
 */
export const createClient = {
  local: (config: Partial<AltitraceClientConfig> = {}) =>
    new _AltitraceClient({
      baseUrl: 'http://localhost:8080/v1',
      debug: true,
      ...config,
    }),
  production: (config: Partial<AltitraceClientConfig> = {}) =>
    new _AltitraceClient({
      baseUrl: 'https://altitrace.reachaltitude.xyz/v1',
      debug: false,
      timeout: 60_000,
      ...config,
    }),
  testing: (config: Partial<AltitraceClientConfig> = {}) =>
    new _AltitraceClient({
      baseUrl: 'http://localhost:8080/v1',
      debug: true,
      timeout: 10_000,
      ...config,
    }),
}

/**
 * Default export
 */
export default _AltitraceClient
