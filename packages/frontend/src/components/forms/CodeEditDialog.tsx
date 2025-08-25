'use client'

import { Loader2Icon, SaveIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
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
} from '@/components/ui'
import { useContractStorage } from '@/hooks/useContractStorage'
import type { StoredContract } from '@/utils/contract-storage'
import { CodeEditor } from './CodeEditor'
import { CompilerPanel } from './CompilerPanel'

interface CodeEditDialogProps {
  isOpen: boolean
  onClose: () => void
  contract: StoredContract
  onSave: (updatedContract: StoredContract) => void
}

export function CodeEditDialog({
  isOpen,
  onClose,
  contract,
  onSave,
}: CodeEditDialogProps) {
  const { updateContract } = useContractStorage()

  // Form state
  const [contractName, setContractName] = useState(
    contract.contractData.name || '',
  )
  const [sourceCode, setSourceCode] = useState(
    contract.contractData.sourceCode || '',
  )
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

  if (!isOpen) return null

  const handleSourceCodeChange = (newCode: string) => {
    setSourceCode(newCode)
    if (newCode !== contract.contractData.sourceCode) {
      setIsModified(true)
    } else {
      setIsModified(false)
    }
    setError(null)
  }

  const handleContractNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContractName(e.target.value)
    if (e.target.value !== contract.contractData.name) {
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
        const updatedContract: StoredContract = {
          ...contract,
          contractData: updatedContractData,
          metadata: updatedMetadata,
          status: updatedStatus,
          timestamp: new Date(),
        }

        onSave(updatedContract)
        onClose()
        setIsModified(false)

        // Force update of contracts list
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('contractsUpdated', {
              detail: {
                action: 'updated',
                contractId: contract.id,
                hasNewAbi: !!compilationResult?.abi,
                hasNewBytecode: !!compilationResult?.bytecode,
              },
            }),
          )
        }, 100)
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
    setContractName(contract.contractData.name || '')
    setSourceCode(contract.contractData.sourceCode || '')
    setIsModified(false)
    setError(null)
    setCompilationResult(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <SaveIcon className="h-5 w-5" />
                Edit Contract Source Code
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Modify and recompile your smart contract source code
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isModified && (
                <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 rounded">
                  Modified
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDiscard}
                className="h-8 w-8 p-0"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Editor (2/3 width) */}
            <div className="lg:col-span-2 space-y-4">
              {/* Contract Info */}
              <div>
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
              </div>

              {/* Source Code Editor */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Solidity Source Code
                </label>
                <CodeEditor
                  value={sourceCode}
                  onChange={handleSourceCodeChange}
                  language="solidity"
                  height="500px"
                />
              </div>

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
              />

              {/* Action Buttons */}
              <div className="bg-card border rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-medium">Actions</h3>

                <div className="space-y-2">
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
                    {isModified ? 'Discard Changes' : 'Cancel'}
                  </Button>
                </div>

                {/* Status Info */}
                <div className="text-xs space-y-2 pt-2 border-t">
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

                  {contract.metadata.compiledAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Last Compiled:
                      </span>
                      <span>
                        {contract.metadata.compiledAt.toLocaleDateString()}
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
                </div>
              </div>

              {/* Compilation Status */}
              {compilationResult && (
                <div className="bg-card border rounded-lg p-4">
                  <h3 className="text-sm font-medium mb-2">
                    Compilation Status
                  </h3>
                  <div className="text-xs space-y-1">
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
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
