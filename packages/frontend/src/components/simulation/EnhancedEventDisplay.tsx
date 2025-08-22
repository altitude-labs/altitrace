'use client';

import { useState } from 'react';
import { Card, CardContent, Badge, Select } from '@/components/ui';
import { DecHexToggle } from '@/components/shared/DecHexToggle';
import { TagIcon, AlertTriangleIcon } from 'lucide-react';
import type { CallResult } from '@altitrace/sdk';

interface EnhancedEventDisplayProps {
  call: CallResult;
  callIndex: number;
}

type LogEntry = CallResult['logs'][number];

// Known event signatures for common ERC standards
const KNOWN_EVENT_SIGNATURES: Record<string, { name: string; params: Array<{ name: string; type: string; indexed: boolean }> }> = {
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef': {
    name: 'Transfer',
    params: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false }
    ]
  },
  '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925': {
    name: 'Approval',
    params: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'spender', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false }
    ]
  }
};

export function EnhancedEventDisplay({ call, callIndex }: EnhancedEventDisplayProps) {
  if (!call.logs || call.logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <TagIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No events emitted in this call</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <TagIcon className="h-4 w-4" />
        <h3 className="font-semibold">Event Logs ({call.logs.length})</h3>
        <Badge variant="outline" className="text-xs">
          Call #{callIndex + 1}
        </Badge>
      </div>

      {call.logs.map((log: LogEntry, logIndex: number) => (
        <EventCard key={logIndex} log={log} logIndex={logIndex} />
      ))}
    </div>
  );
}

type FormatType = 'hex' | 'dec' | 'address' | 'text';

