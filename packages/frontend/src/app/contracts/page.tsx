'use client'

import { PlusIcon, SearchIcon, TagIcon } from 'lucide-react'
import { useState } from 'react'
import { ContractImportDialog } from '@/components/forms/ContractImportDialog'
import { ContractLibrary } from '@/components/forms/ContractLibrary'
import { Button, Card, CardContent, Input } from '@/components/ui'
import { useContractStorage } from '@/hooks/useContractStorage'
import type { StoredContract } from '@/utils/contract-storage'

export default function ContractsPage() {
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [_showEditDialog, setShowEditDialog] = useState(false)
  const [_editingContract, setEditingContract] =
    useState<StoredContract | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')

  const { contracts, searchContracts, getAllTags, getStats, isLoading } =
    useContractStorage()

  const stats = getStats()
  const allTags = getAllTags()

  const _filteredContracts = searchQuery.trim()
    ? searchContracts(searchQuery)
    : contracts

  const handleContractImport = (_contract: StoredContract) => {
    setShowImportDialog(false)
    // Optional: Show success notification
  }

  const handleDeleteContract = (_contractId: string) => {
    // The ContractLibrary component handles the confirmation
    // Just refresh the stats after deletion
    const _stats = getStats()
    // Stats will be automatically updated by the ContractLibrary component
  }

  const handleEditContract = (contract: StoredContract) => {
    if (contract.contractData.sourceCode) {
      setEditingContract(contract)
      setShowEditDialog(true)
    }
  }

  const _handleEditSave = (_updatedContract: StoredContract) => {
    setEditingContract(null)
    setShowEditDialog(false)
    // The ContractLibrary will automatically refresh from storage
  }

  const handleExportAll = () => {
    // Export all contracts as JSON
    const exportData = {
      contracts: contracts.map((contract) => ({
        ...contract,
        timestamp: contract.timestamp.toISOString(),
      })),
      exportedAt: new Date().toISOString(),
      version: '1.0',
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `altitrace-contracts-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b bg-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold">Contract Library</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Manage your smart contract ABIs and implementations
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handleExportAll}
              disabled={contracts.length === 0}
              className="text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">Export All</span>
              <span className="sm:hidden">Export</span>
            </Button>
            <Button onClick={() => setShowImportDialog(true)} className="text-xs sm:text-sm">
              <PlusIcon className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Import Contract</span>
              <span className="sm:hidden">Import</span>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="text-lg sm:text-xl font-bold">{stats.total}</div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                Total Contracts
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="text-lg sm:text-xl font-bold text-green-600">
                {stats.byStatus.imported}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">Imported</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="text-lg sm:text-xl font-bold text-blue-600">
                {Object.values(stats.bySource).reduce(
                  (acc, count) => acc + (count || 0),
                  0,
                )}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                From Explorers
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="text-lg sm:text-xl font-bold text-purple-600">
                {allTags.length}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">Tags</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="p-4 sm:p-6 border-b bg-muted/30">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
          <div className="flex-1">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contracts by name, address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {allTags.length > 0 && (
              <div className="flex items-center gap-2">
                <TagIcon className="h-4 w-4 text-muted-foreground" />
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="px-3 py-2 border rounded-lg bg-background text-sm"
                >
                  <option value="">All Tags</option>
                  {allTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-1 border rounded-lg p-1">
              <Button
                variant={viewMode === 'list' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="text-xs"
              >
                List
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="text-xs"
              >
                Grid
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Contract List */}
      <div className="flex-1 p-4 sm:p-6 overflow-auto">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading contracts...</p>
          </div>
        ) : contracts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <PlusIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No contracts yet</h3>
            <p className="text-muted-foreground mb-4">
              Import your first smart contract to get started with simulations
            </p>
            <Button onClick={() => setShowImportDialog(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Import Contract
            </Button>
          </div>
        ) : (
          <ContractLibrary
            onEdit={handleEditContract}
            onDelete={handleDeleteContract}
            mode="manager"
            showActions={true}
          />
        )}
      </div>

      {/* Import Dialog */}
      {showImportDialog && (
        <ContractImportDialog
          isOpen={showImportDialog}
          onClose={() => setShowImportDialog(false)}
          onImport={handleContractImport}
        />
      )}
    </div>
  )
}
