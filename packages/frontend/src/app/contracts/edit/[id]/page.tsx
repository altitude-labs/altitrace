'use client'

import { ArrowLeftIcon, Loader2Icon, SaveIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { use, useEffect, useState } from 'react'
import type { Abi } from 'viem'
import { CodeEditor } from '@/components/forms/CodeEditor'
import { CompilerPanel } from '@/components/forms/CompilerPanel'
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from '@/components/ui'
import { useContractStorage } from '@/hooks/useContractStorage'
import type { StoredContract } from '@/utils/contract-storage'
import { safeFormatDate } from '@/utils/date-helpers'

export default function ContractEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { getContract, updateContract } = useContractStorage()
  const resolvedParams = use(params)

  // Contract state
  const [contract, setContract] = useState<StoredContract | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Form state
  const [contractName, setContractName] = useState('')
  const [sourceCode, setSourceCode] = useState('')
  const [isModified, setIsModified] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Compilation state
  const [compilationResult, setCompilationResult] = useState<{
    success: boolean
    abi?: Abi
    bytecode?: string
    errors?: string[]
    warnings?: string[]
    abiMatches?: boolean
  } | null>(null)

  // Load contract on mount
  useEffect(() => {
    const loadContract = () => {
      const foundContract = getContract(resolvedParams.id)
      if (foundContract) {
        setContract(foundContract)
        setContractName(foundContract.contractData.name || '')
        setSourceCode(foundContract.contractData.sourceCode || '')
        setLoading(false)
      } else {
        setNotFound(true)
        setLoading(false)
      }
    }

    loadContract()
  }, [resolvedParams.id, getContract])

  const handleSourceCodeChange = (newCode: string) => {
    setSourceCode(newCode)
    if (contract && newCode !== contract.contractData.sourceCode) {
      setIsModified(true)
    } else {
      setIsModified(false)
    }
    setError(null)
  }

  const handleContractNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContractName(e.target.value)
    if (contract && e.target.value !== contract.contractData.name) {
      setIsModified(true)
    }
    setError(null)
  }

  const handleCompilationResult = (result: any) => {
    setCompilationResult(result)
    if (result.errors && result.errors.length > 0) {
      setError(result.errors[0])
    } else {
      setError(null)
    }
  }

  const handleSave = async () => {
    if (!contract) return

    if (!contractName.trim()) {
      setError('Contract name is required')
      return
    }

    if (!sourceCode.trim()) {
      setError('Source code is required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      // Prepare the updated contract data
      const updatedContractData = {
        ...contract.contractData,
        name: contractName,
        sourceCode,
      }

      const updatedMetadata = {
        ...contract.metadata,
        title: contractName,
      }

      let updatedStatus = contract.status

      // If we have a successful compilation, use the compiled ABI and update status
      if (compilationResult?.success && compilationResult.abi) {
        updatedContractData.abi = compilationResult.abi
        updatedContractData.bytecode = compilationResult.bytecode
        updatedMetadata.compilationStatus = 'compiled'
        updatedMetadata.compiledAt = new Date()
        updatedMetadata.sourceCodeVerified =
          compilationResult.abiMatches || false
        updatedStatus = 'compiled'
      } else if (isModified) {
        // If modified but not compiled, mark as modified
        updatedMetadata.compilationStatus = 'modified'
        updatedStatus = 'modified'
      }

      // Update the contract
      const success = updateContract(contract.id, {
        contractData: updatedContractData,
        metadata: updatedMetadata,
        status: updatedStatus,
      })

      if (success) {
        // Update local state
        const updatedContract: StoredContract = {
          ...contract,
          contractData: updatedContractData,
          metadata: updatedMetadata,
          status: updatedStatus,
          timestamp: new Date(),
        }

        setContract(updatedContract)
        setIsModified(false)

        // Navigate back to contracts page
        router.push('/contracts')
      } else {
        setError('Failed to save contract')
      }
    } catch (_err) {
      setError('Failed to save contract')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDiscard = () => {
    if (contract) {
      setContractName(contract.contractData.name || '')
      setSourceCode(contract.contractData.sourceCode || '')
      setIsModified(false)
      setError(null)
      setCompilationResult(null)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold">Loading Contract</h3>
            <p className="text-muted-foreground">Please wait...</p>
          </div>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📄</div>
            <h3 className="text-xl font-semibold mb-2">Contract Not Found</h3>
            <p className="text-muted-foreground mb-4">
              The contract you're looking for doesn't exist or may have been
              deleted.
            </p>
            <Button onClick={() => router.push('/contracts')}>
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to Contracts
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!contract?.contractData.sourceCode) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-semibold mb-2">No Source Code</h3>
            <p className="text-muted-foreground mb-4">
              This contract doesn't have source code available for editing.
            </p>
            <Button onClick={() => router.push('/contracts')}>
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to Contracts
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/contracts')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-1" />
              Back to Contracts
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <SaveIcon className="h-8 w-8" />
                Edit Contract Source Code
              </h1>
              <p className="text-muted-foreground mt-1">
                Modify and recompile your smart contract source code
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isModified && (
                <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 rounded">
                  Modified
                </span>
              )}
              <span
                className={`text-xs px-2 py-1 rounded ${
                  contract.status === 'compiled'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    : contract.status === 'modified'
                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                      : contract.status === 'imported'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                }`}
              >
                {contract.status}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Editor (2/3 width) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Contract Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contract Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Input
                    label="Contract Name"
                    placeholder="e.g., MyToken, MyContract"
                    value={contractName}
                    onChange={handleContractNameChange}
                    error={
                      !contractName.trim() && error
                        ? 'Contract name is required'
                        : undefined
                    }
                  />

                  {contract.contractData.address && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Contract Address
                      </label>
                      <div className="text-sm font-mono bg-muted/30 p-2 rounded border">
                        {contract.contractData.address}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground">Functions:</span>{' '}
                      {
                        contract.contractData.abi.filter(
                          (item: any) => item.type === 'function',
                        ).length
                      }
                    </div>
                    <div>
                      <span className="text-muted-foreground">Language:</span>{' '}
                      {contract.contractData.language || 'Solidity'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Source Code Editor */}
            <Card className="flex-1">
              <CardHeader>
                <CardTitle className="text-lg">Source Code</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <CodeEditor
                  value={sourceCode}
                  onChange={handleSourceCodeChange}
                  language="solidity"
                  height="600px"
                />
              </CardContent>
            </Card>

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Right Column - Compiler & Actions (1/3 width) */}
          <div className="space-y-4">
            {/* Compiler Panel */}
            <CompilerPanel
              sourceCode={sourceCode}
              originalAbi={contract.contractData.abi}
              onCompilationResult={handleCompilationResult}
              compilerVersion={contract.metadata.compiler}
              optimization={contract.metadata.compilerSettings?.optimization}
              filePath={contract.contractData.filePath}
              additionalSources={contract.contractData.additionalSources}
              autoCompile={false}
            />

            {/* Action Buttons */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={handleSave}
                  disabled={
                    isSaving || !contractName.trim() || !sourceCode.trim()
                  }
                  loading={isSaving}
                  className={`w-full ${
                    compilationResult?.success
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : isModified
                        ? 'bg-orange-600 hover:bg-orange-700 text-white'
                        : ''
                  }`}
                >
                  {isSaving ? (
                    <>
                      <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : compilationResult?.success ? (
                    'Save Compiled Version'
                  ) : isModified ? (
                    'Save Changes'
                  ) : (
                    'Save Contract'
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleDiscard}
                  disabled={isSaving}
                  className="w-full"
                >
                  {isModified ? 'Discard Changes' : 'Reset'}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => router.push('/contracts')}
                  disabled={isSaving}
                  className="w-full"
                >
                  <ArrowLeftIcon className="w-4 h-4 mr-2" />
                  Back to Contracts
                </Button>
              </CardContent>
            </Card>

            {/* Status Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contract Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Current Status:
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        contract.status === 'compiled'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : contract.status === 'modified'
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                            : contract.status === 'imported'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                      }`}
                    >
                      {contract.status}
                    </span>
                  </div>

                  {contract.metadata?.compiledAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Last Compiled:
                      </span>
                      <span>
                        {safeFormatDate(contract.metadata.compiledAt)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Functions:</span>
                    <span>
                      {
                        contract.contractData.abi.filter(
                          (item: any) => item.type === 'function',
                        ).length
                      }
                    </span>
                  </div>

                  {contract.metadata.explorerSource && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Source:</span>
                      <span className="capitalize">
                        {contract.metadata.explorerSource}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Compilation Status */}
            {compilationResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Compilation Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm space-y-2">
                    <div
                      className={`flex items-center gap-2 ${
                        compilationResult.success
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          compilationResult.success
                            ? 'bg-green-400'
                            : 'bg-red-400'
                        }`}
                      />
                      {compilationResult.success
                        ? 'Compilation successful'
                        : 'Compilation failed'}
                    </div>

                    {compilationResult.success && compilationResult.abi && (
                      <>
                        <div className="text-muted-foreground">
                          New ABI:{' '}
                          {
                            compilationResult.abi.filter(
                              (item: any) => item.type === 'function',
                            ).length
                          }{' '}
                          functions
                        </div>
                        {contract.contractData.abi.length > 0 && (
                          <div
                            className={`${
                              compilationResult.abiMatches
                                ? 'text-green-600'
                                : 'text-orange-600'
                            }`}
                          >
                            {compilationResult.abiMatches
                              ? '✓ ABI matches original'
                              : '⚠ ABI differs from original'}
                          </div>
                        )}
                      </>
                    )}

                    {compilationResult.warnings &&
                      compilationResult.warnings.length > 0 && (
                        <div className="text-orange-600">
                          {compilationResult.warnings.length} warnings
                        </div>
                      )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
