'use client'

import type {
  HexString as Hex,
  SimulationRequest as SdkSimulationRequest,
} from '@altitrace/sdk/types'
import { ArrowLeftIcon } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { ContractManager } from '@/components/forms/ContractManager'
import { TransactionForm } from '@/components/forms/TransactionForm'
// Removed unused imports
import { Alert, AlertDescription, Button } from '@/components/ui'
import type { ParsedAbi } from '@/types/api'
import {
  createContractStateOverride,
  createContractStateOverrideForSimulation,
  requiresStateOverride,
} from '@/utils/contract-state-override'
import type { StoredContract } from '@/utils/contract-storage'
import { getRequest, store } from '@/utils/storage'

const generateSimulationId = () => crypto.randomUUID()

function NewSimulationPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // ABI State
  const [abi, setAbi] = useState<ParsedAbi | null>(null)
  const [isPreFilled, setIsPreFilled] = useState(false)
  const [selectedContractId, setSelectedContractId] = useState<string | null>(
    null,
  )
  const [selectedContract, setSelectedContract] =
    useState<StoredContract | null>(null)

  // Contract storage hook - unused for now
  // const {} = useContractStorage()

  // Function Data State
  const [functionData, setFunctionData] = useState<{
    data: Hex
    functionName: string
    parameters: Record<string, string>
  } | null>(null)

  // Form state for pre-filling
  const [formData, setFormData] = useState<{
    to: string
    from: string
    data: string
    value: string
    gas: string
    blockTag: 'latest' | 'earliest' | 'safe' | 'finalized'
    blockNumber: string
    validation: boolean
  }>({
    to: '',
    from: '',
    data: '',
    value: '0x0',
    gas: '',
    blockTag: 'latest',
    blockNumber: '',
    validation: true,
  })

  // Simulation State
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load pre-fill data from URL params (re-run functionality)
  useEffect(() => {
    const rerunId = searchParams.get('rerun')
    if (rerunId && !isPreFilled) {
      const storedRequest = getRequest(rerunId)
      if (storedRequest) {
        // Pre-fill form with stored request data
        console.log('Pre-filling form with:', storedRequest)

        // Extract data from stored request
        const call = storedRequest.params.calls[0]
        if (call) {
          // Set basic transaction data
          setFormData((prev) => ({
            ...prev,
            to: call.to || '',
            from: call.from || '',
            data: call.data || '',
            value: call.value || '0x0',
            gas: call.gas || '',
          }))

          // Set simulation options
          setFormData((prev) => ({
            ...prev,
            validation: storedRequest.params.validation ?? true,
            blockTag:
              (storedRequest.params.blockTag as
                | 'latest'
                | 'earliest'
                | 'safe'
                | 'finalized') || 'latest',
            blockNumber: storedRequest.params.blockNumber || '',
          }))

          // TODO: Pre-fill ABI and function data if available
          // This would require storing additional metadata about the original function call
        }

        setIsPreFilled(true)
      }
    }
  }, [searchParams, isPreFilled])

  const handleAbiImport = (parsedAbi: ParsedAbi, rawAbiJson: string) => {
    console.log('📝 [ABI Import] New ABI imported:', {
      functionsCount: parsedAbi.functions?.length || 0,
      eventsCount: parsedAbi.events?.length || 0,
      firstFunctionName: parsedAbi.functions?.[0]?.name || 'none',
      rawAbiSize: rawAbiJson.length,
    })
    setAbi(parsedAbi)
    setFunctionData(null) // Clear previous function data
    console.log('🔄 [ABI State Updated] New ABI set in simulator state')
    console.log('🔄 [Function Data] Cleared due to ABI change')

    // Log current vs new ABI differences for debugging
    console.log(
      '📋 [ABI Functions List]:',
      parsedAbi.functions?.map(
        (f) => `${f.name}(${f.inputs?.map((i) => i.type).join(',')})`,
      ) || [],
    )
  }

  const handleContractSelect = (contract: any) => {
    console.log('📋 [Contract Selection] Contract selected:', {
      id: contract.id,
      name: contract.metadata?.title || contract.contractData?.name,
      address: contract.contractData?.address,
      hasBytecode: !!contract.contractData?.bytecode,
      status: contract.status,
      compilationStatus: contract.metadata?.compilationStatus,
      sourceCodeVerified: contract.metadata?.sourceCodeVerified,
    })
    setSelectedContractId(contract.id)
    setSelectedContract(contract)
    console.log(
      '✅ [Contract Selection] State updated - selectedContractId:',
      contract.id,
    )

    // Also update the "to" address if the contract has an address
    if (contract.contractData?.address) {
      setFormData((prev) => ({
        ...prev,
        to: contract.contractData.address,
      }))
      console.log(
        '📍 [Address Update] Transaction "to" address set to:',
        contract.contractData.address,
      )
    }
  }

  const handleFunctionSelect = (
    _func: any,
    _parameters: Record<string, string>,
    functionData?: {
      data: string
      functionName: string
      parameters: Record<string, string>
    },
  ) => {
    if (functionData) {
      setFunctionData({
        data: functionData.data as Hex,
        functionName: functionData.functionName,
        parameters: functionData.parameters,
      })
      // Also update the transaction form data
      setFormData((prev) => ({
        ...prev,
        data: functionData.data,
      }))
    }
  }

  const handleManualDataChange = () => {
    // Clear function data when user manually edits data
    setFunctionData(null)
  }

  const handleSimulation = async (request: {
    params: SdkSimulationRequest['params']
    options?: SdkSimulationRequest['options']
  }) => {
    setLoading(true)
    setError(null)

    try {
      console.log('\n🚀 [Simulation Setup] Preparing simulation request...')
      console.log(
        '📦 Selected Contract:',
        selectedContract?.metadata?.title ||
          selectedContract?.contractData?.name ||
          'None',
      )

      const finalOptions = { ...request.options }

      if (selectedContract) {
        console.log(
          '🔍 [Smart State Override Detection] Checking if contract needs bytecode override...',
        )

        try {
          const stateOverride = await createContractStateOverrideForSimulation(
            selectedContract,
            request.params,
          )

          if (stateOverride.requiresOverride && stateOverride.stateOverride) {
            console.log(
              '⚡ [SDK Call Preparation] Converting state override for API...',
            )

            // Convert to array format expected by API
            const stateOverrideArray = Object.entries(
              stateOverride.stateOverride,
            ).map(([address, overrides]) => ({
              address,
              ...overrides,
            }))

            console.log('📋 [State Override Array]:', stateOverrideArray)

            // Merge with existing state overrides if any
            const existingOverrides = finalOptions.stateOverrides || []
            finalOptions.stateOverrides = [
              ...existingOverrides,
              ...stateOverrideArray,
            ]

            console.log(
              '✅ [Final Options] State overrides applied to simulation:',
            )
            console.log(
              '   Total overrides:',
              finalOptions.stateOverrides.length,
            )
            console.log(
              '   Overriding addresses:',
              finalOptions.stateOverrides.map((o) => o.address),
            )
            console.log('   Full final options:', finalOptions)

            // Show comparison results to user
            if (stateOverride.bytecodeComparison) {
              const { isIdentical, localSize, deployedSize } =
                stateOverride.bytecodeComparison
              console.log(
                `   🔍 Bytecode Analysis: ${isIdentical ? 'IDENTICAL' : 'DIFFERENT'} (Local: ${localSize}b, Deployed: ${deployedSize}b)`,
              )
            }
          } else {
            const reason = stateOverride.bytecodeComparison?.isIdentical
              ? 'bytecode is identical to deployed version'
              : 'contract does not require override'
            console.log(
              `ℹ️ [State Override] No bytecode override needed: ${reason}`,
            )

            // Show helpful info about the comparison
            if (stateOverride.bytecodeComparison) {
              const { localSize, deployedSize } =
                stateOverride.bytecodeComparison
              console.log(
                `   📊 Comparison: Local ${localSize} bytes, Deployed ${deployedSize} bytes`,
              )
            }
          }
        } catch (_error) {
          // Fallback to simple logic if async comparison fails
          const stateOverride = createContractStateOverride(selectedContract)
          if (stateOverride.requiresOverride && stateOverride.stateOverride) {
            const stateOverrideArray = Object.entries(
              stateOverride.stateOverride,
            ).map(([address, overrides]) => ({
              address,
              ...overrides,
            }))

            const existingOverrides = finalOptions.stateOverrides || []
            finalOptions.stateOverrides = [
              ...existingOverrides,
              ...stateOverrideArray,
            ]
            console.log(
              '✅ [Fallback] Applied state override using simple logic',
            )
          }
        }
      } else {
        console.log(
          '❌ [State Override] selectedContract is null/undefined - no state overrides will be applied',
        )
        console.log('🔍 [Debug] Possible reasons:')
        console.log('   1. No contract was selected in the ContractManager')
        console.log('   2. Contract was not properly loaded/stored')
        console.log(
          '   3. selectedContractId does not match any stored contract',
        )
        console.log('   4. Contract selection state was reset')
      }

      // Store simulation parameters for execution on results page
      const simulationId = generateSimulationId()

      store(
        simulationId,
        { params: request.params, options: finalOptions },
        {
          title: `${functionData?.functionName || 'Transaction'} Simulation`,
          tags: ['recent'],
        },
      )

      console.log(
        `📋 [Storage] Saved simulation parameters with ID: ${simulationId}`,
      )
      console.log('🚀 [Navigation] Navigating to results page for execution...')

      // Navigate immediately to results page - execution happens there
      router.push(`/simulator/${simulationId}`)
    } catch (err) {
      setError(`Failed to prepare simulation: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const _resetSimulation = () => {
    setError(null)
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* Header with Navigation */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/simulator')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Back to Simulator</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg sm:text-xl font-bold">
                <span className="hidden sm:inline">New Transaction Simulation</span>
                <span className="sm:hidden">New Simulation</span>
              </h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                Build and simulate HyperEVM transactions with detailed tracing
                and gas analysis
              </p>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Left Column - Input Forms */}
          <div className="space-y-4 sm:space-y-6">
            {/* Contract Management */}
            <div data-section="contract-management">
              <ContractManager
                onContractSelect={handleContractSelect}
                onAbiImport={handleAbiImport}
                onFunctionSelect={handleFunctionSelect}
                selectedContractId={selectedContractId || undefined}
                currentAbi={abi}
                mode="compact"
                showFunctionBuilder={true}
                prefilledAddress={formData.to}
              />
            </div>

            {/* Transaction Form */}
            <TransactionForm
              onSubmit={handleSimulation}
              loading={loading}
              abi={abi}
              functionData={functionData}
              initialData={isPreFilled ? formData : undefined}
              compact={true}
              onManualDataChange={handleManualDataChange}
            />
          </div>

          {/* Right Column - Compact Sidebar */}
          <div className="space-y-4 order-first lg:order-last">
            {/* Status Card - Only show when there's meaningful status */}
            {(loading ||
              (selectedContract &&
                requiresStateOverride(selectedContract))) && (
              <div className="bg-card border rounded-lg p-4">
                <h3 className="text-sm font-medium mb-3">Status</h3>

                {/* State Override Warning */}
                {selectedContract &&
                  requiresStateOverride(selectedContract) && (
                    <div className="mb-3 p-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded text-xs">
                      <div className="font-medium text-orange-700 dark:text-orange-300 mb-1">
                        🔄 State Override Active
                      </div>
                      <div className="text-orange-600 dark:text-orange-400">
                        Contract has modified bytecode - using state override
                        for simulation
                      </div>
                    </div>
                  )}
                {loading && (
                  <div className="text-center py-3">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-foreground">
                        Running Enhanced Simulation
                      </p>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>• Executing transaction simulation</div>
                        <div>• Generating call trace data</div>
                        <div>• Creating access list optimization</div>
                        <div>• Comparing gas efficiency</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Progress Helper */}
            <div className="bg-card border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">Next Steps</h3>
              <div className="space-y-2">
                {!formData.to && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                    Set target address
                  </div>
                )}

                {formData.to && !abi && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const contractSection = document.querySelector(
                        '[data-section="contract-management"]',
                      )
                      contractSection?.scrollIntoView({ behavior: 'smooth' })
                    }}
                    className="w-full justify-start text-xs h-8"
                  >
                    📝 Import Contract & ABI
                  </Button>
                )}

                {formData.to && !formData.data && !abi && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    Add call data or import ABI
                  </div>
                )}

                {formData.to && (formData.data || functionData) && (
                  <div className="flex items-center gap-2 text-xs text-green-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    Ready to simulate!
                  </div>
                )}

                {(!formData.to ||
                  (!formData.data && !functionData && !abi)) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f06e8c',
                        value: '0x0',
                        data: '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f06e8c0000000000000000000000000000000000000000000000000de0b6b3a7640000',
                      }))
                    }}
                    className="w-full justify-start text-xs h-8"
                  >
                    ⚡ Try Example (ERC-20 Transfer)
                  </Button>
                )}
              </div>
            </div>

            {/* Context-Aware Tips */}
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                💡{' '}
                {!formData.to ? 'Get Started' : abi ? 'Pro Tips' : 'Quick Tips'}
              </h3>
              <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                {!formData.to ? (
                  <>
                    <p>• Enter contract address to auto-fetch ABI</p>
                    <p>• Import from saved contracts library</p>
                    <p>• Or paste ABI manually for any contract</p>
                  </>
                ) : !abi ? (
                  <>
                    <p>• Contract Manager auto-fetches from HyperScan</p>
                    <p>• Saved contracts available in library</p>
                    <p>• Use "from" field for account impersonation</p>
                  </>
                ) : (
                  <>
                    <p>• Contract saved automatically for reuse</p>
                    <p>• Function builder validates parameter types</p>
                    <p>• Leave gas empty for automatic estimation</p>
                    <p>• Results include enhanced call traces</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function NewSimulationPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto py-16">
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <h3 className="text-lg font-semibold">Loading Simulator</h3>
            <p className="text-muted-foreground">
              Initializing transaction builder...
            </p>
          </div>
        </div>
      }
    >
      <NewSimulationPageContent />
    </Suspense>
  )
}
