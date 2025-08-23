import { AltitraceClient } from '@altitrace/sdk'

export function createAltitraceClient(): InstanceType<typeof AltitraceClient> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  const isDevelopment = process.env.NODE_ENV === 'development'
  const isProduction = process.env.NODE_ENV === 'production'

  if (isDevelopment && apiUrl) {
    return new AltitraceClient({
      baseUrl: 'http://localhost:3000/api/altitrace',
      debug: true,
      timeout: 30000,
    })
  }

  if (isProduction && !apiUrl) {
    return new AltitraceClient({
      baseUrl: 'http://localhost:8080/v1',
      debug: false,
      timeout: 30000,
    })
  }

  if (apiUrl) {
    return new AltitraceClient({
      baseUrl: `${apiUrl}/v1`,
      debug: isDevelopment,
      timeout: 30000,
    })
  }

  return new AltitraceClient({
    baseUrl: 'http://localhost:8080/v1',
    debug: isDevelopment,
    timeout: 30000,
  })
}
