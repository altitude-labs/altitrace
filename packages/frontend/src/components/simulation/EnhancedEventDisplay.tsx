'use client'

import type { CallResult } from '@altitrace/sdk/types'
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  ExternalLinkIcon,
  Loader2Icon,
  TagIcon,
} from 'lucide-react'
import React, { useState } from 'react'
import { Badge, Card, CardContent, Select } from '@/components/ui'
import { useMultipleCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { useEventSignature } from '@/hooks/useEventSignature'
import {
  extractTokenInfoFromAssetChanges,
  getEnhancedAddressDisplay,
  type TokenInfo,
} from '@/utils/token-symbols'
import { HARDCODED_TOKEN_DATA } from '@/utils/trace-integration'

interface EnhancedEventDisplayProps {
  call: CallResult
  callIndex: number
  // Additional ABI information for enhanced decoding
  availableABI?: any[]
  fetchedContracts?: Array<{
    address: string
    name: string
    abi: any[]
    explorerSource: string
  }>
  // Asset changes data for token symbol enhancement
  assetChanges?: any[]
}

type LogEntry = CallResult['logs'][number]

// Known event signatures for common ERC standards
const KNOWN_EVENT_SIGNATURES: Record<
  string,
  {
    name: string
    params: Array<{ name: string; type: string; indexed: boolean }>
  }
> = {
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef': {
    name: 'Transfer',
    params: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925': {
    name: 'Approval',
    params: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'spender', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
}

export function EnhancedEventDisplay({
  call,
  callIndex,
  availableABI,
  fetchedContracts,
  assetChanges,
}: EnhancedEventDisplayProps) {
  if (!call.logs || call.logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <TagIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No events emitted in this call</p>
      </div>
    )
  }

  // Create token map from asset changes AND hardcoded token data for enhanced address display
  const tokenMap = React.useMemo(() => {
    // Start with hardcoded token data
    const enhancedTokenMap = new Map<string, TokenInfo>()

    // Add hardcoded tokens (HYPE, WHYPE)
    for (const [address, tokenData] of HARDCODED_TOKEN_DATA.entries()) {
      enhancedTokenMap.set(address, {
        address,
        symbol: tokenData.symbol,
        name: tokenData.name,
        decimals: tokenData.decimals,
      })
    }

    // Merge with asset changes data (asset changes take precedence if they exist)
    const assetTokenMap = extractTokenInfoFromAssetChanges(assetChanges || [])
    for (const [address, tokenInfo] of assetTokenMap.entries()) {
      enhancedTokenMap.set(address, tokenInfo)
    }

    return enhancedTokenMap
  }, [assetChanges])

  // Create enhanced event signatures by merging available ABI with known signatures
  const enhancedEventSignatures = React.useMemo(() => {
    const signatures = { ...KNOWN_EVENT_SIGNATURES }

    // Add signatures from availableABI
    if (availableABI) {
      for (const abiEntry of availableABI) {
        if (abiEntry.type === 'event' && abiEntry.name && abiEntry.inputs) {
          // Create event signature hash (simplified)
          const signature = `${abiEntry.name}(${abiEntry.inputs.map((i: any) => i.type).join(',')})`
          const hash = `0x${signature}` // In practice, you'd use keccak256 hash

          signatures[hash] = {
            name: abiEntry.name,
            params: abiEntry.inputs.map((input: any) => ({
              name: input.name || 'param',
              type: input.type,
              indexed: input.indexed || false,
            })),
          }
        }
      }
    }

    // Add signatures from fetchedContracts
    if (fetchedContracts) {
      for (const contract of fetchedContracts) {
        for (const abiEntry of contract.abi) {
          if (abiEntry.type === 'event' && abiEntry.name && abiEntry.inputs) {
            // Create event signature hash (simplified)
            const signature = `${abiEntry.name}(${abiEntry.inputs.map((i: any) => i.type).join(',')})`
            const hash = `0x${signature}` // In practice, you'd use keccak256 hash

            signatures[hash] = {
              name: abiEntry.name,
              params: abiEntry.inputs.map((input: any) => ({
                name: input.name || 'param',
                type: input.type,
                indexed: input.indexed || false,
              })),
            }
          }
        }
      }
    }

    return signatures
  }, [availableABI, fetchedContracts])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <TagIcon className="h-4 w-4" />
        <h3 className="font-semibold">Event Logs ({call.logs.length})</h3>
        <Badge variant="outline" className="text-xs">
          Call #{callIndex + 1}
        </Badge>
        {(availableABI && availableABI.length > 0) ||
        (fetchedContracts && fetchedContracts.length > 0) ? (
          <Badge variant="secondary" className="text-xs">
            <CheckIcon className="h-3 w-3 mr-1" />
            ABI Loaded
          </Badge>
        ) : null}
      </div>

      {call.logs.map((log: LogEntry, logIndex: number) => (
        <EventCard
          key={`log-${log.address}-${logIndex}`}
          log={log}
          logIndex={logIndex}
          enhancedSignatures={enhancedEventSignatures}
          tokenMap={tokenMap}
        />
      ))}
    </div>
  )
}

