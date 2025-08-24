'use client'

import type { CallFrame, ExtendedTracerResponse } from '@altitrace/sdk/types'
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  ExternalLinkIcon,
  EyeIcon,
  FuelIcon,
  SettingsIcon,
  XCircleIcon,
} from 'lucide-react'
import { useState } from 'react'
import {
  CallTypeIcon,
  CallTypeIconOnly,
} from '@/components/shared/CallTypeIcon'
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
  const [traceMode, setTraceMode] = useState<TraceMode>('gas')
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
          
          <div className="flex border rounded-lg p-1 gap-1">
            <Button
              variant={traceMode === 'gas' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setTraceMode('gas')}
              className="h-8"
            >
              <FuelIcon className="h-4 w-4 mr-1" />
              Gas
            </Button>
            <Button
              variant={traceMode === 'full' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setTraceMode('full')}
              className="h-8"
            >
              <EyeIcon className="h-4 w-4 mr-1" />
              Full Trace
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="border-t">
          <EnhancedCallNode
            frame={rootCall}
            depth={0}
            index={0}
            isRoot={true}
            mode={traceMode}
          />
        </div>
      </CardContent>
    </Card>
  )
}

interface EnhancedCallNodeProps {
  frame: CallFrame
  depth: number
  index: number
  isRoot?: boolean
  mode: TraceMode
}

