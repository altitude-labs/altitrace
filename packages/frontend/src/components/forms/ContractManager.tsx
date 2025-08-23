'use client'

import {
  BookOpenIcon,
  FileTextIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
} from '@/components/ui'
import { useContractStorage } from '@/hooks/useContractStorage'
import type { ContractFetchResult } from '@/services/contract-fetcher'
import type { AbiFunction, ParsedAbi } from '@/types/api'
import type { StoredContract } from '@/utils/contract-storage'
import { ContractAddressInput } from './ContractAddressInput'
import { ContractImportDialog } from './ContractImportDialog'
import { FunctionSelector } from './FunctionSelector'

interface ContractManagerProps {
  onContractSelect?: (contract: StoredContract) => void
  onAbiImport?: (abi: ParsedAbi, rawAbi: string) => void
  onFunctionSelect?: (
    func: AbiFunction,
    parameters: Record<string, string>,
    functionData?: {
      data: string
      functionName: string
      parameters: Record<string, string>
    },
  ) => void
  selectedContractId?: string
  currentAbi?: ParsedAbi | null
  mode?: 'full' | 'compact' | 'selector'
  showFunctionBuilder?: boolean
  prefilledAddress?: string
}

export function ContractManager({
  onContractSelect,
  onAbiImport,
  onFunctionSelect,
  selectedContractId,
  currentAbi,
  mode: _mode = 'full',
  showFunctionBuilder = true,
  prefilledAddress = '',
}: ContractManagerProps) {
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [contractAddress, setContractAddress] = useState(prefilledAddress)
  const [selectedContract, setSelectedContract] =
    useState<StoredContract | null>(null)
  const [contractSource, setContractSource] = useState<
    'address' | 'saved' | 'none'
  >('none')
  const [contractsCount, setContractsCount] = useState(0)
  const [currentRawAbi, setCurrentRawAbi] = useState<string>('')

  const { contracts, getContract, saveFromFetchResult } = useContractStorage()

  // Update contracts count when contracts change or on custom event
  useEffect(() => {
    setContractsCount(contracts.length)
  }, [contracts.length])

  const handleContractFetched = (fetchResult: ContractFetchResult) => {
    // Convert to ParsedAbi format for compatibility
    const parsedAbi: ParsedAbi = {
      functions: fetchResult.abi
        .filter((item: any) => item.type === 'function')
        .map((item: any) => ({
          name: item.name,
          type: item.type,
          inputs: item.inputs || [],
          outputs: item.outputs || [],
          stateMutability: item.stateMutability || 'nonpayable',
        })),
      events: fetchResult.abi.filter((item: any) => item.type === 'event'),
      errors: fetchResult.abi.filter((item: any) => item.type === 'error'),
    }

    const rawAbiJson = JSON.stringify(fetchResult.abi, null, 2)
    console.log(
      'Setting rawAbi in handleContractFetched:',
      rawAbiJson.length,
      'characters',
    )
    setCurrentRawAbi(rawAbiJson)
    onAbiImport?.(parsedAbi, rawAbiJson)
  }

  const handleContractImport = useCallback(
    (contract: StoredContract) => {
      console.log(
        '📦 [Contract Import] Importing contract to ContractManager:',
        {
          id: contract.id,
          name: contract.metadata?.title || contract.contractData?.name,
          address: contract.contractData?.address,
          abiLength: contract.contractData?.abi?.length || 0,
          hasBytecode: !!contract.contractData?.bytecode,
          compilationStatus: contract.metadata?.compilationStatus,
          lastCompiled: contract.metadata?.compiledAt,
        },
      )

      setSelectedContract(contract)
      setContractSource('saved')
      onContractSelect?.(contract)

      // Convert to ParsedAbi format
      const parsedAbi: ParsedAbi = {
        functions: contract.contractData.abi
          .filter((item: any) => item.type === 'function')
          .map((item: any) => ({
            name: item.name,
            type: item.type,
            inputs: item.inputs || [],
            outputs: item.outputs || [],
            stateMutability: item.stateMutability || 'nonpayable',
          })),
        events: contract.contractData.abi.filter(
          (item: any) => item.type === 'event',
        ),
        errors: contract.contractData.abi.filter(
          (item: any) => item.type === 'error',
        ),
      }

      const rawAbiJson = JSON.stringify(contract.contractData.abi, null, 2)
      console.log('📋 [ABI Import] Converting contract ABI for simulator:')
      console.log(
        '   Functions:',
        parsedAbi.functions?.map((f) => f.name) || [],
      )
      console.log('   Events:', parsedAbi.events?.length || 0)
      console.log('   Raw ABI size:', rawAbiJson.length, 'characters')

      setCurrentRawAbi(rawAbiJson)
      onAbiImport?.(parsedAbi, rawAbiJson)
      console.log(
        '✅ [ABI Import] ABI sent to simulator via onAbiImport callback',
      )
      setShowImportDialog(false)
    },
    [onContractSelect, onAbiImport],
  )

  // Listen for contract updates and refresh ABI if needed
  useEffect(() => {
    const handleContractsUpdated = (event: any) => {
      console.log(
        '📢 [ContractManager] Received contractsUpdated event:',
        event.detail,
      )

      // Force a re-render to update counts
      setContractsCount(contracts.length)

      // If a specific contract was updated and it's our currently selected contract
      if (
        event.detail?.contractId &&
        selectedContract?.id === event.detail.contractId
      ) {
        console.log(
          '🔄 [ABI Refresh] Currently selected contract was updated, refreshing ABI...',
        )

        // Get the updated contract from storage
        const updatedContract = getContract(event.detail.contractId)
        if (updatedContract && event.detail.hasNewAbi) {
          console.log(
            '📋 [ABI Auto-Update] Re-importing updated ABI for selected contract',
          )
          handleContractImport(updatedContract)
        }
      }
    }

    window.addEventListener('contractsUpdated', handleContractsUpdated)
    return () => {
      window.removeEventListener('contractsUpdated', handleContractsUpdated)
    }
  }, [
    contracts.length,
    selectedContract?.id,
    getContract,
    handleContractImport,
  ])

  const handleContractConfirm = (
    fetchResult: ContractFetchResult,
    contractId?: string,
  ) => {
    // If we have a saved contract, use it
    if (contractId) {
      const contract = getContract(contractId)
      if (contract) {
        handleContractImport(contract)
        return
      }
    }

    // For newly fetched contracts, save them properly first
    setContractSource('address')

    try {
      // Actually save the contract to storage
      const savedContractId = saveFromFetchResult(fetchResult)
      const savedContract = getContract(savedContractId)

      if (savedContract) {
        // Use the properly saved contract
        handleContractImport(savedContract)
        // Update the contracts count
        setContractsCount(contracts.length + 1)
        // Dispatch event to update other components
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('contractsUpdated'))
        }, 100)
      }
    } catch (_error) {
      // Fallback to original behavior if saving fails
      handleContractFetched(fetchResult)
    }
  }

  const handleSavedContractSelect = (contractId: string) => {
    const contract = getContract(contractId)
    if (contract) {
      handleContractImport(contract)
    }
  }

  const getContractOptions = () => {
    return contracts.map((contract) => ({
      value: contract.id,
      label:
        contract.metadata.title ||
        contract.contractData.name ||
        `Contract ${contract.id.slice(0, 8)}...`,
    }))
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BookOpenIcon className="h-5 w-5" />
              Contract & ABI Management
              {currentAbi && (
                <span className="text-sm font-normal text-green-600">
                  ({currentAbi.functions.length} functions loaded)
                </span>
              )}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportDialog(true)}
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Import
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Selected Contract Display */}
          {selectedContract && (
            <div className="bg-muted/50 border rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold flex items-center gap-2">
                    ✅ Contract Selected
                    {selectedContract.metadata.verified && (
                      <span className="text-xs px-2 py-0.5 bg-muted rounded">
                        Verified
                      </span>
                    )}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedContract.metadata.title ||
                      selectedContract.contractData.name}
                  </p>
                  <div className="text-xs text-muted-foreground mt-2 space-y-1">
                    {selectedContract.contractData.address && (
                      <div className="font-mono">
                        {selectedContract.contractData.address.slice(0, 8)}...
                        {selectedContract.contractData.address.slice(-6)}
                      </div>
                    )}
                    <div>
                      {currentAbi?.functions.length || 0} functions loaded •
                      Ready for simulation
                    </div>
                    {selectedContract.metadata.isProxy && (
                      <div>
                        🔗 {selectedContract.metadata.proxyType} Proxy Contract
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedContract(null)
                    setContractSource('none')
                    onAbiImport?.(null as any, '')
                  }}
                >
                  Change
                </Button>
              </div>
            </div>
          )}

          {/* Contract Source Selection */}
          {!selectedContract && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={contractSource === 'address' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setContractSource('address')}
                >
                  <SearchIcon className="h-4 w-4 mr-1" />
                  From Address
                </Button>
                <Button
                  variant={contractSource === 'saved' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setContractSource('saved')}
                  disabled={contracts.length === 0}
                >
                  <FileTextIcon className="h-4 w-4 mr-1" />
                  Saved ({contractsCount})
                </Button>
              </div>

              {/* Address Input Mode */}
              {contractSource === 'address' && (
                <div>
                  <label
                    htmlFor="contract-address"
                    className="text-sm font-medium mb-2 block"
                  >
                    Contract Address
                  </label>
                  <ContractAddressInput
                    value={contractAddress}
                    onChange={setContractAddress}
                    onContractFetched={handleContractFetched}
                    onConfirmContract={handleContractConfirm}
                    autoFetch={true}
                    placeholder="Enter contract address to auto-fetch ABI"
                    showFetchButton={true}
                    showConfirmButton={true}
                  />
                </div>
              )}

              {/* Saved Contract Selection Mode */}
              {contractSource === 'saved' && contracts.length > 0 && (
                <div>
                  <label
                    htmlFor="contract-select"
                    className="text-sm font-medium mb-2 block"
                  >
                    Select Saved Contract
                  </label>
                  <Select
                    options={getContractOptions()}
                    value={selectedContractId || ''}
                    onChange={(e) => handleSavedContractSelect(e.target.value)}
                    placeholder="Choose a saved contract..."
                  />
                </div>
              )}

              {/* No contracts message */}
              {contractSource === 'saved' && contracts.length === 0 && (
                <div className="text-center py-6 border-2 border-dashed border-muted rounded-lg">
                  <FileTextIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    No contracts saved yet
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowImportDialog(true)}
                  >
                    Import Your First Contract
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Function Builder */}
          {showFunctionBuilder &&
            currentAbi &&
            currentAbi.functions.length > 0 && (
              <div className="border-t pt-6">
                <FunctionSelector
                  abi={currentAbi}
                  rawAbi={currentRawAbi}
                  onFunctionDataGenerated={(data, functionName, parameters) => {
                    console.log('onFunctionDataGenerated called:', {
                      data,
                      functionName,
                      parameters,
                    })
                    onFunctionSelect?.(
                      currentAbi.functions.find(
                        (f) => f.name === functionName,
                      )!,
                      parameters,
                      { data, functionName, parameters },
                    )
                  }}
                />
              </div>
            )}

          {/* Current ABI Summary - only show when no contract selected */}
          {(!selectedContract || !selectedContract.contractData) &&
            currentAbi &&
            currentAbi.functions.length > 0 && (
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm">
                    Current Contract ABI
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowImportDialog(true)}
                    title="Manage contracts"
                  >
                    <SettingsIcon className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  <span>{currentAbi.functions.length} functions</span>
                  {selectedContract?.contractData && (
                    <>
                      <span> • </span>
                      <span className="font-mono">
                        {selectedContract.contractData.address?.slice(0, 6)}...
                        {selectedContract.contractData.address?.slice(-4)}
                      </span>
                      {selectedContract.metadata?.verified && (
                        <>
                          <span> • </span>
                          <span>✅ Verified</span>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
        </CardContent>
      </Card>

      {/* Import Dialog */}
      {showImportDialog && (
        <ContractImportDialog
          isOpen={showImportDialog}
          onClose={() => setShowImportDialog(false)}
          onImport={handleContractImport}
          prefilledAddress={contractAddress}
        />
      )}
    </>
  )
}
