import { LRUCache } from 'lru-cache'
import { type NextRequest, NextResponse } from 'next/server'
import solc from 'solc'
import { z } from 'zod'
import { getCachedCompiler } from '@/lib/compiler-preload'

const { loadCached076Compiler } = require('../../../utils/load-cached-compiler')

// Security constants
const MAX_SOURCE_CODE_SIZE = 1024 * 1024 // 1MB
const COMPILATION_TIMEOUT = 30000 // 30 seconds

// Compiler cache to avoid reloading the same versions
const compilerCache = new LRUCache<string, any>({
  max: 15, // Cache up to 15 compiler versions
  ttl: 1000 * 60 * 60 * 24, // 24 hours
})

// Map frontend version strings to solc release versions
const VERSION_MAP: Record<string, string> = {
  'v0.8.30+commit.73712a01': '0.8.30',
  'v0.8.29+commit.e2cbbc3c': '0.8.29',
  'v0.8.28+commit.7893d4d0': '0.8.28',
  'v0.8.27+commit.40a35a09': '0.8.27',
  'v0.8.26+commit.8a97fa7a': '0.8.26',
  'v0.8.25+commit.b61c2a91': '0.8.25',
  'v0.8.24+commit.e11b9ed9': '0.8.24',
  'v0.8.23+commit.f704f362': '0.8.23',
  'v0.8.22+commit.4fc1097e': '0.8.22',
  'v0.8.21+commit.d9974bed': '0.8.21',
  'v0.8.20+commit.a1b79de6': '0.8.20',
  'v0.8.19+commit.7dd6d404': '0.8.19',
  'v0.8.18+commit.87f61d96': '0.8.18',
  'v0.8.17+commit.8df45f5f': '0.8.17',
  'v0.8.16+commit.07c72cc2': '0.8.16',
  'v0.8.15+commit.e14f2714': '0.8.15',
  'v0.8.14+commit.80d49f37': '0.8.14',
  'v0.8.13+commit.abaa5c0e': '0.8.13',
  'v0.8.12+commit.f00d7308': '0.8.12',
  'v0.8.11+commit.d7f03943': '0.8.11',
  'v0.8.10+commit.fc410830': '0.8.10',
  'v0.8.9+commit.e5eed63a': '0.8.9',
  'v0.8.8+commit.dddeac2f': '0.8.8',
  'v0.8.7+commit.e28d00a7': '0.8.7',
  'v0.8.6+commit.11564f7e': '0.8.6',
  'v0.8.5+commit.a4f2e591': '0.8.5',
  'v0.8.4+commit.c7e474f2': '0.8.4',
  'v0.8.3+commit.8d00100c': '0.8.3',
  'v0.8.2+commit.661d1103': '0.8.2',
  'v0.8.1+commit.df193b15': '0.8.1',
  'v0.8.0+commit.c7dfd78e': '0.8.0',
}

// Validation schema for compilation request
const CompileRequestSchema = z.object({
  sourceCode: z
    .string()
    .min(1, 'Source code is required')
    .max(
      MAX_SOURCE_CODE_SIZE,
      `Source code too large (max ${MAX_SOURCE_CODE_SIZE} bytes)`,
    ),
  contractName: z
    .string()
    .min(1, 'Contract name is required')
    .max(100, 'Contract name too long'),
  filePath: z.string().optional().default('Contract.sol'),
  additionalSources: z
    .array(
      z.object({
        filePath: z.string(),
        sourceCode: z.string(),
      }),
    )
    .optional()
    .default([]),
  compilerVersion: z.string().optional().default('v0.8.19+commit.7dd6d404'),
  optimization: z
    .object({
      enabled: z.boolean().default(true),
      runs: z.number().min(1).max(999999).default(200),
    })
    .optional()
    .default({ enabled: true, runs: 200 }),
})

interface CompileResponse {
  success: boolean
  abi?: any[]
  bytecode?: string
  errors?: string[]
  warnings?: string[]
  contractName?: string
  gasEstimates?: any
  detectedVersion?: string
  compilerVersion?: string
  usedFallbackCompiler?: boolean
  compilerLoadError?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = CompileRequestSchema.parse(body)