function EnhancedCallNode({
  frame,
  depth,
  index,
  isRoot = false,
  mode,
}: EnhancedCallNodeProps) {
  const { getCopyState, copyToClipboard } = useMultipleCopyToClipboard()
  const [isExpanded, setIsExpanded] = useState(depth < 2) // Auto-expand first 2 levels
  
  const hasSubcalls = frame.calls && frame.calls.length > 0
  const gasUsed = Number.parseInt(frame.gasUsed, 16)
  const gasProvided = Number.parseInt(frame.gas, 16)
  const isSuccess = !frame.reverted
  
  // Calculate indentation
  const indentLevel = depth * 24 // 24px per level
  
  // Format addresses
  const formatAddress = (address: string, short = true) => {
    if (!address) return 'N/A'
    return short ? `${address.slice(0, 6)}...${address.slice(-4)}` : address
  }
  
  // Get function selector
  const getFunctionSelector = () => {
    if (!frame.input || frame.input === '0x' || frame.input.length < 10) {
      return null
    }
    return frame.input.slice(0, 10)
  }
  
  const functionSelector = getFunctionSelector()
  
  // Determine call type color
  const getCallTypeColor = (callType: string) => {
    const colors = {
      CALL: 'text-blue-600',
      DELEGATECALL: 'text-purple-600', 
      STATICCALL: 'text-green-600',
      CREATE: 'text-orange-600',
      CREATE2: 'text-orange-600',
      CALLCODE: 'text-gray-600',
    }
    return colors[callType as keyof typeof colors] || 'text-gray-600'
  }

  return (
    <div>
      {/* Main call row */}
      <div 
        className={`
          flex items-center py-2 px-4 hover:bg-muted/50 transition-colors border-b border-border/50
          ${!isSuccess ? 'bg-red-50 dark:bg-red-950/20' : ''}
        `}
        style={{ paddingLeft: `${16 + indentLevel}px` }}
      >
        {/* Expand/collapse button */}
        <div className="w-6 flex justify-center">
          {hasSubcalls ? (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded hover:bg-muted transition-colors"
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
        
        {/* Call type icon and method */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <CallTypeIconOnly callType={frame.callType} size="sm" />
          
          <Badge 
            variant="outline" 
            className={`text-xs font-medium ${getCallTypeColor(frame.callType)}`}
          >
            {frame.callType}
          </Badge>
          
          {/* Function selector or method name */}
          {functionSelector && (
            <Badge variant="secondary" className="text-xs font-mono">
              {functionSelector}
            </Badge>
          )}
        </div>
        
        {/* Address information */}
        <div className="flex items-center gap-2 text-sm min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">from</span>
            <button
              onClick={() => copyToClipboard(`from-${depth}-${index}`, frame.from)}
              className="font-mono text-xs bg-muted hover:bg-muted/80 px-2 py-1 rounded transition-colors"
              title={frame.from}
            >
              {formatAddress(frame.from)}
            </button>
            <a
              href={`https://hyperevmscan.io/address/${frame.from}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <ExternalLinkIcon className="h-3 w-3 text-muted-foreground" />
            </a>
          </div>
          
          <span className="text-muted-foreground">→</span>
          
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">to</span>
            {frame.to ? (
              <>
                <button
                  onClick={() => frame.to && copyToClipboard(`to-${depth}-${index}`, frame.to)}
                  className="font-mono text-xs bg-muted hover:bg-muted/80 px-2 py-1 rounded transition-colors"
                  title={frame.to}
                >
                  {formatAddress(frame.to)}
                </button>
                <a
                  href={`https://hyperevmscan.io/address/${frame.to}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 hover:bg-muted rounded transition-colors"
                >
                  <ExternalLinkIcon className="h-3 w-3 text-muted-foreground" />
                </a>
              </>
            ) : (
              <Badge variant="outline" className="text-xs">
                CREATE
              </Badge>
            )}
          </div>
        </div>
        
        {/* Gas information */}
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1">
            <FuelIcon className="h-3 w-3 text-orange-500" />
            <span className="font-mono text-xs">
              {gasUsed.toLocaleString()}
            </span>
          </div>
          
          {mode === 'full' && (
            <div className="text-xs text-muted-foreground">
              / {gasProvided.toLocaleString()}
            </div>
          )}
        </div>
        
        {/* Status indicator */}
        <div className="w-6 flex justify-center">
          {isSuccess ? (
            <CheckCircleIcon className="h-4 w-4 text-green-500" />
          ) : (
            <XCircleIcon className="h-4 w-4 text-red-500" />
          )}
        </div>
      </div>
      
      {/* Full trace mode additional details */}
      {mode === 'full' && (
        <div 
          className="bg-muted/20 border-b border-border/50"
          style={{ paddingLeft: `${40 + indentLevel}px` }}
        >
          <div className="py-2 px-4 space-y-2">
            {/* Value transfer */}
            {frame.value && frame.value !== '0x0' && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Value:</span>{' '}
                <span className="font-mono">{BigInt(frame.value).toLocaleString()} wei</span>
              </div>
            )}
            
            {/* Gas details */}
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Gas:</span>{' '}
              <span className="font-mono">
                Used: {gasUsed.toLocaleString()}, 
                Remaining: {(gasProvided - gasUsed).toLocaleString()}
              </span>
            </div>
            
            {/* Input/Output data */}
            {frame.input && frame.input !== '0x' && (
              <div className="text-xs">
                <span className="font-medium text-muted-foreground">Input:</span>
                <div className="mt-1 bg-background border rounded p-2 font-mono text-xs break-all">
                  {frame.input}
                </div>
              </div>
            )}
            
            {frame.output && frame.output !== '0x' && (
              <div className="text-xs">
                <span className="font-medium text-muted-foreground">Output:</span>
                <div className="mt-1 bg-background border rounded p-2 font-mono text-xs break-all">
                  {frame.output}
                </div>
              </div>
            )}
            
            {/* Error information */}
            {!isSuccess && frame.error && (
              <div className="flex gap-2 p-2 rounded bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                <AlertTriangleIcon className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <div className="font-medium text-sm text-red-800 dark:text-red-200">
                    {(() => {
                      const parsedError = parseBlockchainError(frame.error)
                      const isContractError = parsedError.type === 'revert' && 
                        parsedError.details && 
                        parsedError.details !== 'The transaction was reverted by the contract'
                      return isContractError ? 'Contract Error' : parsedError.title
                    })()}
                  </div>
                  {(() => {
                    const parsedError = parseBlockchainError(frame.error)
                    const isContractError = parsedError.type === 'revert' && 
                      parsedError.details && 
                      parsedError.details !== 'The transaction was reverted by the contract'
                    return parsedError.details ? (
                      <div className={`text-xs ${isContractError ? 'font-mono text-red-700 dark:text-red-300' : 'text-muted-foreground'}`}>
                        {parsedError.details}
                      </div>
                    ) : null
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Render subcalls */}
      {hasSubcalls && isExpanded && frame.calls && (
        <>
          {frame.calls.map((subcall, subIndex) => (
            <EnhancedCallNode
              key={`${depth}-${subIndex}`}
              frame={subcall}
              depth={depth + 1}
              index={subIndex}
              mode={mode}
            />
          ))}
        </>
      )}
    </div>
  )
}