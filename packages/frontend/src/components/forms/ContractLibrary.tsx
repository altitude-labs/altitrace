'use client'

import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  EditIcon,
  ExternalLinkIcon,
  FileTextIcon,
  TagIcon,
  TrashIcon,
} from 'lucide-react'
import { useState } from 'react'
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
} from '@/components/ui'
import { useContractStorage } from '@/hooks/useContractStorage'
import type { StoredContract } from '@/utils/contract-storage'

interface ContractLibraryProps {
  onSelect?: (contract: StoredContract) => void
  onEdit?: (contract: StoredContract) => void
  onDelete?: (contractId: string) => void
  selectedContractId?: string
  mode?: 'selector' | 'manager'
  showActions?: boolean
}

export function ContractLibrary({
  onSelect,
  onEdit,
  onDelete,
  selectedContractId,
  mode = 'manager',
  showActions = true,
}: ContractLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    StoredContract['status'] | 'all'
  >('all')
  const [tagFilter, setTagFilter] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'status'>('date')
  const [expandedContracts, setExpandedContracts] = useState<Set<string>>(
    new Set(),
  )

  const {
    contracts,
    searchContracts,
    getContractsByStatus,
    getAllTags,
    deleteContract,
    exportContract,
    getStats,
    isLoading,
    error,
  } = useContractStorage()

  const stats = getStats()
  const allTags = getAllTags()

  // Filter and sort contracts
  const getFilteredContracts = () => {
    let filtered = contracts

    // Text search
    if (searchQuery.trim()) {
      filtered = searchContracts(searchQuery)
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((contract) => contract.status === statusFilter)
    }

    // Tag filter
    if (tagFilter) {
      filtered = filtered.filter((contract) =>
        contract.metadata.tags?.includes(tagFilter),
      )
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name': {
          const nameA = a.metadata.title || a.contractData.name || ''
          const nameB = b.metadata.title || b.contractData.name || ''
          return nameA.localeCompare(nameB)
        }
        case 'status':
          return a.status.localeCompare(b.status)
        default:
          return b.timestamp.getTime() - a.timestamp.getTime()
      }
    })

    return filtered
  }

  const filteredContracts = getFilteredContracts()

  const handleDelete = (contractId: string) => {
    const contract = contracts.find((c) => c.id === contractId)
    const contractName =
      contract?.metadata.title || contract?.contractData.name || 'this contract'

    if (window.confirm(`Delete "${contractName}"? This cannot be undone.`)) {
      const success = deleteContract(contractId)
      if (success) {
        onDelete?.(contractId)
      } else {
        alert('Failed to delete contract. Please try again.')
      }
    }
  }

  const handleExport = (contractId: string) => {
    const exportData = exportContract(contractId)
    if (exportData) {
      const blob = new Blob([exportData], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `contract-${contractId}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address)
  }

  const _toggleExpanded = (contractId: string) => {
    const newExpanded = new Set(expandedContracts)
    if (newExpanded.has(contractId)) {
      newExpanded.delete(contractId)
    } else {
      newExpanded.add(contractId)
    }
    setExpandedContracts(newExpanded)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Loading contracts...
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileTextIcon className="h-5 w-5" />
            Contract Library
            <span className="text-sm font-normal text-muted-foreground">
              ({stats.total} contracts)
            </span>
          </CardTitle>
          {mode === 'manager' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{stats.today} added today</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Filters and Search */}
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="Search contracts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 min-w-[200px]"
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'imported', label: 'Imported' },
                { value: 'modified', label: 'Modified' },
                { value: 'compiled', label: 'Compiled' },
                { value: 'error', label: 'Error' },
              ]}
              className="w-32"
            />
            {allTags.length > 0 && (
              <Select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                options={[
                  { value: '', label: 'All Tags' },
                  ...allTags.map((tag) => ({ value: tag, label: tag })),
                ]}
                className="w-32"
              />
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Sort by:</span>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              options={[
                { value: 'date', label: 'Date Added' },
                { value: 'name', label: 'Name' },
                { value: 'status', label: 'Status' },
              ]}
              className="w-32"
            />
          </div>
        </div>

        {/* Contracts List */}
        {filteredContracts.length === 0 ? (
          <div className="text-center py-8">
            <FileTextIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {searchQuery || statusFilter !== 'all' || tagFilter
                ? 'No contracts match your filters'
                : 'No contracts saved yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredContracts.map((contract) => {
              const isExpanded = expandedContracts.has(contract.id)
              const isSelected = selectedContractId === contract.id

              return (
                <div
                  key={contract.id}
                  className={`border rounded-lg transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  {/* Contract Header */}
                  <div
                    className={`p-3 ${mode === 'selector' ? 'cursor-pointer' : ''}`}
                    onClick={
                      mode === 'selector'
                        ? () => onSelect?.(contract)
                        : undefined
                    }
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm truncate">
                            {contract.metadata.title ||
                              contract.contractData.name ||
                              'Unnamed Contract'}
                          </h4>

                          {/* Status Badge */}
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              contract.status === 'imported'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                : contract.status === 'modified'
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                                  : contract.status === 'compiled'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                            }`}
                          >
                            {contract.status}
                          </span>

                          {contract.metadata.verified && (
                            <span className="text-xs text-green-600">✅</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          {contract.contractData.address && (
                            <>
                              <span className="font-mono">
                                {contract.contractData.address.slice(0, 6)}...
                                {contract.contractData.address.slice(-4)}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCopyAddress(
                                    contract.contractData.address!,
                                  )
                                }}
                                className="h-4 w-4 p-0 hover:bg-transparent"
                              >
                                <CopyIcon className="h-3 w-3" />
                              </Button>
                              <span>•</span>
                            </>
                          )}
                          <span>
                            {contract.contractData.abi.length} functions
                          </span>
                          <span>•</span>
                          <span>{contract.timestamp.toLocaleDateString()}</span>
                          {contract.metadata.explorerSource && (
                            <>
                              <span>•</span>
                              <span className="capitalize">
                                {contract.metadata.explorerSource}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Proxy Information */}
                        {(contract.metadata as any).isProxy && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 rounded">
                              🔗{' '}
                              {(
                                (contract.metadata as any).proxyType ||
                                'unknown'
                              ).toUpperCase()}{' '}
                              Proxy
                            </span>
                            {(contract.metadata as any)
                              .implementationAddress && (
                              <span className="text-xs text-muted-foreground font-mono">
                                →{' '}
                                {(
                                  contract.metadata as any
                                ).implementationAddress.slice(0, 6)}
                                ...
                                {(
                                  contract.metadata as any
                                ).implementationAddress.slice(-4)}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Tags */}
                        {contract.metadata.tags &&
                          contract.metadata.tags.length > 0 && (
                            <div className="flex gap-1 mt-2">
                              {contract.metadata.tags.map((tag, index) => (
                                <span
                                  key={index}
                                  className="text-xs px-2 py-0.5 bg-muted rounded flex items-center gap-1"
                                >
                                  <TagIcon className="h-2 w-2" />
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        {mode === 'selector' && isSelected && (
                          <CheckIcon className="h-4 w-4 text-primary" />
                        )}

                        {showActions && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleExport(contract.id)
                              }}
                            >
                              <DownloadIcon className="w-4 h-4" />
                            </Button>
                            {contract.contractData.sourceCode && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  window.location.href = `/contracts/edit/${contract.id}`
                                }}
                                title="Edit Source Code"
                              >
                                <EditIcon className="w-4 h-4" />
                              </Button>
                            )}
                            {contract.contractData.address && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  window.open(
                                    `https://www.hyperscan.com/address/${contract.contractData.address}`,
                                    '_blank',
                                  )
                                }}
                              >
                                <ExternalLinkIcon className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(contract.id)
                              }}
                              className="text-destructive hover:text-destructive"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t bg-muted/25 p-3 text-xs">
                      <div className="space-y-2">
                        {contract.metadata.description && (
                          <p className="text-muted-foreground">
                            {contract.metadata.description}
                          </p>
                        )}

                        {contract.metadata.compiler && (
                          <div>
                            <span className="font-medium">Compiler:</span>{' '}
                            {contract.metadata.compiler}
                          </div>
                        )}

                        {contract.contractData.sourceCode && (
                          <div>
                            <span className="font-medium">Source Code:</span>{' '}
                            Available
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <div>
                            <span className="font-medium">Functions:</span>{' '}
                            {contract.contractData.abi.length}
                          </div>
                          <div>
                            <span className="font-medium">Added:</span>{' '}
                            {contract.timestamp.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