    // Run compilation with timeout
    const result = await Promise.race([
      compileContract(validatedData),
      new Promise<CompileResponse>((_, reject) =>
        setTimeout(
          () => reject(new Error('Compilation timeout')),
          COMPILATION_TIMEOUT,
        ),
      ),
    ])

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          errors: error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
        },
        { status: 400 },
      )
    }

    return NextResponse.json(
      {
        success: false,
        errors: [
          error instanceof Error
            ? error.message
            : 'Internal server error during compilation',
        ],
      },
      { status: 500 },
    )
  }
}

/**
 * Extract pragma solidity version from source code
 */
function extractSolidityVersion(sourceCode: string): string | null {
  // Look for pragma solidity statements
  const pragmaMatches = [
    // pragma solidity ^0.8.0;
    /pragma\s+solidity\s*\^?([0-9]+\.[0-9]+\.[0-9]+)/i,
    // pragma solidity >=0.7.0 <0.9.0;
    /pragma\s+solidity\s*>=\s*([0-9]+\.[0-9]+\.[0-9]+)/i,
    // pragma solidity =0.7.6;
    /pragma\s+solidity\s*=\s*([0-9]+\.[0-9]+\.[0-9]+)/i,
    // pragma solidity 0.8.19;
    /pragma\s+solidity\s*([0-9]+\.[0-9]+\.[0-9]+)/i,
  ]

  for (const regex of pragmaMatches) {
    const match = sourceCode.match(regex)
    if (match) {
      return match[1]
    }
  }

  return null
}

/**
 * Get compatible solc compiler for the specified version
 */