function EventCard({ log, logIndex }: { log: LogEntry; logIndex: number }) {
  const eventSignature = log.topics[0];
  const knownEvent = KNOWN_EVENT_SIGNATURES[eventSignature];
  const hasKnownDecoding = !!knownEvent;

  // Smart default format detection
  const getDefaultFormat = (value: string, paramType?: string): FormatType => {
    if (!value || value === '0x') return 'hex';
    
    // Address type or looks like an address (20 bytes = 40 hex chars + 0x)
    if (paramType === 'address' || (value.startsWith('0x') && value.length === 42)) {
      return 'address';
    }
    
    // Try to detect if it's readable text
    if (value.startsWith('0x') && value.length > 2) {
      try {
        const hex = value.slice(2);
        const text = Buffer.from(hex, 'hex').toString('utf8');
        // Check if it contains mostly printable ASCII characters
        if (text.length > 0 && /^[\x20-\x7E\s]*$/.test(text) && text.trim().length > 0) {
          return 'text';
        }
      } catch {}
    }
    
    return 'hex';
  };

  const [dataFormat, setDataFormat] = useState<FormatType>(() => 
    getDefaultFormat(log.data, hasKnownDecoding ? knownEvent.params.find(p => !p.indexed)?.type : undefined)
  );
  
  const [topicFormats, setTopicFormats] = useState<Record<number, FormatType>>(() => {
    const formats: Record<number, FormatType> = {};
    log.topics.forEach((topic, index) => {
      if (index === 0) {
        formats[index] = 'hex'; // Event signature always hex
      } else if (hasKnownDecoding) {
        const indexedParams = knownEvent.params.filter(p => p.indexed);
        const paramType = indexedParams[index - 1]?.type;
        formats[index] = getDefaultFormat(topic, paramType);
      } else {
        formats[index] = getDefaultFormat(topic);
      }
    });
    return formats;
  });

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-6)}`;

  const getExplorerUrl = (address: string) => {
    const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://explorer.hyperliquid-testnet.xyz';
    return `${explorerUrl}/address/${address}`;
  };

  const handleAddressClick = (address: string) => {
    window.open(getExplorerUrl(address), '_blank', 'noopener,noreferrer');
  };

  const setTopicFormat = (topicIndex: number, format: FormatType) => {
    setTopicFormats(prev => ({ ...prev, [topicIndex]: format }));
  };

  const formatValue = (value: string, format: FormatType) => {
    if (!value || value === '0x') return value;
    
    try {
      switch (format) {
        case 'dec':
          if (value.startsWith('0x')) {
            const decimal = BigInt(value).toString();
            return decimal.length > 15 ? BigInt(value).toLocaleString() : decimal;
          }
          return value;
        
        case 'address':
          if (value.startsWith('0x') && value.length === 42) {
            return value; // Full address
          }
          if (value.startsWith('0x') && value.length > 26) {
            // Padded address - extract last 20 bytes
            const addr = '0x' + value.slice(-40);
            return addr;
          }
          return value;
        
        case 'text':
          if (value.startsWith('0x')) {
            try {
              const hex = value.slice(2);
              const text = Buffer.from(hex, 'hex').toString('utf8');
              // Remove null bytes and trim
              return text.replace(/\0/g, '').trim() || value;
            } catch {
              return value;
            }
          }
          return value;
        
        case 'hex':
        default:
          if (value.startsWith('0x')) {
            return value;
          } else {
            return `0x${BigInt(value).toString(16)}`;
          }
      }
    } catch {
      return value;
    }
  };

  const isValidAddress = (address: string): boolean => {
    return address.startsWith('0x') && address.length === 42 && /^0x[0-9a-fA-F]{40}$/.test(address);
  };

  const getFormatOptions = (value: string, paramType?: string): Array<{ value: FormatType; label: string }> => {
    const options = [
      { value: 'hex' as FormatType, label: 'Hex' },
      { value: 'dec' as FormatType, label: 'Dec' }
    ];
    
    // Add address option if it could be an address
    if (paramType === 'address' || (value.startsWith('0x') && (value.length === 42 || value.length >= 66))) {
      options.push({ value: 'address' as FormatType, label: 'Address' });
    }
    
    // Add text option if it could be text
    if (value.startsWith('0x') && value.length > 10) {
      options.push({ value: 'text' as FormatType, label: 'Text' });
    }
    
    return options;
  };

  return (
    <Card>
      <CardContent className="p-4">
        {/* Header */}
        <div className="space-y-3">
          {/* Address */}
          <div>
            <span className="text-sm font-medium">Address</span>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-sm font-mono text-blue-600">
                {formatAddress(log.address)}
              </code>
              <Badge variant="outline" className="text-xs">
                Log #{logIndex}
              </Badge>
            </div>
          </div>

          {/* Event Name */}
          <div>
            <span className="text-sm font-medium">Name</span>
            <div className="mt-1">
              {hasKnownDecoding ? (
                <span className="font-mono text-sm">
                  {knownEvent.name}(
                  {knownEvent.params.map((p, i) => {
                    const indexedParams = knownEvent.params.filter(param => param.indexed);
                    const topicIndex = p.indexed ? indexedParams.indexOf(p) + 1 : 'data';
                    
                    return (
                      <span key={p.name}>
                        {p.indexed && `index_topic_${topicIndex} `}
                        {!p.indexed && 'topic_data '}
                        <span>{p.type}</span>{' '}
                        <span>{p.name}</span>
                        {i < knownEvent.params.length - 1 && ', '}
                      </span>
                    );
                  })}
                  )
                </span>
              ) : (
                <span className="font-mono text-sm text-muted-foreground">Unknown Event</span>
              )}
            </div>
          </div>
        </div>

        {/* Topics */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Topics</span>
            <span className="text-xs text-muted-foreground">{log.topics.length}</span>
          </div>
          
          <div className="space-y-2">
            {log.topics.map((topic, topicIndex) => {
              const isIndexedParam = hasKnownDecoding && topicIndex > 0;
              const indexedParams = hasKnownDecoding ? knownEvent.params.filter(p => p.indexed) : [];
              const paramName = isIndexedParam && indexedParams[topicIndex - 1]?.name;
              const currentFormat = topicFormats[topicIndex] || 'hex';
              
              return (
                <div key={topicIndex} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs min-w-[16px] text-center">
                      {topicIndex}
                    </Badge>
                    <code className="bg-muted px-2 py-1 rounded text-xs font-mono flex-1">
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
                        onChange={(e) => setTopicFormat(topicIndex, e.target.value as FormatType)}
                        options={getFormatOptions(topic, indexedParams[topicIndex - 1]?.type)}
                        className="w-24"
                      />
                      {currentFormat === 'address' && isValidAddress(formatValue(topic, currentFormat)) ? (
                        <button
                          onClick={() => handleAddressClick(formatValue(topic, currentFormat))}
                          className="bg-background px-2 py-1 rounded text-xs font-mono flex-1 text-left text-blue-600 hover:text-blue-800 hover:bg-muted cursor-pointer border-none"
                          title={`View ${formatValue(topic, currentFormat)} on explorer`}
                        >
                          {formatValue(topic, currentFormat)}
                        </button>
                      ) : (
                        <code className="bg-background px-2 py-1 rounded text-xs font-mono flex-1">
                          {formatValue(topic, currentFormat)}
                        </code>
                      )}
                    </div>
                  )}
                </div>
              );
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
              options={getFormatOptions(log.data, hasKnownDecoding ? knownEvent.params.find(p => !p.indexed)?.type : undefined)}
              className="w-24"
            />
          </div>
          
          {log.data && log.data !== '0x' ? (
            <div className="bg-muted p-3 rounded">
              {hasKnownDecoding && knownEvent.params.find(p => !p.indexed) ? (
                <div className="text-sm">
                  <span className="text-muted-foreground font-mono">value: </span>
                  {dataFormat === 'address' && isValidAddress(formatValue(log.data, dataFormat)) ? (
                    <button
                      onClick={() => handleAddressClick(formatValue(log.data, dataFormat))}
                      className="font-mono text-blue-600 hover:text-blue-800 hover:underline cursor-pointer bg-transparent border-none p-0"
                      title={`View ${formatValue(log.data, dataFormat)} on explorer`}
                    >
                      {formatValue(log.data, dataFormat)}
                    </button>
                  ) : (
                    <code className="font-mono">
                      {formatValue(log.data, dataFormat)}
                    </code>
                  )}
                </div>
              ) : (
                dataFormat === 'address' && isValidAddress(formatValue(log.data, dataFormat)) ? (
                  <button
                    onClick={() => handleAddressClick(formatValue(log.data, dataFormat))}
                    className="text-xs font-mono break-all text-blue-600 hover:text-blue-800 hover:underline cursor-pointer bg-transparent border-none p-0 text-left w-full"
                    title={`View ${formatValue(log.data, dataFormat)} on explorer`}
                  >
                    {formatValue(log.data, dataFormat)}
                  </button>
                ) : (
                  <code className="text-xs font-mono break-all">
                    {formatValue(log.data, dataFormat)}
                  </code>
                )
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
    </Card>
  );
}


