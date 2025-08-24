'use client'

import type { PrestateTraceResponse, AccountState } from '@altitrace/sdk/types'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  PlusIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from 'lucide-react'
import { useState } from 'react'
import { DecHexToggle } from '@/components/shared/DecHexToggle'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import { formatWeiValue } from '@/utils/abi'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'

interface StateChangesViewProps {
  prestateData: PrestateTraceResponse
}

export function StateChangesView({ prestateData }: StateChangesViewProps) {
  // Check if we have diff mode data (before/after states)
  const isDiffMode = 'pre' in prestateData && 'post' in prestateData

  if (!isDiffMode) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <DatabaseIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>State changes require prestate tracer in diff mode</p>
        <p className="text-xs mt-1">
          Current data shows prestate mode (accounts accessed)
        </p>
      </div>
    )
  }

  const diffData = prestateData as any // PrestateDiffMode type
  const preAccounts = diffData.pre || {}
  const postAccounts = diffData.post || {}

  // Find all accounts that have changes
  const allAddresses = new Set([
    ...Object.keys(preAccounts),
    ...Object.keys(postAccounts),
  ])

  const accountChanges = Array.from(allAddresses)
    .map((address) => {
      const preState = preAccounts[address] || {}
      const rawPostState = postAccounts[address] || {}

      // Merge post state with pre state for missing fields (diff optimization)
      const postState = {
        balance:
          rawPostState.balance !== undefined
            ? rawPostState.balance
            : preState.balance,
        nonce:
          rawPostState.nonce !== undefined
            ? rawPostState.nonce
            : preState.nonce,
        code:
          rawPostState.code !== undefined ? rawPostState.code : preState.code,
        storage: { ...preState.storage, ...rawPostState.storage },
      }

      return {
        address,
        preState,
        postState,
        hasChanges: hasAccountChanges(preState, postState),
      }
    })
    .filter((account) => account.hasChanges)

  if (accountChanges.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <DatabaseIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No state changes detected</p>
        <p className="text-xs mt-1">
          This transaction didn't modify any account states
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {accountChanges.map((account, index) => (
        <AccountChangeCard
          key={`${account.address}-${index}`}
          address={account.address}
          preState={account.preState}
          postState={account.postState}
        />
      ))}
    </div>
  )
}

interface AccountChangeCardProps {
  address: string
  preState: AccountState
  postState: AccountState
}

