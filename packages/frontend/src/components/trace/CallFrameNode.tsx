'use client';

import { useState } from 'react';
import { Card, CardContent, Badge } from '@/components/ui';
import { CallTypeIcon } from '@/components/shared/CallTypeIcon';
import type { CallFrame } from '@altitrace/sdk';
import { 
  ChevronDownIcon, 
  ChevronRightIcon, 
  FuelIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon,
  EyeIcon,
  AlertCircleIcon
} from 'lucide-react';

interface CallFrameNodeProps {
  frame: CallFrame;
  depth?: number;
  index?: number;
  isRoot?: boolean;
}

/**
 * Individual call frame node with hierarchical display
 */
export function CallFrameNode({ 
  frame, 
  depth = 0, 
  index = 0, 
  isRoot = false 
}: CallFrameNodeProps) {
  const [isExpanded, setIsExpanded] = useState(depth === 0); // Root expanded by default
  const [showDetails, setShowDetails] = useState(false);

  const hasSubcalls = frame.calls && frame.calls.length > 0;
  const gasUsedNumber = parseInt(frame.gasUsed, 16);
  const gasProvidedNumber = parseInt(frame.gas, 16);
  const isSuccess = !frame.reverted;

  // Calculate depth-based styling
  const depthColors = [
    'border-l-blue-500',    // Depth 0
    'border-l-green-500',   // Depth 1  
    'border-l-orange-500',  // Depth 2
    'border-l-purple-500',  // Depth 3
    'border-l-pink-500',    // Depth 4
  ];
  const borderColor = depthColors[depth % depthColors.length] || 'border-l-gray-500';

  // Format address for display
  const formatAddress = (address: string) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Decode function signature from input data
  const getFunctionSignature = () => {
    if (!frame.input || frame.input === '0x' || frame.input.length < 10) {
      return null;
    }
    return frame.input.slice(0, 10); // First 4 bytes (8 hex chars + 0x)
  };

  const functionSig = getFunctionSignature();

  return (
    <div className={`${depth > 0 ? 'ml-4' : ''}`}>
      <Card className={`mb-1 border-l-4 ${borderColor} ${!isSuccess ? 'bg-red-50 border-red-200' : ''}`}>
        <CardContent className="p-3">
          {/* Main call header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              {/* Expand/collapse button */}
              {hasSubcalls && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1 hover:bg-gray-100 rounded"
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
              <CallTypeIcon callType={frame.callType} size="sm" />

              {/* Call number and success status */}
              <div className="flex items-center gap-2">
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
              <div className="flex items-center gap-2 text-sm">
                <code className="bg-muted px-2 py-1 rounded font-mono text-xs">
                  {formatAddress(frame.from)}
                </code>
                <ArrowRightIcon className="h-3 w-3 text-muted-foreground" />
                <code className="bg-muted px-2 py-1 rounded font-mono text-xs">
                  {frame.to ? formatAddress(frame.to) : 'CREATE'}
                </code>
              </div>

              {/* Function signature */}
              {functionSig && (
                <Badge variant="outline" className="text-xs">
                  {functionSig}
                </Badge>
              )}
            </div>

            {/* Gas usage - show consumed gas */}
            <div className="flex items-center gap-1 text-sm">
              <FuelIcon className="h-3 w-3 text-orange-500" />
              <span className="font-mono">{gasUsedNumber.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">gas used</span>
            </div>
          </div>

          {/* Value transfer (if any) */}
          {frame.value && frame.value !== '0x0' && (
            <div className="flex items-center gap-2 mb-1 text-sm">
              <span className="text-muted-foreground">Value:</span>
              <span className="font-mono">{BigInt(frame.value).toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">wei</span>
            </div>
          )}

          {/* Error information */}
          {!isSuccess && (
            <div className="bg-red-100 border border-red-200 rounded-md p-2 mb-1">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircleIcon className="h-3 w-3 text-red-600" />
                <span className="font-medium text-red-800 text-sm">Failed</span>
              </div>
              {frame.error && (
                <div className="text-xs text-red-700">
                  {frame.error}
                </div>
              )}
            </div>
          )}

          {/* Subcall summary */}
          {hasSubcalls && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground">
                📁 {frame.calls!.length} subcall{frame.calls!.length !== 1 ? 's' : ''}
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
                <span className="font-medium">Gas:</span> Used {gasUsedNumber.toLocaleString()}, Remaining {(gasProvidedNumber - gasUsedNumber).toLocaleString()}
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
