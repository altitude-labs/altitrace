'use client'

import type { ExtendedTracerResponse } from '@altitrace/sdk/types'
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  FuelIcon,
  LayersIcon,
  TrendingUpIcon,
  XCircleIcon,
} from 'lucide-react'
import React from 'react'
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import { parseBlockchainError } from '@/utils/error-parser'
import { CallFrameNode } from './CallFrameNode'

interface CallTraceTreeProps {
  traceData: ExtendedTracerResponse
  className?: string
}

/**
 * Main component for displaying hierarchical call trace tree
 */
export function CallTraceTree({
  traceData,
  className = '',
}: CallTraceTreeProps) {
  const rootCall = traceData.callTracer?.rootCall

  if (!rootCall) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center text-muted-foreground">
          No call trace data available
        </CardContent>
      </Card>
    )
  }

  // Calculate summary statistics
  const totalCalls = traceData.getCallCount()
  const maxDepth = traceData.getMaxDepth()
  // Use root call gas - this includes all subcall gas consumption
  // Note: Individual call gas values in hierarchical traces are NOT additive
  // Each frame's gasUsed includes gas consumed by its children
  const totalGasUsed = rootCall
    ? Number(BigInt(rootCall.gasUsed))
    : Number(traceData.getTotalGasUsed())
  const isSuccess = traceData.isSuccess()
  const errors = traceData.getErrors()

  // Process errors to combine generic revert messages with actual error data
  const processedErrors = React.useMemo(() => {
    if (errors.length <= 1) return errors
    
    // Parse all errors
    const parsedErrors = errors.map(error => ({
      original: error,
      parsed: parseBlockchainError(error)
    }))
    
    // Look for pairs of generic revert + specific error data
    const genericReverts = parsedErrors.filter(e => 
      e.parsed.type === 'revert' && 
      (e.parsed.details === 'execution reverted' || 
       e.parsed.details === 'The transaction was reverted by the contract' ||
       !e.parsed.details)
    )
    
    const specificErrors = parsedErrors.filter(e => {
      // Contract error codes or specific error messages
      if (e.parsed.type === 'revert' && e.parsed.details) {
        const details = e.parsed.details
        return details !== 'execution reverted' && 
               details !== 'The transaction was reverted by the contract'
      }
      return e.parsed.type !== 'revert'
    })
    
    // If we have both generic and specific errors, prefer specific ones
    if (genericReverts.length > 0 && specificErrors.length > 0) {
      return specificErrors.map(e => e.original)
    }
    
    // Otherwise return all errors
    return errors
  }, [errors])

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Summary header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayersIcon className="h-5 w-5" />
            Call Trace Hierarchy
            {isSuccess ? (
              <CheckCircleIcon className="h-5 w-5 text-green-500" />
            ) : (
              <XCircleIcon className="h-5 w-5 text-red-500" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <TrendingUpIcon className="h-4 w-4 text-blue-500" />
              <div>
                <div className="font-medium">{totalCalls}</div>
                <div className="text-muted-foreground">Total Calls</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <LayersIcon className="h-4 w-4 text-purple-500" />
              <div>
                <div className="font-medium">{maxDepth}</div>
                <div className="text-muted-foreground">Max Depth</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <FuelIcon className="h-4 w-4 text-orange-500" />
              <div>
                <div className="font-medium">
                  {totalGasUsed.toLocaleString()}
                </div>
                <div className="text-muted-foreground">Total Gas</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-green-500" />
              <div>
                <div className="font-medium">
                  {isSuccess ? 'Success' : 'Failed'}
                  {processedErrors.length > 0 && (
                    <Badge variant="destructive" className="ml-2 text-xs">
                      {processedErrors.length} error{processedErrors.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <div className="text-muted-foreground">Execution Status</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Call tree visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Call Stack</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mobile: Horizontal scrolling */}
          <div className="block sm:hidden">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              <CallFrameNode
                frame={rootCall}
                depth={0}
                index={0}
                isRoot={true}
                isHorizontal={true}
              />
            </div>
          </div>

          {/* Desktop: Vertical layout */}
          <div className="hidden sm:block space-y-2">
            <CallFrameNode frame={rootCall} depth={0} index={0} isRoot={true} />
          </div>
        </CardContent>
      </Card>

      {/* Error summary (if any) */}
      {processedErrors.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-red-100 dark:bg-red-900/20">
                <AlertTriangleIcon className="h-4 w-4 text-red-600 dark:text-red-500" />
              </div>
              {processedErrors.length === 1 ? 'Execution Error' : `Execution Errors (${processedErrors.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {processedErrors.map((error, index: number) => {
                const parsedError = parseBlockchainError(error)
                // For short error codes or specific contract errors, show them prominently
                const isContractError = parsedError.type === 'revert' && parsedError.details && 
                  parsedError.details !== 'The transaction was reverted by the contract'
                
                return (
                  <div
                    key={`error-${index}`}
                    className="flex gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div className="mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="font-medium">
                        {isContractError ? 'Contract Error' : parsedError.title}
                      </div>
                      {parsedError.details && (
                        <div className={`text-sm ${isContractError ? 'font-mono text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                          {parsedError.details}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/**
 * Fallback component for when trace data is not available
 */
export function CallTraceTreeFallback({ message }: { message?: string }) {
  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardContent className="p-6 text-center">
        <LayersIcon className="h-12 w-12 text-yellow-600 mx-auto mb-3" />
        <h3 className="font-medium text-yellow-800 mb-2">
          Call Trace Unavailable
        </h3>
        <p className="text-sm text-yellow-700">
          {message ||
            'Trace data could not be loaded. Displaying basic simulation results instead.'}
        </p>
      </CardContent>
    </Card>
  )
}
