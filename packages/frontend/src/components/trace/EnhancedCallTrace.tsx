'use client'

import type { CallFrame, ExtendedTracerResponse } from '@altitrace/sdk/types'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  ExternalLinkIcon,
  EyeIcon,
  FuelIcon,
  SettingsIcon,
} from 'lucide-react'
import { useState } from 'react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import { parseBlockchainError } from '@/utils/error-parser'
import { useMultipleCopyToClipboard } from '@/hooks/useCopyToClipboard'

interface EnhancedCallTraceProps {
  traceData: ExtendedTracerResponse
  className?: string
}

type TraceMode = 'gas' | 'full'

/**
 * Enhanced call trace component inspired by Tenderly's interface
 * Features gas mode and full trace mode with improved UI/UX
 */
export function EnhancedCallTrace({
  traceData,
  className = '',
}: EnhancedCallTraceProps) {
  const [showGas, setShowGas] = useState(true)
  const [showFullTrace, setShowFullTrace] = useState(false)
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

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Call Trace
          </CardTitle>
          
          <div className="flex gap-2">
            <Button
              variant={showGas ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setShowGas(!showGas)}
              className="h-8"
            >
              <FuelIcon className="h-4 w-4 mr-1" />
              Gas
            </Button>
            <Button
              variant={showFullTrace ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setShowFullTrace(!showFullTrace)}
              className="h-8"
            >
              <EyeIcon className="h-4 w-4 mr-1" />
              Full Trace
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="border-t font-mono text-sm">
          <TenderlyCallNode
            frame={rootCall}
            depth={0}
            index={0}
            isRoot={true}
            showGas={showGas}
            showFullTrace={showFullTrace}
          />
        </div>
      </CardContent>
    </Card>
  )
}

interface TenderlyCallNodeProps {
  frame: CallFrame
  depth: number
  index: number
  isRoot?: boolean
  showGas: boolean
  showFullTrace: boolean
}