type FormatType = 'hex' | 'dec' | 'address' | 'text'

function EventCard({
  log,
  logIndex,
  enhancedSignatures,
  tokenMap,
}: {
  log: LogEntry
  logIndex: number
  enhancedSignatures?: Record<
    string,
    {
      name: string
      params: Array<{ name: string; type: string; indexed: boolean }>
    }
  >
  tokenMap?: Map<string, TokenInfo>
}) {
  const { getCopyState, copyToClipboard } = useMultipleCopyToClipboard()
  const [isExpanded, setIsExpanded] = useState(false)
  const eventSignature = log.topics[0]
  const knownEvent =
    enhancedSignatures?.[eventSignature] ||
    KNOWN_EVENT_SIGNATURES[eventSignature]

  // Use the hook to lookup unknown signatures
  const { eventData: lookupEvent, isLoading: isLookingUp } = useEventSignature(
    !knownEvent ? eventSignature : undefined,
    knownEvent,
  )

  // Use either known event or looked up event
  const eventInfo = knownEvent || lookupEvent
  const hasKnownDecoding = !!eventInfo

  // Smart default format detection
  const getDefaultFormat = (value: string, paramType?: string): FormatType => {
    if (!value || value === '0x') return 'hex'

    // Address type or looks like an address (20 bytes = 40 hex chars + 0x)
    if (
      paramType === 'address' ||
      (value.startsWith('0x') && value.length === 42)
    ) {
      return 'address'
    }

    // Try to detect if it's readable text
    if (value.startsWith('0x') && value.length > 2) {
      try {
        const hex = value.slice(2)
        const text = Buffer.from(hex, 'hex').toString('utf8')
        // Check if it contains mostly printable ASCII characters
        if (
          text.length > 0 &&
          /^[\x20-\x7E\s]*$/.test(text) &&
          text.trim().length > 0
        ) {
          return 'text'
        }
      } catch {}
    }

    return 'hex'
  }

  const [dataFormat, setDataFormat] = useState<FormatType>(() =>
    getDefaultFormat(
      log.data,
      hasKnownDecoding
        ? eventInfo.params.find((p) => !p.indexed)?.type
        : undefined,
    ),
  )

  const [topicFormats, setTopicFormats] = useState<Record<number, FormatType>>(
    () => {
      const formats: Record<number, FormatType> = {}
      log.topics.forEach((topic, index) => {
        if (index === 0) {
          formats[index] = 'hex' // Event signature always hex
        } else if (hasKnownDecoding) {
          const indexedParams = eventInfo.params.filter((p) => p.indexed)
          const paramType = indexedParams[index - 1]?.type
          formats[index] = getDefaultFormat(topic, paramType)
        } else {
          formats[index] = getDefaultFormat(topic)
        }
      })
      return formats
    },
  )

  const getExplorerUrl = (address: string) => {
    const explorerUrl =
      process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://hyperevmscan.io'
    return `${explorerUrl}/address/${address}`
  }

  const _handleAddressClick = (address: string) => {
    window.open(getExplorerUrl(address), '_blank', 'noopener,noreferrer')
  }

  const setTopicFormat = (topicIndex: number, format: FormatType) => {
    setTopicFormats((prev) => ({ ...prev, [topicIndex]: format }))
  }

  const formatValue = (value: string, format: FormatType) => {
    if (!value || value === '0x') return value

    try {
      switch (format) {
        case 'dec':
          if (value.startsWith('0x')) {
            const decimal = BigInt(value).toString()
            return decimal.length > 15
              ? BigInt(value).toLocaleString()
              : decimal
          }
          return value

        case 'address':
          if (value.startsWith('0x') && value.length === 42) {
            return value // Full address
          }
          if (value.startsWith('0x') && value.length > 26) {
            // Padded address - extract last 20 bytes
            const addr = `0x${value.slice(-40)}`
            return addr
          }
          return value

        case 'text':
          if (value.startsWith('0x')) {
            try {
              const hex = value.slice(2)
              const text = Buffer.from(hex, 'hex').toString('utf8')
              // Remove null bytes and trim
              return text.replace(/\0/g, '').trim() || value
            } catch {
              return value
            }
          }
          return value
        default:
          if (value.startsWith('0x')) {
            return value
          }
          return `0x${BigInt(value).toString(16)}`
      }
    } catch {
      return value
    }
  }

  const isValidAddress = (address: string): boolean => {
    return (
      address.startsWith('0x') &&
      address.length === 42 &&
      /^0x[0-9a-fA-F]{40}$/.test(address)
    )
  }

  const getFormatOptions = (
    value: string,
    paramType?: string,
  ): Array<{ value: FormatType; label: string }> => {
    const options = [
      { value: 'hex' as FormatType, label: 'Hex' },
      { value: 'dec' as FormatType, label: 'Dec' },
    ]

    // Add address option if it could be an address
    if (
      paramType === 'address' ||
      (value.startsWith('0x') && (value.length === 42 || value.length >= 66))
    ) {
      options.push({ value: 'address' as FormatType, label: 'Address' })
    }

    // Add text option if it could be text
    if (value.startsWith('0x') && value.length > 10) {
      options.push({ value: 'text' as FormatType, label: 'Text' })
    }

    return options
  }

  return (
    <Card>
      {/* Collapsible Header */}
      <div
        className="px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors border-b"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <div className="flex items-center gap-2">
                {/* Event Name */}
                {isLookingUp ? (
                  <div className="flex items-center gap-2">
                    <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="font-mono text-sm text-muted-foreground">
                      Looking up...
                    </span>
                  </div>
                ) : hasKnownDecoding ? (
                  <span className="font-mono text-sm font-medium">
                    {eventInfo.name}
                  </span>
                ) : (
                  <span className="font-mono text-sm text-muted-foreground">
                    Unknown Event
                  </span>
                )}
                <Badge variant="outline" className="text-xs">
                  Log #{logIndex}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>
                  {(() => {
                    const addressDisplay = getEnhancedAddressDisplay(
                      log.address,
                      tokenMap || new Map(),
                    )
                    return addressDisplay.primary
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <CardContent className="p-4">
          {/* Header */}
          <div className="space-y-3">
            {/* Address */}
            <div>
              <span className="text-sm font-medium">Address</span>
              <div className="flex items-center gap-2 mt-1">
                {(() => {
                  const addressDisplay = getEnhancedAddressDisplay(
                    log.address,
                    tokenMap || new Map(),
                  )
                  return (
                    <>
                      <a
                        href={getExplorerUrl(log.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-mono text-blue-600 hover:text-blue-800 transition-colors"
                        title={log.address}
                      >
                        <div className="flex flex-col">
                          <span
                            className={
                              addressDisplay.isToken ? 'font-semibold' : ''
                            }
                          >
                            {addressDisplay.primary}
                          </span>
                          {addressDisplay.secondary && (
                            <span className="text-xs text-muted-foreground">
                              {addressDisplay.secondary}
                            </span>
                          )}
                        </div>
                      </a>
                      {addressDisplay.isToken && (
                        <Badge variant="secondary" className="text-xs">
                          {addressDisplay.tokenInfo?.symbol === 'HYPE'
                            ? 'Native'
                            : 'Token'}
                        </Badge>
                      )}
                      <button
                        onClick={() =>
                          copyToClipboard('contract-address', log.address)
                        }
                        className="p-1 hover:bg-muted rounded transition-colors"
                        title="Copy address"
                      >
                        {getCopyState('contract-address') ? (
                          <CheckIcon className="h-3 w-3 text-green-500" />
                        ) : (
                          <CopyIcon className="h-3 w-3 text-muted-foreground" />
                        )}
                      </button>
                      <a
                        href={getExplorerUrl(log.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-muted rounded transition-colors"
                        title="Open in explorer"
                      >
                        <ExternalLinkIcon className="h-3 w-3 text-muted-foreground" />
                      </a>
                      <Badge variant="outline" className="text-xs">
                        Log #{logIndex}
                      </Badge>
                    </>
                  )
                })()}
              </div>
            </div>

            {/* Event Name */}
            <div>
              <span className="text-sm font-medium">Name</span>
              <div className="mt-1">
                {isLookingUp ? (
                  <div className="flex items-center gap-2">
                    <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="font-mono text-sm text-muted-foreground">
                      Looking up event signature...
                    </span>
                  </div>
                ) : hasKnownDecoding ? (
                  <span className="font-mono text-sm">
                    {eventInfo.name}(
                    {eventInfo.params.map((p, i) => {
                      const indexedParams = eventInfo.params.filter(
                        (param) => param.indexed,
                      )
                      const topicIndex = p.indexed
                        ? indexedParams.indexOf(p) + 1
                        : 'data'

                      return (
                        <span key={p.name}>
                          {p.indexed && `index_topic_${topicIndex} `}
                          {!p.indexed && 'topic_data '}
                          <span>{p.type}</span> <span>{p.name}</span>
                          {i < eventInfo.params.length - 1 && ', '}
                        </span>
                      )
                    })}
                    )
                  </span>
                ) : (
                  <div className="space-y-2">
                    <span className="font-mono text-sm text-muted-foreground">
                      Unknown Event
                    </span>
                    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                      <div className="flex items-start gap-2">
                        <AlertTriangleIcon className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <div className="space-y-1">
                          <p>
                            <strong>Event signature not recognized</strong>
                          </p>
                          <p>
                            This event cannot be decoded because its ABI is not
                            available.
                          </p>
                          <div className="text-xs mt-1">
                            <p>
                              <strong>To decode this event:</strong>
                            </p>
                            <ul className="list-disc list-inside space-y-0.5 ml-2">
                              <li>
                                Ensure the contract is verified on block
                                explorers
                              </li>
                              <li>
                                Check if this is a proxy contract with a
                                separate implementation
                              </li>
                              <li>
                                Raw event data is still available in topics and
                                data below
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Topics */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Topics</span>
              <span className="text-xs text-muted-foreground">
                {log.topics.length}
              </span>
            </div>

            <div className="space-y-2">
              {log.topics.map((topic, topicIndex) => {
                const isIndexedParam = hasKnownDecoding && topicIndex > 0
                const indexedParams = hasKnownDecoding
                  ? eventInfo.params.filter((p) => p.indexed)
                  : []
                const paramName =
                  isIndexedParam && indexedParams[topicIndex - 1]?.name
                const currentFormat = topicFormats[topicIndex] || 'hex'

                return (
                  <div
                    key={`topic-${topicIndex}-${topic}`}
                    className="space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-xs min-w-[16px] text-center"
                      >
                        {topicIndex}
                      </Badge>
                      <code className="bg-muted px-2 py-1 rounded text-xs font-mono flex-1 break-all">
                        {topic}
                      </code>
                    </div>

                    {paramName && (
                      <div className="ml-6 flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {topicIndex}: {paramName}
                        </Badge>
                        <Select
                          value={currentFormat}
                          onChange={(e) =>
                            setTopicFormat(
                              topicIndex,
                              e.target.value as FormatType,
                            )
                          }
                          options={getFormatOptions(
                            topic,
                            indexedParams[topicIndex - 1]?.type,
                          )}
                          className="w-24"
                        />
                        {currentFormat === 'address' &&
                        isValidAddress(formatValue(topic, currentFormat)) ? (
                          <div className="flex items-center gap-1 flex-1">
                            <a
                              href={getExplorerUrl(
                                formatValue(topic, currentFormat),
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-background px-2 py-1 rounded text-xs font-mono flex-1 text-left text-blue-600 hover:text-blue-800 hover:bg-muted transition-colors break-all"
                              title={`View ${formatValue(topic, currentFormat)} on explorer`}
                            >
                              {formatValue(topic, currentFormat)}
                            </a>
                            <button
                              onClick={() =>
                                copyToClipboard(
                                  `topic-${topicIndex}`,
                                  formatValue(topic, currentFormat),
                                )
                              }
                              className="p-1 hover:bg-muted rounded transition-colors"
                              title="Copy address"
                            >
                              {getCopyState(`topic-${topicIndex}`) ? (
                                <CheckIcon className="h-3 w-3 text-green-500" />
                              ) : (
                                <CopyIcon className="h-3 w-3 text-muted-foreground" />
                              )}
                            </button>
                            <a
                              href={getExplorerUrl(
                                formatValue(topic, currentFormat),
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 hover:bg-muted rounded transition-colors"
                              title="Open in explorer"
                            >
                              <ExternalLinkIcon className="h-3 w-3 text-muted-foreground" />
                            </a>
                          </div>
                        ) : (
                          <code className="bg-background px-2 py-1 rounded text-xs font-mono flex-1 break-all">
                            {formatValue(topic, currentFormat)}
                          </code>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Data */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Data</span>
              <Select
                value={dataFormat}
                onChange={(e) => setDataFormat(e.target.value as FormatType)}
                options={getFormatOptions(
                  log.data,
                  hasKnownDecoding
                    ? eventInfo.params.find((p) => !p.indexed)?.type
                    : undefined,
                )}
                className="w-24"
              />
            </div>

            {log.data && log.data !== '0x' ? (
              <div className="bg-muted p-3 rounded overflow-hidden">
                {hasKnownDecoding &&
                eventInfo.params.find((p) => !p.indexed) ? (
                  <div className="text-sm">
                    <span className="text-muted-foreground font-mono">
                      value:{' '}
                    </span>
                    {dataFormat === 'address' &&
                    isValidAddress(formatValue(log.data, dataFormat)) ? (
                      <div className="flex items-center gap-2">
                        <a
                          href={getExplorerUrl(
                            formatValue(log.data, dataFormat),
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-blue-600 hover:text-blue-800 hover:underline transition-colors break-all"
                          title={`View ${formatValue(log.data, dataFormat)} on explorer`}
                        >
                          {formatValue(log.data, dataFormat)}
                        </a>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              'data-address',
                              formatValue(log.data, dataFormat),
                            )
                          }
                          className="p-1 hover:bg-muted rounded transition-colors"
                          title="Copy address"
                        >
                          {getCopyState('data-address') ? (
                            <CheckIcon className="h-3 w-3 text-green-500" />
                          ) : (
                            <CopyIcon className="h-3 w-3 text-muted-foreground" />
                          )}
                        </button>
                        <a
                          href={getExplorerUrl(
                            formatValue(log.data, dataFormat),
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-muted rounded transition-colors"
                          title="Open in explorer"
                        >
                          <ExternalLinkIcon className="h-3 w-3 text-muted-foreground" />
                        </a>
                      </div>
                    ) : (
                      <code className="font-mono break-all block">
                        {formatValue(log.data, dataFormat)}
                      </code>
                    )}
                  </div>
                ) : dataFormat === 'address' &&
                  isValidAddress(formatValue(log.data, dataFormat)) ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={getExplorerUrl(formatValue(log.data, dataFormat))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono break-all text-blue-600 hover:text-blue-800 hover:underline transition-colors flex-1"
                      title={`View ${formatValue(log.data, dataFormat)} on explorer`}
                    >
                      {formatValue(log.data, dataFormat)}
                    </a>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          'data-address-simple',
                          formatValue(log.data, dataFormat),
                        )
                      }
                      className="p-1 hover:bg-muted rounded transition-colors"
                      title="Copy address"
                    >
                      {getCopyState('data-address-simple') ? (
                        <CheckIcon className="h-3 w-3 text-green-500" />
                      ) : (
                        <CopyIcon className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                    <a
                      href={getExplorerUrl(formatValue(log.data, dataFormat))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:bg-muted rounded transition-colors"
                      title="Open in explorer"
                    >
                      <ExternalLinkIcon className="h-3 w-3 text-muted-foreground" />
                    </a>
                  </div>
                ) : (
                  <code className="text-xs font-mono break-all block">
                    {formatValue(log.data, dataFormat)}
                  </code>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No data</div>
            )}
          </div>

          {/* ABI Notice */}
          {!hasKnownDecoding && (
            <div className="mt-4 p-3 bg-muted/50 rounded border">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangleIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">ABI Not Available</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Import contract ABI for decoded parameter names.
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
