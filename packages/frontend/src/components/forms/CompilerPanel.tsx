'use client'

import { CheckIcon, XIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Abi } from 'viem'
import { Alert, AlertDescription, Button, Select } from '@/components/ui'

interface CompilerPanelProps {
  sourceCode: string
  originalAbi: Abi
  onCompilationResult: (result: {
    success: boolean
    abi?: Abi
    bytecode?: string
    errors?: string[]
    warnings?: string[]
    abiMatches?: boolean
    detectedVersion?: string
    compilerVersion?: string
    usedFallbackCompiler?: boolean
    compilerLoadError?: string
  }) => void
  compilerVersion?: string
  optimization?: { enabled: boolean; runs: number }
  filePath?: string 
  additionalSources?: Array<{
    filePath: string
    sourceCode: string
  }>
  autoCompile?: boolean
}

/**
 * Extract the main contract name from source code
 */
function extractContractName(sourceCode: string): string | null {
  // Look for contract declarations
  const contractMatch = sourceCode.match(/contract\s+(\w+)\s*[{(]/)
  if (contractMatch) {
    return contractMatch[1]
  }

  // Look for interface declarations as fallback
  const interfaceMatch = sourceCode.match(/interface\s+(\w+)\s*[{(]/)
  if (interfaceMatch) {
    return interfaceMatch[1]
  }

  // Look for library declarations as fallback
  const libraryMatch = sourceCode.match(/library\s+(\w+)\s*[{(]/)
  if (libraryMatch) {
    return libraryMatch[1]
  }

  return null
}

// Available Solidity compiler versions (subset of commonly used ones)
const COMPILER_VERSIONS = [
  'v0.8.30+commit.f0b45c9c',
  'v0.8.29+commit.e104f75c',
  'v0.8.28+commit.7893614a',
  'v0.8.27+commit.40a35a09',
  'v0.8.26+commit.8a97fa7a',
  'v0.8.25+commit.b61c2a91',
  'v0.8.24+commit.e11b9ed9',
  'v0.8.23+commit.f704f362',
  'v0.8.22+commit.4fc1097e',
  'v0.8.21+commit.d9974bed',
  'v0.8.20+commit.a1b79de6',
  'v0.8.19+commit.7dd6d404',
  'v0.8.18+commit.87f61d96',
  'v0.8.17+commit.8df45f5f',
  'v0.8.16+commit.07c72cc5',
  'v0.8.15+commit.e14f2714',
  'v0.8.14+commit.80d49f37',
  'v0.8.13+commit.abaa5c0e',
  'v0.8.12+commit.f00d7308',
  'v0.8.11+commit.d7f03943',
  'v0.8.10+commit.fc410830',
  'v0.8.9+commit.e5eed63a',
  'v0.8.8+commit.dddeac2f',
  'v0.8.7+commit.e28d00a7',
  'v0.8.6+commit.11564f7e',
  'v0.8.5+commit.a4f2e591',
  'v0.8.4+commit.c7e474f2',
  'v0.8.3+commit.8d00100c',
  'v0.8.2+commit.661d1103',
  'v0.8.1+commit.df193b15',
  'v0.8.0+commit.c7dfd78e',
]

export function CompilerPanel({
  sourceCode,
  originalAbi,
  onCompilationResult,
  compilerVersion = 'v0.8.19+commit.7dd6d404',
  optimization = { enabled: true, runs: 200 },
  filePath = 'Contract.sol',
  additionalSources = [],
  autoCompile = true,
}: CompilerPanelProps) {
  const [selectedVersion, setSelectedVersion] = useState(compilerVersion)
  const [optimizationEnabled, setOptimizationEnabled] = useState(
    optimization.enabled,
  )
  const [optimizationRuns, setOptimizationRuns] = useState(optimization.runs)
  const [isCompiling, setIsCompiling] = useState(false)
  const [isAutoDetected, setIsAutoDetected] = useState(false)
  const [lastDetectedVersion, setLastDetectedVersion] = useState<string | null>(
    null,
  )
  const [preloadStatus, setPreloadStatus] = useState<{
    isPreloading: boolean
    loadedCount: number
    totalVersions: number
  } | null>(null)
  const [lastResult, setLastResult] = useState<{
    success: boolean
    abi?: Abi
    bytecode?: string
    errors?: string[]
    warnings?: string[]
    abiMatches?: boolean
    detectedVersion?: string
    compilerVersion?: string
    usedFallbackCompiler?: boolean
    compilerLoadError?: string
  } | null>(null)

  // Check preload status on mount
  useEffect(() => {
    const checkPreloadStatus = async () => {
      try {
        const response = await fetch('/api/compilers/preload')
        if (response.ok) {
          const status = await response.json()
          setPreloadStatus({
            isPreloading: status.isPreloading,
            loadedCount: status.loadedCount,
            totalVersions: status.totalVersions,
          })
        }
      } catch {
        console.log('Could not check preload status')
      }
    }

    checkPreloadStatus()
  }, [])

  const compareAbis = (abi1: Abi, abi2: Abi): boolean => {
    try {
      // Sort and stringify for comparison
      const normalize = (abi: Abi) => {
        return JSON.stringify(
          abi
            .filter(
              (item: any) => item.type === 'function' || item.type === 'event',
            )
            .sort((a: any, b: any) => {
              if (a.type !== b.type) return a.type.localeCompare(b.type)
              return a.name?.localeCompare(b.name || '') || 0
            }),
        )
      }

      return normalize(abi1) === normalize(abi2)
    } catch {
      return false
    }
  }

  const handleCompile = useCallback(async () => {
    if (!sourceCode.trim()) {
      const result = { success: false, errors: ['No source code provided'] }
      setLastResult(result)
      onCompilationResult(result)
      return
    }

    setIsCompiling(true)

    try {
      // Call server-side compilation API
      const response = await fetch('/api/compile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceCode,
          contractName: extractContractName(sourceCode) || 'Contract',
          filePath,
          additionalSources,
          compilerVersion: selectedVersion,
          optimization: {
            enabled: optimizationEnabled,
            runs: optimizationRuns,
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`Compilation request failed: ${response.statusText}`)
      }

      const output = await response.json()

      // Server API already provides the processed format
      let abiMatches = false

      // Compare with original ABI if compilation was successful
      if (output.success && output.abi && originalAbi.length > 0) {
        abiMatches = compareAbis(output.abi, originalAbi)
      }

      const result = {
        success: output.success,
        abi: output.abi,
        bytecode: output.bytecode,
        errors: output.errors,
        warnings: output.warnings,
        abiMatches,
        detectedVersion: output.detectedVersion,
        compilerVersion: output.compilerVersion,
        usedFallbackCompiler: output.usedFallbackCompiler,
        compilerLoadError: output.compilerLoadError,
      }

      // Auto-update compiler version if detected and different from current
      if (
        output.detectedVersion &&
        output.detectedVersion !== lastDetectedVersion
      ) {
        setLastDetectedVersion(output.detectedVersion)

        // Find matching version string from available versions
        const matchingVersion = COMPILER_VERSIONS.find((v) =>
          v.includes(output.detectedVersion?.replace(/[^0-9.]/g, '') || ''),
        )

        if (matchingVersion && matchingVersion !== selectedVersion) {
          setSelectedVersion(matchingVersion)
          setIsAutoDetected(true)

          // Show user that version was auto-detected
          console.log(
            `Auto-detected compiler version: ${output.detectedVersion} -> ${matchingVersion}`,
          )
        }
      }

      setLastResult(result)
      onCompilationResult(result)
    } catch (error) {
      const result = {
        success: false,
        errors: [error instanceof Error ? error.message : 'Compilation failed'],
      }
      setLastResult(result)
      onCompilationResult(result)
    } finally {
      setIsCompiling(false)
    }
  }, [
    sourceCode,
    onCompilationResult,
    filePath,
    additionalSources,
    selectedVersion,
    optimizationEnabled,
    optimizationRuns,
    originalAbi,
    compareAbis,
    lastDetectedVersion,
  ])

  // Auto-compile when source code changes (debounced) - only if enabled
  useEffect(() => {
    if (!autoCompile || !sourceCode.trim()) return

    const timer = setTimeout(() => {
      handleCompile()
    }, 2000) // 2 second debounce

    return () => clearTimeout(timer)
  }, [sourceCode, handleCompile, autoCompile])

  return (
    <div className="space-y-4">
      {/* Compiler Settings */}
      <div className="bg-card border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-3">Compiler Settings</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Compiler Version */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-sm font-medium">Solidity Version</label>
              {isAutoDetected && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  Auto-detected
                </span>
              )}
              {lastResult?.usedFallbackCompiler && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                  Fallback compiler
                </span>
              )}
              {preloadStatus?.isPreloading && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full animate-pulse">
                  Loading compilers...
                </span>
              )}
              {preloadStatus &&
                !preloadStatus.isPreloading &&
                preloadStatus.loadedCount > 0 && (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                    {preloadStatus.loadedCount}/{preloadStatus.totalVersions}{' '}
                    compilers ready
                  </span>
                )}
            </div>
            <Select
              value={selectedVersion}
              onChange={(e) => {
                setSelectedVersion(e.target.value)
                setIsAutoDetected(false) // User manually changed version
              }}
              options={COMPILER_VERSIONS.map((version) => ({
                value: version,
                label: version,
              }))}
              className="text-xs"
            />
            {lastDetectedVersion && (
              <p className="text-xs text-gray-500 mt-1">
                Detected in pragma: {lastDetectedVersion}
              </p>
            )}
            {lastResult?.usedFallbackCompiler &&
              lastResult?.compilerLoadError && (
                <p className="text-xs text-yellow-600 mt-1">
                  ⚠️ {lastResult.compilerLoadError}
                </p>
              )}
            {preloadStatus?.isPreloading && (
              <p className="text-xs text-blue-600 mt-1">
                🔄 Loading 0.7.x compilers in background... (
                {preloadStatus.loadedCount}/{preloadStatus.totalVersions})
              </p>
            )}
          </div>

          {/* Optimization Settings */}
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={optimizationEnabled}
                onChange={(e) => setOptimizationEnabled(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-xs font-medium">Enable Optimization</span>
            </label>

            {optimizationEnabled && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Optimizer Runs
                </label>
                <input
                  type="number"
                  value={optimizationRuns}
                  onChange={(e) => setOptimizationRuns(Number(e.target.value))}
                  className="w-full px-2 py-1 text-xs border rounded"
                  min="1"
                  max="999999"
                />
              </div>
            )}
          </div>
        </div>

        {/* Compile Button */}
        <div className="flex justify-end mt-4">
          <Button
            onClick={handleCompile}
            disabled={isCompiling || !sourceCode.trim()}
            loading={isCompiling}
            size="sm"
          >
            {isCompiling ? 'Compiling...' : 'Compile Now'}
          </Button>
        </div>
      </div>

      {/* Compilation Results */}
      {lastResult && (
        <div className="space-y-3">
          {/* Success/Error Status */}
          <div
            className={`flex items-center gap-2 p-3 rounded-lg border ${
              lastResult.success
                ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
            }`}
          >
            {lastResult.success ? (
              <CheckIcon className="h-4 w-4 text-green-600" />
            ) : (
              <XIcon className="h-4 w-4 text-red-600" />
            )}
            <span
              className={`text-sm font-medium ${
                lastResult.success
                  ? 'text-green-800 dark:text-green-200'
                  : 'text-red-800 dark:text-red-200'
              }`}
            >
              {lastResult.success
                ? 'Compilation Successful'
                : 'Compilation Failed'}
            </span>

            <div className="ml-auto flex items-center gap-2">
              {/* Compiler version used */}
              {lastResult.compilerVersion && (
                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded">
                  {lastResult.compilerVersion}
                </span>
              )}

              {/* ABI verification for successful compilations */}
              {lastResult.success &&
                originalAbi.length > 0 &&
                (lastResult.abiMatches ? (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded">
                    ✓ ABI Verified
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 rounded">
                    ⚠ ABI Differs
                  </span>
                ))}
            </div>
          </div>

          {/* Compilation Info */}
          {lastResult.success && lastResult.abi && (
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-muted/30 rounded p-2">
                <div className="font-medium">Functions</div>
                <div className="text-muted-foreground">
                  {
                    lastResult.abi.filter(
                      (item: any) => item.type === 'function',
                    ).length
                  }
                </div>
              </div>
              <div className="bg-muted/30 rounded p-2">
                <div className="font-medium">Events</div>
                <div className="text-muted-foreground">
                  {
                    lastResult.abi.filter((item: any) => item.type === 'event')
                      .length
                  }
                </div>
              </div>
            </div>
          )}

          {/* Errors */}
          {lastResult.errors && lastResult.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                <div className="space-y-1">
                  {lastResult.errors.map((error, index) => (
                    <div key={index} className="text-xs font-mono">
                      {error}
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Warnings */}
          {lastResult.warnings && lastResult.warnings.length > 0 && (
            <Alert>
              <AlertDescription>
                <div className="text-sm font-medium mb-1">Warnings:</div>
                <div className="space-y-1">
                  {lastResult.warnings.map((warning, index) => (
                    <div
                      key={index}
                      className="text-xs font-mono text-muted-foreground"
                    >
                      {warning}
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  )
}