function TenderlyCallNode({
  frame,
  depth,
  index,
  isRoot = false,
  showGas,
  showFullTrace,
}: TenderlyCallNodeProps) {
  const { getCopyState, copyToClipboard } = useMultipleCopyToClipboard()
  const [isExpanded, setIsExpanded] = useState(depth < 3) // Auto-expand first 3 levels
  
  const hasSubcalls = frame.calls && frame.calls.length > 0
  const gasUsed = Number.parseInt(frame.gasUsed, 16)
  const isSuccess = !frame.reverted
  
  // Calculate indentation
  const indentLevel = depth * 16 // 16px per level
  
  // Format addresses - short format for display
  const formatAddress = (address: string) => {
    if (!address) return 'N/A'
    return `${address.slice(0, 8)}...${address.slice(-6)}`
  }
  
  // Get function selector and format it
  const getFunctionSelector = () => {
    if (!frame.input || frame.input === '0x' || frame.input.length < 10) {
      return null
    }
    return frame.input.slice(0, 10)
  }
  
  const functionSelector = getFunctionSelector()
  
  // Get call type color similar to Tenderly
  const getCallTypeColor = (callType: string, success: boolean) => {
    if (!success) return 'bg-red-500/10 text-red-700 dark:text-red-400'
    
    const colors = {
      CALL: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
      DELEGATECALL: 'bg-purple-500/10 text-purple-700 dark:text-purple-400', 
      STATICCALL: 'bg-green-500/10 text-green-700 dark:text-green-400',
      CREATE: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
      CREATE2: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
      CALLCODE: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
    }
    return colors[callType as keyof typeof colors] || 'bg-gray-500/10 text-gray-700 dark:text-gray-400'
  }
  

  return (
    <div>
      {/* Main call row */}
      <div 
        className={`
          group flex items-center py-1.5 px-3 hover:bg-muted/30 transition-colors
          ${!isSuccess ? 'bg-red-50/50 dark:bg-red-950/10' : ''}
        `}
        style={{ paddingLeft: `${12 + indentLevel}px` }}
      >
        {/* Fixed-width call type column (like Tenderly) */}
        <div className="w-24 flex-shrink-0">
          <Badge 
            className={`text-xs font-mono px-1 py-0.5 w-full justify-center ${getCallTypeColor(frame.callType, isSuccess)}`}
            variant="outline"
          >
            {frame.callType}
          </Badge>
        </div>
        
        {/* Fixed-width gas cost column (if enabled) */}
        {showGas && (
          <div className="w-20 flex-shrink-0 text-right pr-2">
            <span className="text-muted-foreground text-xs font-mono">
              {gasUsed.toLocaleString()}
            </span>
          </div>
        )}
        
        {/* Expand/collapse button (positioned after gas) */}
        <div className="w-4 flex justify-center mr-2 flex-shrink-0">
          {hasSubcalls ? (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-0.5 rounded hover:bg-muted transition-colors"
            >
              {isExpanded ? (
                <ChevronDownIcon className="h-3 w-3" />
              ) : (
                <ChevronRightIcon className="h-3 w-3" />
              )}
            </button>
          ) : (
            <div className="w-3" />
          )}
        </div>
        
        {/* Call information */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* From address */}
          <span className="text-muted-foreground text-sm">
            {formatAddress(frame.from)}
          </span>
          
          {/* Arrow */}
          <span className="text-muted-foreground">→</span>
          
          {/* To address or CREATE */}
          {frame.to ? (
            <span className="text-muted-foreground text-sm">
              {formatAddress(frame.to)}
            </span>
          ) : (
            <span className="text-orange-600 dark:text-orange-400 font-medium text-sm">
              CREATE
            </span>
          )}
          
          {/* Function selector */}
          {frame.to && functionSelector && (
            <>
              <span className="text-muted-foreground">.</span>
              <span className="text-blue-600 dark:text-blue-400 font-medium text-sm">
                {functionSelector}
              </span>
            </>
          )}
          
          {/* Data (if full trace mode and has input beyond selector) */}
          {showFullTrace && frame.input && frame.input.length > 10 && (
            <span className="text-xs text-muted-foreground ml-1">
              ({(() => {
                const inputData = frame.input.slice(10)
                return inputData.length > 20 ? `${inputData.slice(0, 20)}...` : inputData
              })()})
            </span>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100">
          {/* Copy from address */}
          <button
            onClick={() => copyToClipboard(`from-${depth}-${index}`, frame.from)}
            className="p-1 hover:bg-muted rounded transition-colors"
            title="Copy from address"
          >
            <CopyIcon className="h-3 w-3 text-muted-foreground" />
          </button>
          
          {/* Copy to address */}
          {frame.to && (
            <button
              onClick={() => copyToClipboard(`to-${depth}-${index}`, frame.to!)}
              className="p-1 hover:bg-muted rounded transition-colors"
              title="Copy to address"
            >
              <CopyIcon className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
          
          {/* External link */}
          <a
            href={`https://hyperevmscan.io/address/${frame.to || frame.from}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 hover:bg-muted rounded transition-colors"
            title="Open in explorer"
          >
            <ExternalLinkIcon className="h-3 w-3 text-muted-foreground" />
          </a>
        </div>
      </div>
      
      {/* Full trace mode additional details */}
      {showFullTrace && (frame.value !== '0x0' || (frame.output && frame.output !== '0x') || (!isSuccess && frame.error)) && (
        <div 
          className="bg-muted/10 border-l-2 border-muted/50 text-xs"
          style={{ 
            paddingLeft: `${12 + indentLevel + 96 + (showGas ? 80 : 0) + 16 + 8}px` // Align with call details (w-24=96px, w-20=80px)
          }}
        >
          <div className="py-1 px-3 space-y-1">
            {/* Value transfer */}
            {frame.value && frame.value !== '0x0' && (
              <div className="text-muted-foreground">
                <span className="font-medium">Value:</span>{' '}
                <span className="font-mono">{BigInt(frame.value).toLocaleString()} wei</span>
              </div>
            )}
            
            {/* Output data */}
            {frame.output && frame.output !== '0x' && (
              <div className="text-muted-foreground">
                <span className="font-medium">Output:</span>{' '}
                <span className="font-mono break-all">
                  {frame.output.length > 40 ? `${frame.output.slice(0, 40)}...` : frame.output}
                </span>
              </div>
            )}
            
            {/* Error information */}
            {!isSuccess && frame.error && (
              <div className="text-red-600 dark:text-red-400">
                <span className="font-medium">Error:</span>{' '}
                {(() => {
                  const parsedError = parseBlockchainError(frame.error)
                  return parsedError.details || parsedError.title || frame.error
                })()}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Render subcalls */}
      {hasSubcalls && isExpanded && frame.calls && (
        <>
          {frame.calls.map((subcall, subIndex) => (
            <TenderlyCallNode
              key={`${depth}-${subIndex}`}
              frame={subcall}
              depth={depth + 1}
              index={subIndex}
              showGas={showGas}
              showFullTrace={showFullTrace}
            />
          ))}
        </>
      )}
    </div>
  )
}