/**
 * Compiler preloading utilities shared between API routes
 */

import { LRUCache } from 'lru-cache'
import solc from 'solc'

// Cache for loaded compilers
const compilerCache = new LRUCache<
  string,
  { compiler: any; usedFallback: boolean; error?: string }
>({
  max: 10, // Cache up to 10 compiler versions
  ttl: 1000 * 60 * 60 * 24, // 24 hours
})

// Preloading state
let isPreloading = false
let preloadingPromise: Promise<void> | null = null

// Supported legacy versions for preloading
const SUPPORTED_LEGACY_VERSIONS = [
  '0.8.19',
  '0.8.18',
  '0.8.17',
  '0.8.16',
  '0.8.15',
  '0.7.6',
  '0.7.5',
  '0.7.4',
]

// Version mapping for full version strings
const VERSION_COMMIT_MAP: Record<string, string> = {
  '0.8.19': 'v0.8.19+commit.7dd6d404',
  '0.8.18': 'v0.8.18+commit.87f61d96',
  '0.8.17': 'v0.8.17+commit.8df45f5f',
  '0.8.16': 'v0.8.16+commit.07c72cc2',
  '0.8.15': 'v0.8.15+commit.e14f2714',
  '0.7.6': 'v0.7.6+commit.7338295f',
  '0.7.5': 'v0.7.5+commit.eb77ed08',
  '0.7.4': 'v0.7.4+commit.3f05b770',
}

/**
 * Get full version string with commit for solc loading
 */
function getFullVersionString(version: string): string {
  return VERSION_COMMIT_MAP[version] || version
}

/**
 * Get cache status information
 */
function getCacheStatus() {
  const cacheSize = compilerCache.size
  const cachedVersions = [...compilerCache.keys()]

  return {
    cacheSize,
    cachedVersions,
    maxSize: compilerCache.max,
    totalMemoryVersions: cachedVersions.length,
  }
}

/**
 * Dynamically load a specific solc version using solc's built-in capabilities
 */
async function loadSolcVersion(version: string): Promise<any> {
  try {
    // For version format conversion (e.g., "0.8.19" -> "v0.8.19+commit.7dd6d404")
    const fullVersionString = getFullVersionString(version)

    // Load the remote version with timeout using solc.loadRemoteVersion
    const compiler = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(`Timeout loading compiler version ${fullVersionString}`),
        )
      }, 20000) // 20 second timeout

      solc.loadRemoteVersion(
        fullVersionString,
        (err: any, solcSnapshot: any) => {
          clearTimeout(timeout)

          if (err) {
            reject(err)
          } else if (!solcSnapshot) {
            reject(
              new Error(
                `No compiler snapshot returned for ${fullVersionString}`,
              ),
            )
          } else {
            resolve(solcSnapshot)
          }
        },
      )
    })

    return compiler
  } catch (_error) {
    return null
  }
}

/**
 * Preload common compiler versions at startup
 */
export async function preloadCompilers(): Promise<void> {
  if (isPreloading || preloadingPromise) {
    return preloadingPromise || Promise.resolve()
  }

  isPreloading = true

  preloadingPromise = (async () => {
    const loadPromises = SUPPORTED_LEGACY_VERSIONS.map(async (version) => {
      try {
        const fullVersion = getFullVersionString(version)

        const compiler = await loadSolcVersion(version)
        if (compiler) {
          // Cache both the version string and the full version string
          compilerCache.set(version, { compiler, usedFallback: false })
          compilerCache.set(fullVersion, { compiler, usedFallback: false })
        } else {
        }
      } catch (_error) {}
    })

    await Promise.allSettled(loadPromises)
  })()

  await preloadingPromise
  isPreloading = false
}

/**
 * Get preloading status for monitoring
 */
export function getPreloadStatus() {
  const cacheStatus = getCacheStatus()
  const memoryLoadedVersions = SUPPORTED_LEGACY_VERSIONS.filter((v) =>
    compilerCache.has(v),
  )

  return {
    isPreloading,
    totalVersions: SUPPORTED_LEGACY_VERSIONS.length,
    loadedCount: memoryLoadedVersions.length,
    loadedVersions: memoryLoadedVersions,
    missingVersions: SUPPORTED_LEGACY_VERSIONS.filter(
      (v) => !compilerCache.has(v),
    ),
    cacheSize: compilerCache.size,
    cacheInfo: cacheStatus,
    supportedVersions: SUPPORTED_LEGACY_VERSIONS,
  }
}

/**
 * Get a compiler from cache if available
 */
export function getCachedCompiler(
  version: string,
): { compiler: any; usedFallback: boolean; error?: string } | null {
  return compilerCache.get(version) || null
}

/**
 * Store a compiler in cache
 */
export function setCachedCompiler(
  version: string,
  compiler: any,
  usedFallback = false,
  error?: string,
) {
  compilerCache.set(version, { compiler, usedFallback, error })
}
