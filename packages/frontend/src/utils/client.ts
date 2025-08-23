import { AltitraceClient } from '@altitrace/sdk'

export function createAltitraceClient(): InstanceType<typeof AltitraceClient> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  if (!apiUrl) {
    console.log('NEXT_PUBLIC_API_URL not set, using localhost:8080 as fallback')
  }

  return new AltitraceClient({
    baseUrl: apiUrl ? `${apiUrl}/v1` : 'http://localhost:8080/v1',
    debug: process.env.NODE_ENV === 'development',
    timeout: 30000,
  })
}