async function getCompatibleSolc(requestedVersion: string): Promise<{
  compiler: any
  usedFallback: boolean
  error?: string
}> {
  try {
    // Disable automatic preloading to avoid interference with cached compilers
    console.log(`🎯 getCompatibleSolc called with: ${requestedVersion}`)
    // if (!isPreloading && !preloadingPromise) {
    //   preloadCompilers().catch(err =>
    //     console.log('Background preloading failed:', err?.message || err)
    //   )
    // }

    // Check cache first
    const cached = compilerCache.get(requestedVersion)
    if (cached) {
      console.log(`📋 Using cached compiler for ${requestedVersion}`)
      return { compiler: cached.compiler, usedFallback: cached.usedFallback }
    }

    // Map frontend version string to actual version number
    // Extract simple version from full version string (e.g., v0.7.6+commit.xxx -> 0.7.6)
    let actualVersion = VERSION_MAP[requestedVersion] || requestedVersion

    // If we got a full version string that's not in the map, extract the simple version
    const versionMatch = requestedVersion.match(/v?([0-9]+\.[0-9]+\.[0-9]+)/)
    if (versionMatch && !VERSION_MAP[requestedVersion]) {
      actualVersion = versionMatch[1] // Extract just the version number (e.g., "0.7.6")
    }

    console.log(`🔄 Version mapping: ${requestedVersion} -> ${actualVersion}`)

    // For 0.8.30 (our installed version), use the default solc
    if (actualVersion === '0.8.30' || requestedVersion.includes('0.8.30')) {
      const result = { compiler: solc, usedFallback: false }
      compilerCache.set(requestedVersion, result)
      return result
    }

    // For other 0.8.x versions, the default 0.8.30 compiler is usually compatible
    const majorMinor = actualVersion.substring(0, 4) // e.g., "0.7.", "0.8."
    if (majorMinor === '0.8.' || actualVersion.startsWith('0.8')) {
      const result = { compiler: solc, usedFallback: false }
      compilerCache.set(requestedVersion, result)
      return result
    }

    // For 0.7.x versions, check if preloading is in progress, then try loading
    if (majorMinor === '0.7.' || actualVersion.startsWith('0.7')) {
      // Skip the unreliable preloading system for now

      // First try direct cached compiler loading for 0.7.6
      if (actualVersion === '0.7.6') {
        try {
          const cachedCompiler = loadCached076Compiler()
          if (cachedCompiler) {
            const result = { compiler: cachedCompiler, usedFallback: false }
            compilerCache.set(requestedVersion, result)
            compilerCache.set(actualVersion, result)
            return result
          }
        } catch {}
      }

      // Fallback: try the complex cached compiler system
      try {
        const cached = getCachedCompiler(actualVersion)
        if (cached) {
          const result = {
            compiler: cached.compiler,
            usedFallback: cached.usedFallback,
          }
          compilerCache.set(requestedVersion, result)
          compilerCache.set(actualVersion, result)
          return result
        }
      } catch (error) {
        console.error(error)
      }

      // Fallback to dynamic loading
      try {
        const compiler = (await Promise.race([
          loadSolcVersion(actualVersion),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Loading timeout')), 8000),
          ),
        ])) as any

        if (compiler) {
          const result = { compiler, usedFallback: false }
          compilerCache.set(requestedVersion, result)
          compilerCache.set(actualVersion, result)
          return result
        }
      } catch (error) {
        console.error(error)
      }
    }

    // Fallback to default solc - determine if this is a "real" fallback or just version difference
    const isReasonableIncompatibility = actualVersion.startsWith('0.7')
    const fallbackMessage = isReasonableIncompatibility
      ? `Could not load Solidity ${actualVersion}. Using 0.8.30 - note that 0.7.x and 0.8.x have breaking changes.`
      : `Using Solidity 0.8.30 compiler for ${actualVersion} (compatible)`
    const result = {
      compiler: solc,
      usedFallback: isReasonableIncompatibility, // Only count as fallback if actually incompatible
      error: isReasonableIncompatibility ? fallbackMessage : undefined,
    }
    compilerCache.set(requestedVersion, result)
    return result
  } catch (error) {
    const errorMessage = `Error loading compiler for version ${requestedVersion}: ${error instanceof Error ? error.message : 'Unknown error'}`
    // Fallback to default solc
    return { compiler: solc, usedFallback: true, error: errorMessage }
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
 * Get full version string for solc remote loading
 */
function getFullVersionString(version: string): string {
  // If it's already a full version string, return it
  if (version.includes('+commit.')) {
    return version
  }

  // Map common version numbers to full version strings
  const versionMap: Record<string, string> = {
    '0.8.30': 'v0.8.30+commit.73712a01',
    '0.8.29': 'v0.8.29+commit.e2cbbc3c',
    '0.8.28': 'v0.8.28+commit.7893d4d0',
    '0.8.27': 'v0.8.27+commit.40a35a09',
    '0.8.26': 'v0.8.26+commit.8a97fa7a',
    '0.8.25': 'v0.8.25+commit.b61c2a91',
    '0.8.24': 'v0.8.24+commit.e11b9ed9',
    '0.8.23': 'v0.8.23+commit.f704f362',
    '0.8.22': 'v0.8.22+commit.4fc1097e',
    '0.8.21': 'v0.8.21+commit.d9974bed',
    '0.8.20': 'v0.8.20+commit.a1b79de6',
    '0.8.19': 'v0.8.19+commit.7dd6d404',
    '0.8.18': 'v0.8.18+commit.87f61d96',
    '0.8.17': 'v0.8.17+commit.8df45f5f',
    '0.8.16': 'v0.8.16+commit.07c72cc2',
    '0.8.15': 'v0.8.15+commit.e14f2714',
    '0.8.14': 'v0.8.14+commit.80d49f37',
    '0.8.13': 'v0.8.13+commit.abaa5c0e',
    '0.8.12': 'v0.8.12+commit.f00d7308',
    '0.8.11': 'v0.8.11+commit.d7f03943',
    '0.8.10': 'v0.8.10+commit.fc410830',
    '0.8.9': 'v0.8.9+commit.e5eed63a',
    '0.8.8': 'v0.8.8+commit.dddeac2f',
    '0.8.7': 'v0.8.7+commit.e28d00a7',
    '0.8.6': 'v0.8.6+commit.11564f7e',
    '0.8.5': 'v0.8.5+commit.a4f2e591',
    '0.8.4': 'v0.8.4+commit.c7e474f2',
    '0.8.3': 'v0.8.3+commit.8d00100c',
    '0.8.2': 'v0.8.2+commit.661d1103',
    '0.8.1': 'v0.8.1+commit.df193b15',
    '0.8.0': 'v0.8.0+commit.c7dfd78e',
    // 0.7.x versions
    '0.7.6': 'v0.7.6+commit.7338295f',
    '0.7.5': 'v0.7.5+commit.eb77ed65',
    '0.7.4': 'v0.7.4+commit.3f05b770',
    '0.7.3': 'v0.7.3+commit.9bfce1f6',
    '0.7.2': 'v0.7.2+commit.51b20bc0',
    '0.7.1': 'v0.7.1+commit.f4a555be',
    '0.7.0': 'v0.7.0+commit.9e61f92b',
  }

  return versionMap[version] || `v${version}+commit.unknown`
}

async function compileContract(
  data: z.infer<typeof CompileRequestSchema>,
): Promise<CompileResponse> {
  const {
    sourceCode,
    contractName,
    filePath,
    additionalSources,
    optimization,
  } = data

  try {
    // Security checks
    const allSources = [
      sourceCode,
      ...additionalSources.map((s) => s.sourceCode),
    ]
    const totalSourceSize = allSources.reduce(
      (size, source) => size + source.length,
      0,
    )

    if (totalSourceSize > MAX_SOURCE_CODE_SIZE * 2) {
      return {
        success: false,
        errors: ['Total source code size too large'],
      }
    }

    // Check for complexity across all files
    const totalRequires = allSources.reduce(
      (count, source) => count + (source.match(/require\(/g)?.length || 0),
      0,
    )

    if (totalRequires > 100) {
      return {
        success: false,
        errors: [
          'Source code complexity too high - too many require statements across all files',
        ],
      }
    }

    // Auto-detect Solidity version from pragma
    const detectedVersion = extractSolidityVersion(sourceCode)
    if (detectedVersion) {
      console.log(`Detected Solidity version: ${detectedVersion}`)
    }

    // Get compatible compiler - prefer user-selected version, fallback to detected version
    const targetVersion =
      data.compilerVersion || detectedVersion || 'v0.8.19+commit.7dd6d404'
    console.log(
      `🎯 Target version for compilation: ${targetVersion} (detected: ${detectedVersion}, user: ${data.compilerVersion})`,
    )
    const compilerResult = await getCompatibleSolc(targetVersion)
    const compiler = compilerResult.compiler
    const usedFallback = compilerResult.usedFallback
    const compilerLoadError = compilerResult.error

    // Prepare sources object for compilation
    const sources: Record<string, { content: string }> = {
      [filePath]: {
        content: sourceCode,
      },
    }

    // Add additional source files
    for (const additionalSource of additionalSources) {
      sources[additionalSource.filePath] = {
        content: additionalSource.sourceCode,
      }
    }

    // Prepare Solidity compiler input
    const input = {
      language: 'Solidity',
      sources,
      settings: {
        optimizer: {
          enabled: optimization.enabled,
          runs: optimization.runs,
        },
        outputSelection: {
          '*': {
            '*': [
              'abi',
              'evm.bytecode',
              'evm.deployedBytecode',
              'evm.gasEstimates',
              'metadata',
            ],
          },
        },
        // Security: Empty remappings for security
        remappings: [],
      },
    }

    // Compile with compatible solc version
    const output = JSON.parse(compiler.compile(JSON.stringify(input)))

    // Add compiler loading warnings only for real incompatibilities
    if (usedFallback && compilerLoadError) {
      const isRealIncompatibility = detectedVersion?.startsWith('0.7')

      if (isRealIncompatibility) {
        if (!output.errors) {
          output.errors = []
        }
        output.errors.push({
          severity: 'warning',
          type: 'CompilerFallback',
          message: compilerLoadError,
        })

        // Add specific 0.7.x -> 0.8.x warning
        output.errors.push({
          severity: 'warning',
          type: 'VersionCompatibility',
          message: `Contract uses Solidity ${detectedVersion} but compiler is 0.8.30. Some features may not work as expected due to breaking changes. Consider updating to ^0.8.0 for full compatibility.`,
        })
      }
      // For compatible versions (0.8.x), don't show warnings
    }

    // Process errors and warnings
    const errors: string[] = []
    const warnings: string[] = []

    if (output.errors) {
      for (const error of output.errors) {
        const message = `${error.type}: ${error.message}`
        if (error.severity === 'error') {
          // Handle version compatibility errors specifically
          if (
            message.includes('different compiler version') ||
            message.includes('requires different')
          ) {
            if (detectedVersion) {
              errors.push(
                `Compiler version mismatch: Contract requires Solidity ${detectedVersion}, but server has 0.8.30. ${error.message}`,
              )
            } else {
              errors.push(
                `${message} - Try specifying the correct pragma solidity version in your contract.`,
              )
            }
          } else {
            errors.push(message)
          }
        } else if (error.severity === 'warning') {
          warnings.push(message)
        }
      }
    }

    // If compilation failed due to version mismatch, provide helpful guidance
    if (errors.length > 0) {
      const hasVersionError = errors.some(
        (error) =>
          error.includes('different compiler version') ||
          error.includes('requires different') ||
          error.includes('version mismatch'),
      )

      if (hasVersionError && detectedVersion) {
        errors.push(
          `💡 Solution: Update your pragma to use a compatible version like "pragma solidity ^0.8.0;" or install Solidity ${detectedVersion} compiler.`,
        )

        // Add specific migration suggestions for common version differences
        if (detectedVersion.startsWith('0.7')) {
          errors.push(
            '🔄 Migration tip: Solidity 0.8.x has breaking changes from 0.7.x. Main changes: built-in overflow protection, stricter type checking.',
          )
        }
      }

      return {
        success: false,
        errors,
        warnings: warnings.length > 0 ? warnings : undefined,
      }
    }

    // Extract compiled contract data
    let abi: any[] | undefined
    let bytecode: string | undefined
    let gasEstimates: any | undefined
    let actualContractName = contractName

    if (output.contracts) {
      // First try the main file
      let sourceFile = output.contracts[filePath]

      // If not found, try other files that might contain the target contract
      if (!sourceFile) {
        const allFiles = Object.keys(output.contracts)
        for (const fileName of allFiles) {
          const fileContracts = output.contracts[fileName]
          if (
            fileContracts &&
            Object.keys(fileContracts).includes(contractName)
          ) {
            sourceFile = fileContracts
            break
          }
        }
      }

      if (sourceFile) {
        // Find the main contract (could be different from filename)
        const contractNames = Object.keys(sourceFile)
        if (contractNames.length > 0) {
          // Use the first contract found, or match by name if available
          const foundContractName =
            contractNames.find(
              (name) => name.toLowerCase() === contractName.toLowerCase(),
            ) || contractNames[0]

          actualContractName = foundContractName
          const contractData = sourceFile[foundContractName]

          if (contractData) {
            abi = contractData.abi
            bytecode = contractData.evm?.bytecode?.object
            gasEstimates = contractData.evm?.gasEstimates

            // Add 0x prefix if missing
            if (bytecode && !bytecode.startsWith('0x')) {
              bytecode = `0x${bytecode}`
            }
          }
        }
      }
    }

    // Validate that we got meaningful output
    if (!abi || abi.length === 0) {
      return {
        success: false,
        errors: ['No ABI generated - contract may be empty or invalid'],
        warnings: warnings.length > 0 ? warnings : undefined,
      }
    }

    return {
      success: true,
      abi,
      bytecode,
      gasEstimates,
      warnings: warnings.length > 0 ? warnings : undefined,
      contractName: actualContractName,
      detectedVersion: detectedVersion || undefined,
      compilerVersion: data.compilerVersion || '0.8.30+commit.73712a01',
      usedFallbackCompiler: usedFallback,
      compilerLoadError: usedFallback ? compilerLoadError : undefined,
    }
  } catch (error) {
    // Handle solc compilation errors
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown compilation error'

    return {
      success: false,
      errors: [`Compilation failed: ${errorMessage}`],
    }
  }
}