function AccountChangeCard({
  address,
  preState,
  postState,
}: AccountChangeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { copied, copyToClipboard } = useCopyToClipboard()

  const balanceChanged = preState.balance !== postState.balance
  const nonceChanged = preState.nonce !== postState.nonce
  const codeChanged = preState.code !== postState.code
  const storageChanged = hasStorageChanges(
    preState.storage || {},
    postState.storage || {},
  )

  // Calculate balance change
  let balanceDiff = 0n
  let balanceDirection: 'increase' | 'decrease' | 'none' = 'none'

  if (balanceChanged && preState.balance && postState.balance) {
    try {
      const preBal = BigInt(preState.balance)
      const postBal = BigInt(postState.balance)
      balanceDiff = postBal - preBal
      balanceDirection = balanceDiff > 0n ? 'increase' : 'decrease'
    } catch (error) {
      console.warn('Failed to calculate balance diff:', error)
    }
  }

  const getExplorerUrl = (address: string) => {
    return `https://hyperscan.com/address/${address}`
  }

  const changeCount = [
    balanceChanged,
    nonceChanged,
    codeChanged,
    storageChanged,
  ].filter(Boolean).length

  return (
    <Card>
      <CardHeader className="pb-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between hover:bg-muted/50 -m-3 p-3 rounded transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-shrink-0">
              {isExpanded ? (
                <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
              )}
              <DatabaseIcon className="h-4 w-4 text-primary" />
            </div>

            <div className="min-w-0 flex-1 text-left">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-mono truncate">
                  {address}
                </CardTitle>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-xs text-muted-foreground">
                  {changeCount} change{changeCount !== 1 ? 's' : ''}
                </p>
                {(balanceChanged ||
                  nonceChanged ||
                  codeChanged ||
                  storageChanged) && (
                  <div className="flex items-center gap-1">
                    {balanceChanged && (
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        Balance
                      </Badge>
                    )}
                    {nonceChanged && (
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        Nonce
                      </Badge>
                    )}
                    {codeChanged && (
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        Code
                      </Badge>
                    )}
                    {storageChanged && (
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        Storage
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {balanceChanged && (
              <div className="flex items-center gap-1 text-sm">
                {balanceDirection === 'increase' && (
                  <TrendingUpIcon className="h-4 w-4 text-green-500" />
                )}
                {balanceDirection === 'decrease' && (
                  <TrendingDownIcon className="h-4 w-4 text-red-500" />
                )}
                <span
                  className={
                    balanceDirection === 'increase'
                      ? 'text-green-600'
                      : balanceDirection === 'decrease'
                        ? 'text-red-600'
                        : ''
                  }
                >
                  {balanceDirection === 'increase' && '+'}
                  {balanceDiff !== 0n &&
                    formatWeiValue(balanceDiff.toString(), 18)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  copyToClipboard(address)
                }}
                className="h-6 w-6 p-0 flex-shrink-0 hover:bg-background/80"
              >
                <CopyIcon className="h-3 w-3" />
              </Button>
              <a
                href={getExplorerUrl(address)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="h-6 w-6 p-0 hover:bg-background/80 rounded flex items-center justify-center flex-shrink-0"
                title="View on explorer"
              >
                <ExternalLinkIcon className="h-3 w-3" />
              </a>
            </div>
          </div>
        </button>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Balance Changes */}
          {balanceChanged && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <TrendingUpIcon className="h-4 w-4" />
                Balance Change
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 rounded p-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Before
                  </label>
                  <div className="mt-1">
                    {preState.balance ? (
                      <DecHexToggle
                        value={preState.balance}
                        showLabel={false}
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">0</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {preState.balance && formatWeiValue(preState.balance, 18)}{' '}
                    HYPE
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    After
                  </label>
                  <div className="mt-1">
                    {postState.balance ? (
                      <DecHexToggle
                        value={postState.balance}
                        showLabel={false}
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">0</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {postState.balance && formatWeiValue(postState.balance, 18)}{' '}
                    HYPE
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Nonce Changes */}
          {nonceChanged && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <PlusIcon className="h-4 w-4" />
                Nonce Change
              </h4>
              <div className="grid grid-cols-2 gap-4 bg-muted/30 rounded p-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Before
                  </label>
                  <div className="text-sm font-mono mt-1">
                    {preState.nonce ?? 0}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    After
                  </label>
                  <div className="text-sm font-mono mt-1">
                    {postState.nonce ?? 0}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Code Changes */}
          {codeChanged && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <DatabaseIcon className="h-4 w-4" />
                Code Change
              </h4>
              <div className="space-y-3 bg-muted/30 rounded p-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Before
                  </label>
                  <div className="text-xs font-mono bg-background p-2 rounded mt-1 break-all">
                    {preState.code || '0x (no code)'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {preState.code
                      ? `${(preState.code.length - 2) / 2} bytes`
                      : 'Empty contract'}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    After
                  </label>
                  <div className="text-xs font-mono bg-background p-2 rounded mt-1 break-all">
                    {postState.code || '0x (no code)'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {postState.code
                      ? `${(postState.code.length - 2) / 2} bytes`
                      : 'Empty contract'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Storage Changes */}
          {storageChanged && (
            <StorageChangesView
              preStorage={preState.storage || {}}
              postStorage={postState.storage || {}}
            />
          )}
        </CardContent>
      )}
    </Card>
  )
}

interface StorageChangesViewProps {
  preStorage: Record<string, string>
  postStorage: Record<string, string>
}

function StorageChangesView({
  preStorage,
  postStorage,
}: StorageChangesViewProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Find all storage slots that changed
  const allSlots = new Set([
    ...Object.keys(preStorage),
    ...Object.keys(postStorage),
  ])
  const changedSlots = Array.from(allSlots).filter((slot) => {
    const preValue = preStorage[slot] || '0x0'
    const postValue = postStorage[slot] || '0x0'
    return preValue !== postValue
  })

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between mb-2 hover:bg-muted/30 -mx-1 px-1 py-1 rounded transition-colors"
      >
        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          {isExpanded ? (
            <ChevronDownIcon className="h-4 w-4" />
          ) : (
            <ChevronRightIcon className="h-4 w-4" />
          )}
          <DatabaseIcon className="h-4 w-4" />
          Storage Changes ({changedSlots.length})
        </h4>
        <Badge variant="secondary" className="text-xs">
          {isExpanded ? 'Collapse' : 'Expand'}
        </Badge>
      </button>

      {isExpanded && (
        <div className="space-y-3 bg-muted/30 rounded p-3">
          {changedSlots.map((slot, index) => {
            const preValue = preStorage[slot] || '0x0'
            const postValue = postStorage[slot] || '0x0'

            return (
              <div
                key={`${slot}-${index}`}
                className="border rounded p-3 bg-background"
              >
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Slot: <span className="font-mono">{slot}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Before
                    </label>
                    <div className="text-xs font-mono bg-muted p-2 rounded mt-1 break-all">
                      {preValue}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      After
                    </label>
                    <div className="text-xs font-mono bg-muted p-2 rounded mt-1 break-all">
                      {postValue}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Helper functions
function hasAccountChanges(
  preState: AccountState,
  postState: AccountState,
): boolean {
  // Handle null/undefined values properly for comparison
  const preBalance = preState.balance || null
  const postBalance = postState.balance || null
  const preNonce = preState.nonce ?? null
  const postNonce = postState.nonce ?? null
  const preCode = preState.code || null
  const postCode = postState.code || null

  return (
    preBalance !== postBalance ||
    preNonce !== postNonce ||
    preCode !== postCode ||
    hasStorageChanges(preState.storage || {}, postState.storage || {})
  )
}

function hasStorageChanges(
  preStorage: Record<string, string>,
  postStorage: Record<string, string>,
): boolean {
  const allSlots = new Set([
    ...Object.keys(preStorage),
    ...Object.keys(postStorage),
  ])

  for (const slot of allSlots) {
    const preValue = preStorage[slot] || '0x0'
    const postValue = postStorage[slot] || '0x0'
    if (preValue !== postValue) {
      return true
    }
  }

  return false
}
