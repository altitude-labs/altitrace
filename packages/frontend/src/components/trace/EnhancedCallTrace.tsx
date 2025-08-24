'use client'

import type { CallFrame, ExtendedTracerResponse } from '@altitrace/sdk/types'
import {
  ChevronDownIcon,
  ChevronRightIcon,
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
import { parseBlockchainError, parseBlockchainErrorWithOutput } from '@/utils/error-parser'

interface EnhancedCallTraceProps {
  traceData: ExtendedTracerResponse
  className?: string
}

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
    <>
      <style jsx>{`
        .call-trace-container {
          /* Custom scrollbar styles for the global container */
          scrollbar-width: thin;
          scrollbar-color: #74A8FB transparent;
        }
        
        .call-trace-container::-webkit-scrollbar {
          height: 8px;
        }
        
        .call-trace-container::-webkit-scrollbar-track {
          background: hsl(var(--muted) / 0.1);
          border-radius: 4px;
          margin: 0 12px;
        }
        
        .call-trace-container::-webkit-scrollbar-thumb {
          background: linear-gradient(90deg, #3b82f6, #1d4ed8);
          border-radius: 4px;
          border: 1px solid #1e40af;
          transition: all 0.3s ease;
          box-shadow: 0 1px 3px rgba(59, 130, 246, 0.2);
        }
        
        .call-trace-container::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(90deg, #2563eb, #1e40af);
          border-color: #1e3a8a;
          box-shadow: 0 2px 6px rgba(59, 130, 246, 0.4);
          transform: scaleY(1.1);
        }
        
        .call-trace-container::-webkit-scrollbar-thumb:active {
          background: linear-gradient(90deg, #1d4ed8, #1e3a8a);
          border-color: #172554;
          box-shadow: 0 1px 2px rgba(59, 130, 246, 0.6);
        }
        
        /* Firefox custom scrollbar */
        @supports (scrollbar-color: auto) {
          .call-trace-container {
            scrollbar-color: #74A8FB hsl(var(--muted) / 0.1);
            scrollbar-width: thin;
          }
        }
        
        /* Ensure content width is at least the sum of all fixed columns */
        .call-trace-container .call-node-content {
          min-width: max-content; /* Allow content to expand to fit all data */
        }
        
        /* Sticky header behavior while maintaining scroll sync */
        .call-trace-container {
          position: relative;
        }
      `}</style>
      
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
          {/* Scrollable container for header and all call nodes */}
          <div 
            className="call-trace-container overflow-x-auto"
            onWheel={(e) => {
              // Allow horizontal scrolling with mouse wheel on the entire trace
              if (e.deltaY !== 0) {
                e.currentTarget.scrollLeft += e.deltaY;
                e.preventDefault();
              }
            }}
            style={{ scrollBehavior: 'smooth' }}
          >
            {/* Header row for column alignment - now inside scrollable container */}
            <div 
              className={`
                grid items-center py-2 px-3 border-b bg-muted/20 text-xs font-medium text-muted-foreground call-node-content
                ${showGas ? 'grid-cols-[96px_80px_16px_1fr]' : 'grid-cols-[96px_16px_1fr]'}
              `}
              style={{ paddingLeft: '12px' }}
            >
              <div className="text-left text-center">Type</div>
              {showGas && <div className="text-right text-center">Gas</div>}
              <div />
              <div className="text-left">Call Details</div>
            </div>
            <CallNode
              frame={rootCall}
              depth={0}
              index={0}
              isRoot={true}
              showGas={showGas}
              showFullTrace={showFullTrace}
            />
          </div>
        </div>
      </CardContent>
    </Card>
    </>
  )
}

interface CallNodeProps {
  frame: CallFrame
  depth: number
  index: number
  isRoot?: boolean
  showGas: boolean
  showFullTrace: boolean
}

