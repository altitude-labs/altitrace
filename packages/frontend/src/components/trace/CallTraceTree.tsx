'use client';

import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import { CallFrameNode } from './CallFrameNode';
import type { ExtendedTracerResponse } from '@altitrace/sdk';
import { 
  TrendingUpIcon,
  LayersIcon,
  FuelIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon
} from 'lucide-react';

interface CallTraceTreeProps {
  traceData: ExtendedTracerResponse;
  className?: string;
}

/**
 * Main component for displaying hierarchical call trace tree
 */
export function CallTraceTree({ traceData, className = '' }: CallTraceTreeProps) {
  const rootCall = traceData.callTracer?.rootCall;
  
  if (!rootCall) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center text-muted-foreground">
          No call trace data available
        </CardContent>
      </Card>
    );
  }

  // Calculate summary statistics
  const totalCalls = traceData.getCallCount();
  const maxDepth = traceData.getMaxDepth();
  // Use root call gas - this includes all subcall gas consumption
  // Note: Individual call gas values in hierarchical traces are NOT additive
  // Each frame's gasUsed includes gas consumed by its children
  const totalGasUsed = rootCall ? Number(BigInt(rootCall.gasUsed)) : Number(traceData.getTotalGasUsed());
  const isSuccess = traceData.isSuccess();
  const errors = traceData.getErrors();

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
                <div className="font-medium">{totalGasUsed.toLocaleString()}</div>
                <div className="text-muted-foreground">Total Gas</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-green-500" />
              <div>
                <div className="font-medium">
                  {isSuccess ? 'Success' : 'Failed'}
                  {errors.length > 0 && (
                    <Badge variant="destructive" className="ml-2 text-xs">
                      {errors.length} error{errors.length !== 1 ? 's' : ''}
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
          <div className="space-y-2">
            <CallFrameNode 
              frame={rootCall} 
              depth={0} 
              index={0}
              isRoot={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Error summary (if any) */}
      {errors.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-base text-red-800 flex items-center gap-2">
              <XCircleIcon className="h-5 w-5" />
              Execution Errors ({errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {errors.map((error, index) => (
                <div key={index} className="p-3 bg-red-100 border border-red-200 rounded-md">
                  <div className="font-mono text-sm text-red-800">{error}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Fallback component for when trace data is not available
 */
export function CallTraceTreeFallback({ message }: { message?: string }) {
  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardContent className="p-6 text-center">
        <LayersIcon className="h-12 w-12 text-yellow-600 mx-auto mb-3" />
        <h3 className="font-medium text-yellow-800 mb-2">Call Trace Unavailable</h3>
        <p className="text-sm text-yellow-700">
          {message || 'Trace data could not be loaded. Displaying basic simulation results instead.'}
        </p>
      </CardContent>
    </Card>
  );
}
