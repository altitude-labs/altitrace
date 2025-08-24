import { AltitraceClient } from '@altitrace/sdk'

export function createAltitraceClient(): InstanceType<typeof AltitraceClient> {
  const isProduction = process.env.NODE_ENV === 'production'

  const baseUrl = isProduction ? '/api/altitrace' : process.env.NEXT_PUBLIC_API_URL

  return new AltitraceClient({
    baseUrl,
    debug: !isProduction,
    timeout: 30000,
  })
}
