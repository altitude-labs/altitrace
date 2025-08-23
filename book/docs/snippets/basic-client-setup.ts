// [!region imports]
import { createClient, AltitraceClient } from '@altitrace/sdk'
// [!endregion imports]

// [!region factory-functions]
// Local development with debug features enabled
const localClient = createClient.local()
console.log('Local client created')

// Production configuration with optimized settings
const prodClient = createClient.production()
console.log('Production client created')

// Testing configuration with shorter timeouts
const testClient = createClient.testing()
console.log('Testing client created')
// [!endregion factory-functions]

// [!region custom-config]
const customClient = new AltitraceClient({
  baseUrl: 'https://api.altitrace.com/v1',
  timeout: 45000,
  debug: true,
  headers: {
    'X-API-Key': process.env.ALTITRACE_API_KEY || 'your-api-key',
    'User-Agent': 'MyApp/1.0.0',
  },
})
console.log('Custom client created')
// [!endregion custom-config]

// [!region environment-config]
// Development Environment
const devClient = new AltitraceClient({
  baseUrl: 'http://localhost:8080/v1',
  debug: true,
  timeout: 60000, // Longer timeout for debugging
})
console.log('Dev client created')

// Production Environment
const prodClientAdvanced = new AltitraceClient({
  baseUrl: 'https://api.altitrace.com/v1',
  timeout: 20000,
  headers: {
    'X-API-Key': process.env.ALTITRACE_PROD_API_KEY || 'prod-api-key',
    'X-Environment': 'production',
  },
  debug: false, // Disable debug logging in production
})
console.log('Advanced production client created')
// [!endregion environment-config]
