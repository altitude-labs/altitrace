import { AltitraceClient } from '@altitrace/sdk'

export function createAltitraceClient(): InstanceType<typeof AltitraceClient> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  const isProduction = process.env.NODE_ENV === 'production'
  
  if (isProduction) {
    if (apiUrl) {
      return new AltitraceClient({
        baseUrl: `${apiUrl}/v1`,
        debug: false,
        timeout: 30000,
      })
    } else {
      return new AltitraceClient({
        baseUrl: '/api/altitrace',
        debug: false,
        timeout: 30000,
      })
    }
  }
  
  if (apiUrl) {
    return new AltitraceClient({
      baseUrl: `${apiUrl}/v1`,
      debug: true,
      timeout: 30000,
    })
  }
  
  return new AltitraceClient({
    baseUrl: '/api/altitrace',
    debug: true,
    timeout: 30000,
  })
}
