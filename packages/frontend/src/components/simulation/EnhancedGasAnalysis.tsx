'use client'

import type { CallResult } from '@altitrace/sdk/types'
import { BarChart3Icon, FuelIcon } from 'lucide-react'
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import type { EnhancedSimulationResult } from '@/utils/trace-integration'

interface EnhancedGasAnalysisProps {
  result: EnhancedSimulationResult
}

interface GasData {
  totalGasUsed: bigint
  blockGasUsed: bigint
  calls: Array<{
    callIndex: number
    gasUsed: bigint
    status: string
  }>
}

export function EnhancedGasAnalysis({ result }: EnhancedGasAnalysisProps) {
  const gasData = analyzeGasUsage(result)
  
  // Get actual call count from trace data if available
  const callCount = result.traceData?.getCallCount?.() || gasData.calls.length

  return (
    <div className="space-y-6">
      {/* Gas Summary */}
      <GasSummary gasData={gasData} callCount={callCount} />

      {/* Per-Call Breakdown */}
      <CallGasBreakdown gasData={gasData} calls={result.calls || []} />
    </div>
  )
}

function GasSummary({ gasData, callCount }: { gasData: GasData; callCount: number }) {
  const totalGas = Number(gasData.totalGasUsed)
  const blockGas = Number(gasData.blockGasUsed)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Transaction Gas Used
              </p>
              <p className="text-2xl font-bold">{totalGas.toLocaleString()}</p>
            </div>
            <FuelIcon className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Block Gas Used
              </p>
              <p className="text-2xl font-bold">{blockGas.toLocaleString()}</p>
            </div>
            <BarChart3Icon className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Number of Calls
              </p>
              <p className="text-2xl font-bold">{callCount}</p>
            </div>
            <BarChart3Icon className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function CallGasBreakdown({
  gasData,
  calls,
}: {
  gasData: GasData
  calls: CallResult[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3Icon className="h-5 w-5" />
          Gas Usage by Call
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {gasData.calls.map((callGas, index) => {
            const call = calls[callGas.callIndex]
            const gasUsedNumber = Number(callGas.gasUsed)

            return (
              <div
                key={index}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <span className="font-medium">
                      Call #{callGas.callIndex + 1}
                    </span>
                    <Badge
                      variant={
                        call?.status === 'success' ? 'outline' : 'destructive'
                      }
                      className="ml-2 text-xs"
                    >
                      {call?.status || 'unknown'}
                    </Badge>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono text-sm font-medium">
                    {gasUsedNumber.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">gas used</div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// Helper function
function analyzeGasUsage(result: EnhancedSimulationResult): GasData {
  const totalGasUsed = result.getTotalGasUsed()
  
  // Check for block gas in receipt data (for trace results) or direct property
  const receiptData = (result as any).receipt
  const blockGasUsed = receiptData?.blockGasUsed 
    ? BigInt(receiptData.blockGasUsed)
    : result.blockGasUsed 
      ? BigInt(result.blockGasUsed) 
      : 0n

  // For trace results with call hierarchy, use the trace data call count
  let calls: Array<{ callIndex: number; gasUsed: bigint; status: string }> = []
  
  if (result.hasCallHierarchy && result.traceData?.callTracer?.rootCall) {
    // For trace results, create a single "call" representing the root transaction
    const rootCall = result.traceData.callTracer.rootCall
    calls = [{
      callIndex: 0,
      gasUsed: BigInt(rootCall.gasUsed || '0'),
      status: rootCall.reverted ? 'reverted' : 'success',
    }]
  } else {
    // For simulation results, use the calls array
    calls = (result.calls || []).map((call: CallResult, index: number) => ({
      callIndex: index,
      gasUsed: BigInt(call.gasUsed),
      status: call.status,
    }))
  }

  return {
    totalGasUsed,
    blockGasUsed,
    calls,
  }
}
