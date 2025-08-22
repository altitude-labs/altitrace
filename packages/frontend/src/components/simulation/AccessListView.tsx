'use client'

import type { ExtendedAccessListResponse } from '@altitrace/sdk/types'
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  DatabaseIcon,
  FuelIcon,
  HashIcon,
  KeyIcon,
  TrendingUpIcon,
  XCircleIcon,
} from 'lucide-react'
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import type { AccessListDisplayData, AccessListSummary } from '@/types/api'
import { formatNumber } from '@/utils'
import type { GasComparisonAnalysis } from '@/utils/trace-integration'
import { GasComparisonView } from './GasComparisonView'

interface AccessListViewProps {
  accessListData: ExtendedAccessListResponse
  gasComparison?: GasComparisonAnalysis
}

export function AccessListView({
  accessListData,
  gasComparison,
}: AccessListViewProps) {
  const displayData: AccessListDisplayData = {
    accountCount: accessListData.getAccountCount(),
    totalStorageSlots: accessListData.getStorageSlotCount(),
    gasUsed: accessListData.gasUsed,
    isSuccess: accessListData.isSuccess(),
    error: accessListData.error || undefined,
    summary: accessListData.getAccessListSummary(),
  }

  return (
    <div className="space-y-6">
      {/* Gas Comparison Analysis - Show prominently if available */}
      {gasComparison && <GasComparisonView gasComparison={gasComparison} />}
      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyIcon className="h-5 w-5" />
            Access List Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FuelIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Gas Used</span>
              </div>
              <div className="font-mono text-lg">
                {formatNumber(Number(displayData.gasUsed))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <HashIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Accounts</span>
              </div>
              <div className="font-mono text-lg">
                {displayData.accountCount}
              </div>
              <div className="text-xs text-muted-foreground">
                Accounts accessed
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <DatabaseIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Storage Slots
                </span>
              </div>
              <div className="font-mono text-lg">
                {displayData.totalStorageSlots}
              </div>
              <div className="text-xs text-muted-foreground">
                Total slots accessed
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              {displayData.isSuccess ? (
                <CheckCircleIcon className="h-5 w-5 text-green-500" />
              ) : (
                <XCircleIcon className="h-5 w-5 text-red-500" />
              )}
              <span className="font-medium">
                {displayData.isSuccess
                  ? 'Access List Generated'
                  : 'Generation Failed'}
              </span>
              <Badge
                variant={displayData.isSuccess ? 'success' : 'destructive'}
              >
                {displayData.isSuccess ? 'Success' : 'Failed'}
              </Badge>
            </div>
            {displayData.error && (
              <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                {displayData.error}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gas Optimization Info */}
      {displayData.isSuccess && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUpIcon className="h-5 w-5" />
              Gas Optimization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 border rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangleIcon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <h3 className="font-medium text-foreground">
                    <a
                      href="https://eips.ethereum.org/EIPS/eip-2930"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      EIP-2930 Access List Benefits
                    </a>
                  </h3>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      • Pre-warm accounts and storage slots to reduce gas costs
                    </p>
                    <p>
                      • Particularly effective for contracts with cold storage
                      access
                    </p>
                    <p>• Gas savings depend on storage slot access patterns</p>
                    <p>
                      • Use this access list when submitting the actual
                      transaction
                    </p>
                  </div>
                  <div className="mt-3 p-3 bg-background border rounded text-xs text-muted-foreground">
                    <strong className="text-foreground">Note:</strong> The gas
                    used shown above represents the cost to generate this access
                    list, not the savings from using it. Actual gas savings
                    occur when you include this access list in your transaction
                    submission.
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Details */}
      {displayData.isSuccess && displayData.summary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DatabaseIcon className="h-5 w-5" />
              Account Access Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {displayData.summary.map((account, index) => (
                <AccessListAccountCard
                  key={`account-${account.address}-${index}`}
                  account={account}
                  index={index}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raw Access List Data */}
      {displayData.isSuccess && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyIcon className="h-5 w-5" />
              Raw Access List
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded font-mono text-sm overflow-x-auto">
              <pre>{JSON.stringify(accessListData.accessList, null, 2)}</pre>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Use this access list data when submitting your transaction to
              benefit from gas optimizations.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface AccessListAccountCardProps {
  account: AccessListSummary
  index: number
}

function AccessListAccountCard({ account, index }: AccessListAccountCardProps) {
  return (
    <div className="bg-muted p-4 rounded border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline">Account #{index + 1}</Badge>
          <span className="font-mono text-sm">{account.address}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <DatabaseIcon className="h-4 w-4" />
          <span>{account.storageSlotCount} slots</span>
        </div>
      </div>

      {account.storageSlots.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Storage Slots Accessed:
          </div>
          <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto">
            {account.storageSlots.map((slot, slotIndex) => (
              <div
                key={`slot-${slotIndex}-${slot}`}
                className="font-mono text-xs bg-background p-2 rounded border break-all"
              >
                {slot}
              </div>
            ))}
          </div>
        </div>
      )}

      {account.storageSlots.length === 0 && (
        <div className="text-sm text-muted-foreground italic">
          No storage slots accessed (account balance/nonce only)
        </div>
      )}
    </div>
  )
}
