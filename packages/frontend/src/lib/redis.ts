import { Redis } from 'ioredis'

let redis: Redis | null = null

export function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      lazyConnect: true,
      maxRetriesPerRequest: null,
    })

    redis.on('error', (error) => {
      console.error('Redis connection error:', error)
    })

    redis.on('connect', () => {
      console.log('Connected to Redis')
    })
  }

  return redis
}

export async function storeSimulation(id: string, data: any): Promise<boolean> {
  try {
    const client = getRedisClient()
    await client.setex(`sim:${id}`, 2592000, JSON.stringify(data)) // 30 days TTL
    return true
  } catch (error) {
    console.error('Failed to store simulation:', error)
    return false
  }
}

export async function retrieveSimulation(id: string): Promise<any | null> {
  try {
    const client = getRedisClient()
    const data = await client.get(`sim:${id}`)
    return data ? JSON.parse(data) : null
  } catch (error) {
    console.error('Failed to retrieve simulation:', error)
    return null
  }
}
