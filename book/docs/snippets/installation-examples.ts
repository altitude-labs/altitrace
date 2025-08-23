// [!region imports]
import { AltitraceClient, VERSION } from '@altitrace/sdk'
// [!endregion imports]

// [!region verification]
const client = new AltitraceClient({
  baseUrl: 'http://localhost:8080/v1',
})

console.log(`Altitrace SDK version: ${VERSION}`)
console.log('SDK installed successfully')
// [!endregion verification]

// [!region modular-imports]
// Import specific functionality for tree-shaking
import { createClient } from '@altitrace/sdk'

// Import specific types
import type {
  ExtendedSimulationResult,
  ExtendedTracerResponse,
  ExtendedAccessListResponse,
} from '@altitrace/sdk'

// Import client classes directly
import { SimulationClient } from '@altitrace/sdk/client/simulation'
import { TraceClient } from '@altitrace/sdk/client/trace'

// Import validation utilities
import { ValidationUtils } from '@altitrace/sdk/utils/validation'
// [!endregion modular-imports]

// [!region environment-setup]
// Environment-based client setup
const envClient = new AltitraceClient({
  baseUrl: process.env.ALTITRACE_API_URL || 'http://localhost:8080/v1',
  debug: process.env.NODE_ENV === 'development',
  headers: {
    'X-API-Key': process.env.ALTITRACE_API_KEY || '',
  },
})
// [!endregion environment-setup]
