'use client'

import {
  CheckIcon,
  FileTextIcon,
  Loader2Icon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Abi } from 'viem'
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@/components/ui'
import { useContractStorage } from '@/hooks/useContractStorage'
import type { ContractFetchResult } from '@/services/contract-fetcher'
import { AbiError, parseAbiJson } from '@/utils/abi'
import type { StoredContract } from '@/utils/contract-storage'
import { ContractAddressInput } from './ContractAddressInput'

interface ContractImportDialogProps {
  isOpen: boolean
  onClose: () => void
  onImport: (contract: StoredContract) => void
  defaultTab?: 'address' | 'abi' | 'saved'
  prefilledAddress?: string
}

export function ContractImportDialog({
  isOpen,
  onClose,
  onImport,
  defaultTab = 'address',
  prefilledAddress = '',
}: ContractImportDialogProps) {
  const [activeTab, setActiveTab] = useState<'address' | 'abi' | 'saved'>(
    defaultTab,
  )
  const [contractAddress, setContractAddress] = useState(prefilledAddress)
  const [fetchedContract, setFetchedContract] =
    useState<ContractFetchResult | null>(null)
  const [savedContractId, setSavedContractId] = useState<string>('')

  // Manual ABI import state
  const [abiJson, setAbiJson] = useState('')
  const [contractName, setContractName] = useState('')
  const [manualAddress, setManualAddress] = useState('')
  const [abiError, setAbiError] = useState<string | null>(null)
  const [abiLoading, setAbiLoading] = useState(false)

  const {
    contracts,
    saveContract,
    getContract,
    searchContracts,
    isLoading: storageLoading,
  } = useContractStorage()

  // Search state for saved contracts
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSavedContract, setSelectedSavedContract] =
    useState<StoredContract | null>(null)

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleContractFetched = (contract: ContractFetchResult) => {
    setFetchedContract(contract)
    setSavedContractId('')
  }

  const handleContractSaved = (contractId: string) => {
    setSavedContractId(contractId)
  }

  const handleImportFetchedContract = () => {
    if (fetchedContract && savedContractId) {
      const contract = getContract(savedContractId)
      if (contract) {
        onImport(contract)
        onClose()
        // Force update of saved contracts count in parent
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('contractsUpdated'))
        }, 100)
      }
    }
  }

  const handleImportManualAbi = async () => {
    if (!abiJson.trim()) {
      setAbiError('Please paste ABI JSON')
      return
    }

    if (!contractName.trim()) {
      setAbiError('Please enter contract name')
      return
    }

    setAbiLoading(true)
    setAbiError(null)

    try {
      const parsedAbi = parseAbiJson(abiJson)

      if (parsedAbi.functions.length === 0) {
        setAbiError('No functions found in ABI')
        return
      }

      // Save the contract
      const contractId = saveContract(
        {
          abi: JSON.parse(abiJson) as Abi,
          name: contractName,
          ...(manualAddress && { address: manualAddress as any }),
        },
        {
          title: contractName,
          explorerSource: 'manual',
          verified: false,
        },
        'imported',
      )

      const contract = getContract(contractId)
      if (contract) {
        onImport(contract)
        onClose()
        // Force update of saved contracts count in parent
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('contractsUpdated'))
        }, 100)
      }
    } catch (err) {
      if (err instanceof AbiError) {
        setAbiError(err.message)
      } else {
        setAbiError('Failed to parse ABI')
      }
    } finally {
      setAbiLoading(false)
    }
  }

  const handleImportSavedContract = () => {
    if (selectedSavedContract) {
      onImport(selectedSavedContract)
      onClose()
      // Force update of saved contracts count in parent
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('contractsUpdated'))
      }, 100)
    }
  }

  const filteredContracts = searchQuery.trim()
    ? searchContracts(searchQuery)
    : contracts

  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        // Close when clicking on the backdrop
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <Card className="w-full max-w-4xl lg:max-w-4xl md:max-w-2xl sm:max-w-lg max-h-[95vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <PlusIcon className="h-5 w-5" />
              Import Contract
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-10 w-10 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <XIcon className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-0 mb-4 sm:mb-6 h-auto sm:h-10">
              <TabsTrigger value="address" className="flex-1 py-2 px-3 text-sm">
                <SearchIcon className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">From </span>Address
              </TabsTrigger>
              <TabsTrigger value="abi" className="flex-1 py-2 px-3 text-sm">
                <FileTextIcon className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Paste </span>ABI
              </TabsTrigger>
              <TabsTrigger value="saved" className="flex-1 py-2 px-3 text-sm">
                <CheckIcon className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Saved </span>(
                {contracts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="address" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Contract Address
                  </label>
                  <ContractAddressInput
                    value={contractAddress}
                    onChange={setContractAddress}
                    onContractFetched={handleContractFetched}
                    onContractSaved={handleContractSaved}
                    autoFetch={true}
                    placeholder="0x"
                    showFetchButton={true}
                  />
                </div>

                {fetchedContract && savedContractId && (
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="font-medium text-green-800 dark:text-green-200">
                          ✅ Contract Ready to Import
                        </h4>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                          "{fetchedContract.name}" with{' '}
                          {fetchedContract.abi.length} functions has been
                          fetched and saved.
                        </p>
                        <div className="text-xs text-green-600 dark:text-green-400 mt-2">
                          Click "Import & Use Contract" to proceed with function
                          selection
                        </div>
                      </div>
                      <Button
                        onClick={handleImportFetchedContract}
                        className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
                        size="lg"
                      >
                        Import & Use Contract
                      </Button>
                    </div>
                  </div>
                )}

                {!fetchedContract && contractAddress && (
                  <div className="text-sm text-muted-foreground p-4 border rounded-lg">
                    💡 Enter a contract address above to automatically fetch its
                    ABI from HyperScan or Etherscan.
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="abi" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Input
                    label="Contract Name"
                    placeholder="e.g., ERC20Token, UniswapV2Pair"
                    value={contractName}
                    onChange={(e) => setContractName(e.target.value)}
                    error={
                      !contractName.trim() && abiError
                        ? 'Contract name is required'
                        : undefined
                    }
                  />
                </div>

                <div>
                  <Input
                    label="Contract Address (Optional)"
                    placeholder="0x..."
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                    description="Optional: Associate this ABI with a specific address"
                  />
                </div>

                <div>
                  <Textarea
                    value={abiJson}
                    onChange={(e) => setAbiJson(e.target.value)}
                    placeholder="Paste your contract ABI JSON here..."
                    rows={12}
                    className="font-mono text-sm"
                    label="Contract ABI JSON"
                    description="Paste the ABI JSON array from your contract compilation or block explorer"
                  />
                </div>

                {abiError && (
                  <Alert variant="destructive">
                    <AlertDescription>{abiError}</AlertDescription>
                  </Alert>
                )}

                {abiJson.trim() && contractName.trim() && !abiError && (
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="font-medium text-green-800 dark:text-green-200">
                          ✅ ABI Ready to Import
                        </h4>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                          "{contractName}" is ready to be imported with parsed
                          ABI.
                        </p>
                        <div className="text-xs text-green-600 dark:text-green-400 mt-2">
                          Click "Import & Use ABI" to proceed with function
                          selection
                        </div>
                      </div>
                      <Button
                        onClick={handleImportManualAbi}
                        loading={abiLoading}
                        disabled={!abiJson.trim() || !contractName.trim()}
                        className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
                        size="lg"
                      >
                        {abiLoading ? (
                          <>
                            <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          'Import & Use ABI'
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={handleImportManualAbi}
                    loading={abiLoading}
                    disabled={!abiJson.trim() || !contractName.trim()}
                    className={`flex-1 sm:flex-initial ${
                      abiJson.trim() && contractName.trim()
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : ''
                    }`}
                  >
                    {abiLoading ? (
                      <>
                        <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      'Import & Use ABI'
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => {
                      setAbiJson('')
                      setContractName('')
                      setManualAddress('')
                      setAbiError(null)
                    }}
                    disabled={abiLoading}
                    className="flex-1 sm:flex-initial"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="saved" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Input
                    placeholder="Search contracts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="mb-4"
                  />
                </div>

                {storageLoading ? (
                  <div className="text-center py-8">
                    <Loader2Icon className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Loading contracts...
                    </p>
                  </div>
                ) : filteredContracts.length === 0 ? (
                  <div className="text-center py-8">
                    <FileTextIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {searchQuery.trim()
                        ? 'No contracts match your search'
                        : 'No contracts saved yet'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredContracts.map((contract) => (
                      <div
                        key={contract.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedSavedContract?.id === contract.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedSavedContract(contract)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm">
                              {contract.metadata.title ||
                                contract.contractData.name ||
                                'Unnamed Contract'}
                            </h4>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              {contract.contractData.address && (
                                <span className="font-mono">
                                  {contract.contractData.address.slice(0, 6)}...
                                  {contract.contractData.address.slice(-4)}
                                </span>
                              )}
                              <span>•</span>
                              <span>
                                {contract.contractData.abi.length} functions
                              </span>
                              {contract.metadata.verified && (
                                <>
                                  <span>•</span>
                                  <span className="text-green-600">
                                    ✅ Verified
                                  </span>
                                </>
                              )}
                            </div>
                            {contract.metadata.tags &&
                              contract.metadata.tags.length > 0 && (
                                <div className="flex gap-1 mt-2">
                                  {contract.metadata.tags.map((tag, index) => (
                                    <span
                                      key={index}
                                      className="text-xs px-2 py-0.5 bg-muted rounded"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                          </div>
                          {selectedSavedContract?.id === contract.id && (
                            <CheckIcon className="h-4 w-4 text-primary flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedSavedContract && (
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="font-medium text-blue-800 dark:text-blue-200">
                          ✅ Contract Selected
                        </h4>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                          "
                          {selectedSavedContract.metadata.title ||
                            selectedSavedContract.contractData.name}
                          " - {selectedSavedContract.contractData.abi.length}{' '}
                          functions •{' '}
                          {selectedSavedContract.metadata.verified
                            ? 'Verified'
                            : 'Unverified'}
                        </p>
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                          Click "Import & Use Contract" to proceed with function
                          selection
                        </div>
                      </div>
                      <Button
                        onClick={handleImportSavedContract}
                        className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
                        size="lg"
                      >
                        Import & Use Contract
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
