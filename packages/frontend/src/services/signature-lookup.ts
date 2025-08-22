import { LRUCache } from 'lru-cache'

const OPENCHAIN_API_URL =
  'https://api.openchain.xyz/signature-database/v1/lookup'

export interface SignatureInfo {
  name: string
  filtered: boolean
}

interface OpenChainResponse {
  ok: boolean
  result?: {
    event?: Record<string, SignatureInfo[] | null>
    function?: Record<string, SignatureInfo[] | null>
  }
}

// Type wrapper for null values in cache
type CachedSignature = SignatureInfo | { isNull: true }

export class SignatureLookupService {
  private cache: LRUCache<string, CachedSignature>
  private pendingRequests: Map<string, Promise<SignatureInfo | null>>

  constructor() {
    // Cache signatures for 24 hours with max 1000 entries
    this.cache = new LRUCache<string, CachedSignature>({
      max: 1000,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
    })
    this.pendingRequests = new Map()
  }

  async lookupEventSignature(signature: string): Promise<SignatureInfo | null> {
    // Check cache first
    if (this.cache.has(signature)) {
      const cached = this.cache.get(signature)
      if (cached && 'isNull' in cached) {
        return null
      }
      return cached ?? null
    }

    // Check if there's already a pending request for this signature
    const pendingRequest = this.pendingRequests.get(signature)
    if (pendingRequest) {
      return pendingRequest
    }

    // Create new request
    const requestPromise = this.fetchSignature(signature)
    this.pendingRequests.set(signature, requestPromise)

    try {
      const result = await requestPromise
      // Cache the result, wrapping null values
      this.cache.set(signature, result || { isNull: true })
      return result
    } finally {
      this.pendingRequests.delete(signature)
    }
  }

  private async fetchSignature(
    signature: string,
  ): Promise<SignatureInfo | null> {
    try {
      const params = new URLSearchParams({
        event: signature,
        filter: 'true',
      })

      const response = await fetch(`${OPENCHAIN_API_URL}?${params}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        return null
      }

      const data: OpenChainResponse = await response.json()

      if (!data.ok || !data.result?.event?.[signature]) {
        return null
      }

      const signatures = data.result.event[signature]
      if (!signatures || signatures.length === 0) {
        return null
      }

      // Return the first non-filtered signature, or the first one if all are filtered
      const preferredSignature =
        signatures.find((sig) => !sig.filtered) || signatures[0]
      return preferredSignature
    } catch {
      return null
    }
  }

  // Batch lookup for multiple signatures
  async lookupEventSignatures(
    signatures: string[],
  ): Promise<Map<string, SignatureInfo | null>> {
    const results = new Map<string, SignatureInfo | null>()

    // Check cache and filter out signatures that need fetching
    const toFetch: string[] = []
    for (const sig of signatures) {
      if (this.cache.has(sig)) {
        const cached = this.cache.get(sig)
        if (cached && 'isNull' in cached) {
          results.set(sig, null)
        } else {
          results.set(sig, cached ?? null)
        }
      } else {
        toFetch.push(sig)
      }
    }

    // Fetch missing signatures in parallel
    if (toFetch.length > 0) {
      const fetchPromises = toFetch.map((sig) =>
        this.lookupEventSignature(sig).then((info) => ({ sig, info })),
      )

      const fetched = await Promise.all(fetchPromises)
      for (const { sig, info } of fetched) {
        results.set(sig, info)
      }
    }

    return results
  }

  // Clear the cache if needed
  clearCache(): void {
    this.cache.clear()
  }

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.cache.size,
      calculatedSize: this.cache.calculatedSize,
    }
  }
}

// Singleton instance
export const signatureLookup = new SignatureLookupService()
