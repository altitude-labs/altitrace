'use client'

import type { CallFrame } from '@altitrace/sdk/types'
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  ExternalLinkIcon,
  EyeIcon,
  FuelIcon,
  XCircleIcon,
} from 'lucide-react'
import { useState } from 'react'
import {
  CallTypeIcon,
  CallTypeIconOnly,
} from '@/components/shared/CallTypeIcon'
import { Badge, Card, CardContent } from '@/components/ui'
import { parseBlockchainError } from '@/utils/error-parser'
import { useMultipleCopyToClipboard } from '@/hooks/useCopyToClipboard'

interface CallFrameNodeProps {
  frame: CallFrame
  depth?: number
  index?: number
  isRoot?: boolean
  isHorizontal?: boolean
}

/**
 * Individual call frame node with hierarchical display
 */
export function CallFrameNode({
  frame,
  depth = 0,
  index = 0,
  isRoot = false,
  isHorizontal = false,
}: CallFrameNodeProps) {
  const { getCopyState, copyToClipboard } = useMultipleCopyToClipboard()
  const [isExpanded, setIsExpanded] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const hasSubcalls = frame.calls && frame.calls.length > 0
  const gasUsedNumber = Number.parseInt(frame.gasUsed, 16)
  const gasProvidedNumber = Number.parseInt(frame.gas, 16)
  const isSuccess = !frame.reverted

  // Calculate depth-based styling
  const depthColors = [
    'border-l-blue-500', // Depth 0
    'border-l-green-500', // Depth 1
    'border-l-orange-500', // Depth 2
    'border-l-purple-500', // Depth 3
    'border-l-pink-500', // Depth 4
  ]
  const borderColor =
    depthColors[depth % depthColors.length] || 'border-l-gray-500'

  // Format address for display
  const formatAddress = (address: string) => {
    if (!address) return 'N/A'
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  // Decode function signature from input data
  const getFunctionSignature = () => {
    if (!frame.input || frame.input === '0x' || frame.input.length < 10) {
      return null
    }
    return frame.input.slice(0, 10) // First 4 bytes (8 hex chars + 0x)
  }

  const functionSig = getFunctionSignature()

  // Horizontal layout for mobile - flatten the tree into a horizontal scrollable list
  if (isHorizontal) {
    // Collect all calls in a flat array to display horizontally
    const collectAllCalls = (
      call: CallFrame,
      currentDepth = 0,
      callIndex = 0,
    ) => {
      const result = [{ call, depth: currentDepth, index: callIndex }]
      if (call.calls) {
        call.calls.forEach((subcall, subIndex) => {
          result.push(...collectAllCalls(subcall, currentDepth + 1, subIndex))
        })
      }
      return result
    }

    const allCalls = collectAllCalls(frame, depth, index)

    return (
      <div className="flex gap-3 min-w-max">
        {allCalls.map((callItem, idx) => {
          const { call, depth: callDepth, index: callIndex } = callItem
          const callGasUsed = Number.parseInt(call.gasUsed, 16)
          const callIsSuccess = !call.reverted
          const callBorderColor =
            depthColors[callDepth % depthColors.length] || 'border-l-gray-500'
          const callFunctionSig =
            call.input && call.input !== '0x' && call.input.length >= 10
              ? call.input.slice(0, 10)
              : null

          return (
            <div
              key={`h-${callDepth}-${callIndex}-${idx}`}
              className="flex-shrink-0 w-64"
            >
              <Card
                className={`border-l-4 ${callBorderColor} ${!callIsSuccess ? 'bg-red-100 border-red-300' : ''} h-full`}
              >
                <CardContent className="p-3 flex flex-col justify-center">
                  <div className="space-y-2">
                    {/* Call type and status */}
                    <div className="flex items-center gap-2">
                      <CallTypeIconOnly callType={call.callType} size="sm" />
                      <Badge variant="outline" className="text-xs">
                        {call.callType}
                      </Badge>
                      {callIsSuccess ? (
                        <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircleIcon className="h-4 w-4 text-red-500" />
                      )}
                    </div>

                    {/* Depth indicator */}
                    <div className="text-xs text-muted-foreground">
                      Depth: {callDepth}{' '}
                      {callDepth > 0 && `| Call #${callIndex + 1}`}
                    </div>

                    {/* Addresses */}
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">From:</div>
                      <div className="flex items-center gap-1">
                        <a
                          href={`https://hyperevmscan.io/address/${call.from}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-muted px-2 py-1 rounded font-mono text-xs truncate hover:bg-muted/80 transition-colors flex-1"
                        >
                          {call.from}
                        </a>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              `from-${callDepth}-${callIndex}`,
                              call.from,
                            )
                          }
                          className="p-1 hover:bg-muted rounded transition-colors"
                          title="Copy address"
                        >
                          {getCopyState(`from-${callDepth}-${callIndex}`) ? (
                            <CheckIcon className="h-3 w-3 text-green-500" />
                          ) : (
                            <CopyIcon className="h-3 w-3 text-muted-foreground" />
                          )}
                        </button>
                        <a
                          href={`https://hyperevmscan.io/address/${call.from}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-muted rounded transition-colors"
                          title="Open in explorer"
                        >
                          <ExternalLinkIcon className="h-3 w-3 text-muted-foreground" />
                        </a>
                      </div>
                      <div className="text-xs text-muted-foreground">To:</div>
                      <div className="flex items-center gap-1">
                        {call.to ? (
                          <>
                            <a
                              href={`https://hyperevmscan.io/address/${call.to}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-muted px-2 py-1 rounded font-mono text-xs truncate hover:bg-muted/80 transition-colors flex-1"
                            >
                              {call.to}
                            </a>
                            <button
                              onClick={() =>
                                call.to &&
                                copyToClipboard(
                                  `to-${callDepth}-${callIndex}`,
                                  call.to,
                                )
                              }
                              className="p-1 hover:bg-muted rounded transition-colors"
                              title="Copy address"
                            >
                              {getCopyState(`to-${callDepth}-${callIndex}`) ? (
                                <CheckIcon className="h-3 w-3 text-green-500" />
                              ) : (
                                <CopyIcon className="h-3 w-3 text-muted-foreground" />
                              )}
                            </button>
                            <a
                              href={`https://hyperevmscan.io/address/${call.to}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 hover:bg-muted rounded transition-colors"
                              title="Open in explorer"
                            >
                              <ExternalLinkIcon className="h-3 w-3 text-muted-foreground" />
                            </a>
                          </>
                        ) : (
                          <code className="bg-muted px-2 py-1 rounded font-mono text-xs block">
                            CREATE
                          </code>
                        )}
                      </div>
                    </div>

                    {/* Function signature */}
                    {callFunctionSig && (
                      <Badge variant="outline" className="text-xs">
                        {callFunctionSig}
                      </Badge>
                    )}

                    {/* Gas usage */}
                    <div className="flex items-center gap-1 text-sm">
                      <FuelIcon className="h-3 w-3 text-orange-500" />
                      <span className="font-mono text-xs">
                        {callGasUsed.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground">gas</span>
                    </div>

                    {/* Subcall count for current call */}
                    {call.calls && call.calls.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        📁 {call.calls.length} subcall
                        {call.calls.length !== 1 ? 's' : ''}
                      </div>
                    )}

                    {/* Value transfer (if any) */}
                    {call.value && call.value !== '0x0' && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Value:</span>
                        <span className="font-mono ml-1">
                          {BigInt(call.value).toLocaleString()} wei
                        </span>
                      </div>
                    )}

                    {/* Error information */}
                    {!callIsSuccess && call.error && (
                      <div className="flex gap-2 p-2 rounded-lg bg-muted/50">
                        <div className="mt-0.5">
                          <div className="h-2 w-2 rounded-full bg-red-500" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="font-medium text-xs">
                            {(() => {
                              const parsedError = parseBlockchainError(
                                call.error,
                              )
                              const isContractError =
                                parsedError.type === 'revert' &&
                                parsedError.details &&
                                parsedError.details !==
                                  'The transaction was reverted by the contract'
                              return isContractError
                                ? 'Contract Error'
                                : parsedError.title
                            })()}
                          </div>
                          {(() => {
                            const parsedError = parseBlockchainError(call.error)
                            const isContractError =
                              parsedError.type === 'revert' &&
                              parsedError.details &&
                              parsedError.details !==
                                'The transaction was reverted by the contract'
                            return parsedError.details ? (
                              <div
                                className={`text-xs ${isContractError ? 'font-mono text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}
                              >
                                {parsedError.details}
                              </div>
                            ) : null
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        })}
      </div>
    )
  }

  // Default vertical layout for desktop
  return (
    <div className={`${depth > 0 ? 'ml-4' : ''}`}>
      <Card
        className={`mb-1 border-l-4 ${borderColor} ${!isSuccess ? 'bg-red-100 border-red-300' : ''}`}
      >
        <CardContent className="p-3">
          {/* Main call header */}
          <div className="flex items-center justify-between mb-2 min-w-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Expand/collapse button */}
              {hasSubcalls && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1 hover:bg-gray-100 rounded flex-shrink-0"
                  title={isExpanded ? 'Collapse subcalls' : 'Expand subcalls'}
                >
                  {isExpanded ? (
                    <ChevronDownIcon className="h-4 w-4" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4" />
                  )}
                </button>
              )}

              {/* Call type icon */}
              <div className="flex-shrink-0">
                <CallTypeIcon callType={frame.callType} size="sm" />
              </div>

              {/* Call number and success status */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {!isRoot && (
                  <span className="text-sm text-muted-foreground">
                    #{index + 1}
                  </span>
                )}
                {isSuccess ? (
                  <CheckCircleIcon className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircleIcon className="h-4 w-4 text-red-500" />
                )}
              </div>

              {/* From → To addresses */}
              <div className="flex items-center gap-2 text-sm min-w-0 flex-1">
                <div className="flex items-center gap-1 min-w-0">
                  <a
                    href={`https://hyperevmscan.io/address/${frame.from}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-muted px-2 py-1 rounded font-mono text-xs hover:bg-muted/80 transition-colors truncate"
                    title={frame.from}
                  >
                    {formatAddress(frame.from)}
                  </a>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `desktop-from-${depth}-${index}`,
                        frame.from,
                      )
                    }
                    className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
                    title="Copy address"
                  >
                    {getCopyState(`desktop-from-${depth}-${index}`) ? (
                      <CheckIcon className="h-3 w-3 text-green-500" />
                    ) : (
                      <CopyIcon className="h-3 w-3 text-muted-foreground" />
                    )}
                  </button>
                  <a
                    href={`https://hyperevmscan.io/address/${frame.from}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
                    title="Open in explorer"
                  >
                    <ExternalLinkIcon className="h-3 w-3 text-muted-foreground" />
                  </a>
                </div>
                <ArrowRightIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <div className="flex items-center gap-1 min-w-0">
                  {frame.to ? (
                    <>
                      <a
                        href={`https://hyperevmscan.io/address/${frame.to}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-muted px-2 py-1 rounded font-mono text-xs hover:bg-muted/80 transition-colors truncate"
                        title={frame.to}
                      >
                        {formatAddress(frame.to)}
                      </a>
                      <button
                        onClick={() =>
                          frame.to &&
                          copyToClipboard(
                            `desktop-to-${depth}-${index}`,
                            frame.to,
                          )
                        }
                        className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
                        title="Copy address"
                      >
                        {getCopyState(`desktop-to-${depth}-${index}`) ? (
                          <CheckIcon className="h-3 w-3 text-green-500" />
                        ) : (
                          <CopyIcon className="h-3 w-3 text-muted-foreground" />
                        )}
                      </button>
                      <a
                        href={`https://hyperevmscan.io/address/${frame.to}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
                        title="Open in explorer"
                      >
                        <ExternalLinkIcon className="h-3 w-3 text-muted-foreground" />
                      </a>
                    </>
                  ) : (
                    <code className="bg-muted px-2 py-1 rounded font-mono text-xs">
                      CREATE
                    </code>
                  )}
                </div>
              </div>

              {/* Function signature */}
              {functionSig && (
                <Badge variant="outline" className="text-xs flex-shrink-0">
                  {functionSig}
                </Badge>
              )}
            </div>

            {/* Gas usage - show consumed gas */}
            <div className="flex items-center gap-1 text-sm flex-shrink-0">
              <FuelIcon className="h-3 w-3 text-orange-500" />
              <span className="font-mono">
                {gasUsedNumber.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">gas used</span>
            </div>
          </div>

          {/* Value transfer (if any) */}
          {frame.value && frame.value !== '0x0' && (
            <div className="flex items-center gap-2 mb-1 text-sm">
              <span className="text-muted-foreground">Value:</span>
              <span className="font-mono">
                {BigInt(frame.value).toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">wei</span>
            </div>
          )}

          {/* Error information */}
          {!isSuccess && frame.error && (
            <div className="flex gap-2 p-3 rounded-lg bg-muted/50 mb-2">
              <div className="mt-0.5">
                <div className="h-2 w-2 rounded-full bg-red-500" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="font-medium text-sm">
                  {(() => {
                    const parsedError = parseBlockchainError(frame.error)
                    const isContractError =
                      parsedError.type === 'revert' &&
                      parsedError.details &&
                      parsedError.details !==
                        'The transaction was reverted by the contract'
                    return isContractError
                      ? 'Contract Error'
                      : parsedError.title
                  })()}
                </div>
                {(() => {
                  const parsedError = parseBlockchainError(frame.error)
                  const isContractError =
                    parsedError.type === 'revert' &&
                    parsedError.details &&
                    parsedError.details !==
                      'The transaction was reverted by the contract'
                  return parsedError.details ? (
                    <div
                      className={`text-sm ${isContractError ? 'font-mono text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}
                    >
                      {parsedError.details}
                    </div>
                  ) : null
                })()}
              </div>
            </div>
          )}

          {/* Subcall summary */}
          {hasSubcalls && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground">
                📁 {frame.calls!.length} subcall
                {frame.calls!.length !== 1 ? 's' : ''}
              </span>
              {!isExpanded && (
                <button
                  onClick={() => setIsExpanded(true)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  expand
                </button>
              )}
            </div>
          )}

          {/* Details toggle - simplified */}
          {showDetails && (
            <div className="mt-2 p-2 bg-muted rounded text-xs space-y-1">
              <div>
                <span className="font-medium">Gas:</span> Used{' '}
                {gasUsedNumber.toLocaleString()}, Remaining{' '}
                {(gasProvidedNumber - gasUsedNumber).toLocaleString()}
              </div>

              {frame.input && frame.input !== '0x' && (
                <div>
                  <span className="font-medium">Input:</span>
                  <div className="font-mono break-all bg-background p-1 rounded border mt-1 text-xs">
                    {frame.input}
                  </div>
                </div>
              )}

              {frame.output && frame.output !== '0x' && (
                <div>
                  <span className="font-medium">Output:</span>
                  <div className="font-mono break-all bg-background p-1 rounded border mt-1 text-xs">
                    {frame.output}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Show details toggle at bottom */}
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <EyeIcon className="h-3 w-3" />
              {showDetails ? 'hide' : 'details'}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Render subcalls */}
      {hasSubcalls && isExpanded && (
        <div className="ml-3 border-l border-muted pl-2">
          {frame.calls!.map((subcall, subIndex) => (
            <CallFrameNode
              key={`${depth}-${subIndex}`}
              frame={subcall}
              depth={depth + 1}
              index={subIndex}
              isHorizontal={false}
            />
          ))}
        </div>
      )}
    </div>
  )
}