function CallNode({
  frame,
  depth,
  index,
  isRoot = false,
  showGas,
  showFullTrace,
}: CallNodeProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 3) // Auto-expand first 3 levels
  
  const hasSubcalls = frame.calls && frame.calls.length > 0
  const gasUsed = Number.parseInt(frame.gasUsed, 16)
  const isSuccess = !frame.reverted
  
  // Format addresses - short format for display
  const formatAddress = (address: string) => {
    if (!address) return 'N/A'
    return `${address}`
  }
  
  // Get function selector and format it
  const getFunctionSelector = () => {
    if (!frame.input || frame.input === '0x' || frame.input.length < 10) {
      return null
    }
    return frame.input.slice(0, 10)
  }
  
  const functionSelector = getFunctionSelector()
  
  // Get call type color similar
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
  
  // Calculate indentation for subcalls
  const indentLevel = depth * 16 // 16px per level

  return (
    <div>
            {/* Main call row using CSS Grid for perfect alignment */}
      <div 
        className={`
          group grid items-center py-1.5 hover:bg-muted/30 transition-colors
          ${!isSuccess ? 'bg-red-50/50 dark:bg-red-950/10' : ''}
          ${showGas ? 'grid-cols-[12px_96px_80px_16px_1fr]' : 'grid-cols-[12px_96px_16px_1fr]'}
        `}
      >
        {/* Left padding that grows with indentation */}
        <div style={{ width: `${indentLevel}px` }} />
        
        {/* Call type column - always aligned */}
        <div className="flex justify-center px-1">
          <Badge 
            className={`text-xs font-mono px-2 py-0.5 w-full max-w-[96px] justify-center ${getCallTypeColor(frame.callType, isSuccess)}`}
            variant="outline"
          >
            {frame.callType}
          </Badge>
        </div>
        
        {/* Gas column (if enabled) - always aligned */}
        {showGas && (
          <div className="text-right px-1">
            <span className="text-muted-foreground text-xs font-mono">
              {gasUsed.toLocaleString()}
            </span>
          </div>
        )}
        
        {/* Expand/collapse button - indented based on depth */}
        <div className="flex justify-start relative z-10" style={{ paddingLeft: `${indentLevel}px` }}>
          {hasSubcalls ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-0.5 rounded hover:bg-muted transition-colors relative z-10 cursor-pointer"
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
        
        {/* Call information - indented based on depth */}
        <div 
          className="flex items-center gap-1 min-w-0 px-3 whitespace-nowrap call-node-content" 
          style={{ 
            paddingLeft: `${indentLevel + 12}px`,
          }}
        >
          {/* From address */}
          <span className="text-slate-500 dark:text-slate-400 text-xs font-medium flex-shrink-0">
            CALLER
          </span>
          <a
            href={`https://hyperevmscan.io/address/${frame.from}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-800 dark:text-cyan-600 hover:text-cyan-600 dark:hover:text-cyan-500 text-sm font-mono flex-shrink-0 underline decoration-dotted underline-offset-2 transition-colors"
          >
            {formatAddress(frame.from)}
          </a>
          
          {/* Arrow */}
          <span className="text-slate-400 dark:text-slate-500 flex-shrink-0">→</span>
          
          {/* To address or CREATE */}
          {frame.to ? (
            <>
              <span className="text-slate-500 dark:text-slate-400 text-xs font-medium flex-shrink-0">
                RECEIVER
              </span>
              <a
                href={`https://hyperevmscan.io/address/${frame.to}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 text-sm font-mono flex-shrink-0 underline decoration-dotted underline-offset-2 transition-colors"
              >
                {formatAddress(frame.to)}
              </a>
            </>
          ) : (
            <span className="text-orange-600 dark:text-orange-400 font-semibold text-sm flex-shrink-0">
              CREATE
            </span>
          )}
          
          {/* Function selector */}
          {frame.to && functionSelector && (
            <>
              <span className="text-slate-400 dark:text-slate-500 flex-shrink-0">.</span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm flex-shrink-0">
                {functionSelector}
              </span>
            </>
          )}
          
          {/* Data (if full trace mode and has input beyond selector) */}
          {showFullTrace && frame.input && frame.input.length > 10 && (
            <span className="text-violet-600 dark:text-violet-400 text-xs font-mono ml-2 flex-shrink-0">
              ({frame.input})
            </span>
          )}
        </div>
      </div>
      
      {/* Full trace mode additional details */}
      {showFullTrace && (frame.value !== '0x0' || (frame.output && frame.output !== '0x') || (!isSuccess && frame.error)) && (
        <div 
          className="bg-muted/10 border-l-2 border-muted/50 text-xs"
          style={{ 
            marginLeft: `${12 + 96 + (showGas ? 80 : 0) + 16 + indentLevel + 12}px`
          }}
        >
          <div className="py-1 px-3 space-y-1">
            {/* Value transfer */}
            {frame.value && frame.value !== '0x0' && (
              <div className="flex items-center gap-2">
                <span className="text-amber-600 dark:text-amber-400 font-semibold text-xs">VALUE:</span>
                <span className="text-amber-700 dark:text-amber-300 font-mono text-sm">{BigInt(frame.value).toLocaleString()} wei</span>
              </div>
            )}
            
            {/* Error information with decoded output */}
            {!isSuccess && (frame.error || frame.output) && (
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span className="text-red-600 dark:text-red-400 font-semibold text-xs flex-shrink-0">ERROR:</span>
                <span className="text-red-700 dark:text-red-300 font-medium text-sm flex-shrink-0">
                  {(() => {
                    const parsedError = parseBlockchainErrorWithOutput(frame.error || '', frame.output || '')
                    return parsedError.details || parsedError.title || 'execution reverted'
                  })()}
                </span>
              </div>
            )}
            
            {/* Output data (only show for successful calls or when no decoded error) */}
            {frame.output && frame.output !== '0x' && (isSuccess || !frame.error) && (
              <div className="flex items-start gap-2">
                <span className={`${!isSuccess ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'} font-semibold text-xs flex-shrink-0`}>OUTPUT:</span>
                <span className={`${!isSuccess ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'} font-mono text-xs break-all`}>
                  {frame.output}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Render subcalls */}
      {hasSubcalls && isExpanded && frame.calls && (
        <>
          {frame.calls.map((subcall, subIndex) => (
            <CallNode
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