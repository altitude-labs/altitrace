'use client'

import type { CallResult, ExtendedSimulationResult } from '@altitrace/sdk/types'
import { BarChart3Icon, FuelIcon } from 'lucide-react'
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui'

interface EnhancedGasAnalysisProps {
  result: ExtendedSimulationResult
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

  return (
    <div className="space-y-6">
      {/* Gas Summary */}
      <GasSummary gasData={gasData} />

      {/* Per-Call Breakdown */}
      <CallGasBreakdown gasData={gasData} calls={result.calls || []} />
    </div>
  )
}

function GasSummary({ gasData }: { gasData: GasData }) {
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
              <p className="text-2xl font-bold">{gasData.calls.length}</p>
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
function analyzeGasUsage(result: ExtendedSimulationResult): GasData {
  const totalGasUsed = result.getTotalGasUsed()
  const blockGasUsed = BigInt(result.blockGasUsed)

  const calls = (result.calls || []).map((call, index) => ({
    callIndex: index,
    gasUsed: BigInt(call.gasUsed),
    status: call.status,
  }))

  return {
    totalGasUsed,
    blockGasUsed,
    calls,
  }
}
