import { AltitraceClient } from '@altitrace/sdk'

export function createAltitraceClient(): InstanceType<typeof AltitraceClient> {
  const isProduction = process.env.NODE_ENV === 'production'

  return new AltitraceClient({
    baseUrl: '/api/altitrace',
    debug: !isProduction,
    timeout: 30000,
  })
}
