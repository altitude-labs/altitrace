import { useEffect, useState } from 'react'
import { signatureLookup } from '@/services/signature-lookup'

export interface EventSignatureData {
  name: string
  params: Array<{ name: string; type: string; indexed: boolean }>
}

// Parse event signature string like "Transfer(address,address,uint256)"
function parseEventSignature(
  signatureString: string,
): EventSignatureData | null {
  const match = signatureString.match(/^(\w+)\((.*)\)$/)
  if (!match) {
    return null
  }

  const [, name, paramsString] = match

  // Parse parameter types
  const paramTypes = paramsString ? paramsString.split(',') : []

  // For standard events, we can make educated guesses about indexing
  // The first 1-3 parameters are often indexed for common patterns
  const params = paramTypes.map((type, index) => {
    const cleanType = type.trim()
    // Common heuristic: addresses are often indexed, especially in the first 3 positions
    const likelyIndexed = index < 3 && (cleanType === 'address' || index < 2)

    return {
      name: `param${index}`,
      type: cleanType,
      indexed: likelyIndexed,
    }
  })

  return { name, params }
}

export function useEventSignature(
  signature: string | undefined,
  knownSignature?: EventSignatureData,
) {
  const [eventData, setEventData] = useState<EventSignatureData | null>(
    knownSignature || null,
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // If we already have known signature data, use it
    if (knownSignature) {
      setEventData(knownSignature)
      return
    }

    // If no signature provided, reset
    if (!signature) {
      setEventData(null)
      setIsLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    const fetchSignature = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const signatureInfo =
          await signatureLookup.lookupEventSignature(signature)

        if (cancelled) return

        if (signatureInfo) {
          const parsed = parseEventSignature(signatureInfo.name)
          if (parsed) {
            setEventData(parsed)
          } else {
            setError('Failed to parse event signature')
          }
        } else {
          setEventData(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to lookup signature',
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchSignature()

    return () => {
      cancelled = true
    }
  }, [signature, knownSignature])

  return { eventData, isLoading, error }
}
