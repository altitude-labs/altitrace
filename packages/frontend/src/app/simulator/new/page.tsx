'use client'

import type {
  HexString as Hex,
  SimulationRequest as SdkSimulationRequest,
} from '@altitrace/sdk/types'
import { ArrowLeftIcon, Layers3Icon, SendIcon } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { ContractManager } from '@/components/forms/ContractManager'
import { TransactionForm } from '@/components/forms/TransactionForm'
import { BundleTransactionForm } from '@/components/forms/BundleTransactionForm'
import {
  Alert,
  AlertDescription,
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import type { ParsedAbi } from '@/types/api'
import type { BundleSimulationRequest, BundleFormData } from '@/types/bundle'
import {
  createContractStateOverride,
  createContractStateOverrideForSimulation,
  requiresStateOverride,
} from '@/utils/contract-state-override'
import type { StoredContract } from '@/utils/contract-storage'
import {
  getRequest,
  store,
  retrieveById,
  type SingleSimulationRequest,
  type BundleSimulationRequestStorage,
} from '@/utils/storage'
import { hexToDecimal, isHexFormat } from '@/utils/validation'

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

  // Form state for pre-filling (single simulations)
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

  // Bundle form state for pre-filling (bundle simulations)
  const [bundleFormData, setBundleFormData] =
    useState<Partial<BundleFormData> | null>(null)

  // Simulation State
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [simulationMode, setSimulationMode] = useState<'single' | 'bundle'>(
    'single',
  )

  // Load pre-fill data from URL params (re-run functionality)
  useEffect(() => {
    const rerunId = searchParams.get('rerun')
    if (rerunId && !isPreFilled) {
      const storedSimulation = retrieveById(rerunId)
      if (storedSimulation) {
        // Pre-fill form with stored simulation data
        console.log('Pre-filling form with:', storedSimulation)

        // Handle different stored request formats
        if (
          storedSimulation.request &&
          'type' in storedSimulation.request &&
          storedSimulation.request.type === 'single'
        ) {
          // Extract data from single simulation request with hex/decimal conversion
          const singleRequest =
            storedSimulation.request as SingleSimulationRequest
          const call = singleRequest.params.calls[0]
          if (call) {
            // Set basic transaction data - convert hex values to decimal for display
            setFormData((prev) => ({
              ...prev,
              to: call.to || '',
              from: call.from || '',
              data: call.data || '',
              value:
                call.value && isHexFormat(call.value)
                  ? hexToDecimal(call.value)
                  : call.value || '0',
              gas:
                call.gas && isHexFormat(call.gas)
                  ? hexToDecimal(call.gas)
                  : call.gas || '',
            }))

            // Set simulation options - convert hex block number to decimal
            setFormData((prev) => ({
              ...prev,
              validation: singleRequest.params.validation ?? true,
              blockTag:
                (singleRequest.params.blockTag as
                  | 'latest'
                  | 'earliest'
                  | 'safe'
                  | 'finalized') || 'latest',
              blockNumber:
                singleRequest.params.blockNumber &&
                isHexFormat(singleRequest.params.blockNumber)
                  ? hexToDecimal(singleRequest.params.blockNumber)
                  : singleRequest.params.blockNumber || '',
              // Include state overrides with decimal balance conversion
              stateOverrides:
                singleRequest.options?.stateOverrides?.map((override) => ({
                  ...override,
                  balance:
                    override.balance && isHexFormat(override.balance)
                      ? hexToDecimal(override.balance)
                      : override.balance,
                })) || [],
            }))
          }
        } else if (
          storedSimulation.request &&
          'type' in storedSimulation.request &&
          storedSimulation.request.type === 'bundle'
        ) {
          // For bundle simulations, switch to bundle mode and pre-fill bundle data
          setSimulationMode('bundle')

          const bundleRequest =
            storedSimulation.request as BundleSimulationRequestStorage
          const bundleData: BundleFormData = {
            transactions: bundleRequest.bundleRequest.transactions.map(
              (tx) => ({
                ...tx,
                // Ensure all required properties are present
                id: tx.id || crypto.randomUUID(),
                enabled: tx.enabled !== undefined ? tx.enabled : true,
                continueOnFailure:
                  tx.continueOnFailure !== undefined
                    ? tx.continueOnFailure
                    : false,
                label: tx.label || '',
              }),
            ),
            blockTag: bundleRequest.bundleRequest.blockTag || 'latest',
            blockNumber: bundleRequest.bundleRequest.blockNumber || '',
            validation: bundleRequest.bundleRequest.validation ?? true,
            account: bundleRequest.bundleRequest.account,
            stateOverrides:
              bundleRequest.bundleRequest.stateOverrides?.map((override) => ({
                ...override,
                balance:
                  override.balance && isHexFormat(override.balance)
                    ? hexToDecimal(override.balance)
                    : override.balance,
              })) || [],
          }

          setBundleFormData(bundleData)
          console.log(
            '🔗 [Bundle Pre-fill] Loaded bundle with',
            bundleData.transactions.length,
            'transactions',
          )
        } else {
          // Handle legacy format (backward compatibility) - pre-bundle implementation
          const legacyRequest = storedSimulation.request as any
          if (legacyRequest && legacyRequest.params?.calls) {
            const call = legacyRequest.params.calls[0]
            if (call) {
              setFormData((prev) => ({
                ...prev,
                to: call.to || '',
                from: call.from || '',
                data: call.data || '',
                value: call.value || '0x0',
                gas: call.gas || '',
                validation: legacyRequest.params.validation ?? true,
                blockTag: legacyRequest.params.blockTag || 'latest',
                blockNumber: legacyRequest.params.blockNumber || '',
              }))
            }
          } else {
            // If we can't parse the stored format, show an error but don't crash
            console.warn(
              'Unable to parse stored simulation format:',
              storedSimulation,
            )
            setError(
              'Stored simulation format is incompatible. Please start a new simulation.',
            )
          }
        }

        setIsPreFilled(true)
      }
    }
  }, [searchParams, isPreFilled])

  const handleAbiImport = (parsedAbi: ParsedAbi, rawAbiJson: string) => {
    setAbi(parsedAbi)
    setFunctionData(null) // Clear previous function data
  }

  const handleContractSelect = (contract: any) => {
    setSelectedContractId(contract.id)
    setSelectedContract(contract)

    // Also update the "to" address if the contract has an address
    if (contract.contractData?.address) {
      setFormData((prev) => ({
        ...prev,
        to: contract.contractData.address,
      }))
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

  const handleBundleSimulation = async (request: BundleSimulationRequest) => {
    setLoading(true)
    setError(null)

    try {
      console.log('\n🔗 [Bundle Simulation Setup] Preparing bundle request...')
      console.log('📦 Bundle transactions:', request.transactions.length)

      // Store bundle simulation parameters for execution on results page
      const simulationId = generateSimulationId()

      // Convert bundle request to storage format
      const bundleRequest = {
        type: 'bundle' as const,
        bundleRequest: request,
      }

      store(simulationId, bundleRequest, {
        title: `Bundle Simulation (${request.transactions.length} txs)`,
        tags: ['recent', 'bundle'],
      })

      console.log(
        `📋 [Storage] Saved bundle parameters with ID: ${simulationId}`,
      )
      console.log(
        '🚀 [Navigation] Navigating to bundle results page for execution...',
      )

      // Navigate to results page for bundle execution
      router.push(`/simulator/${simulationId}`)
    } catch (err) {
      setError(`Failed to prepare bundle simulation: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const handleTraceTransaction = async (txHash: string) => {
    // Generate a unique ID for the trace result
    const traceId = generateSimulationId()

    // Store trace parameters for execution on results page
    store(
      traceId,
      {
        params: {
          calls: [
            {
              to: '0x0000000000000000000000000000000000000000',
              data: '0x',
              value: '0x0',
            },
          ],
          blockTag: 'latest',
        },
      },
      {
        title: `Transaction Trace: ${txHash.slice(0, 10)}...`,
        tags: ['trace', 'recent'],
        description: `Trace for transaction: ${txHash}`,
        traceHash: txHash,
      },
    )

    // Navigate to results page - trace execution happens there
    router.push(`/simulator/${traceId}`)
  }

  const handleSimulation = async (request: {
    params: SdkSimulationRequest['params']
    options?: SdkSimulationRequest['options']
  }) => {
    setLoading(true)
    setError(null)

    try {
      const finalOptions = { ...request.options }
      if (selectedContract) {
        try {
          const stateOverride = await createContractStateOverrideForSimulation(
            selectedContract,
            request.params,
          )

          if (stateOverride.requiresOverride && stateOverride.stateOverride) {
            // Convert to array format expected by API
            const stateOverrideArray = Object.entries(
              stateOverride.stateOverride,
            ).map(([address, overrides]) => ({
              address,
              ...overrides,
            }))

            // Merge with existing state overrides if any
            const existingOverrides = finalOptions.stateOverrides || []
            finalOptions.stateOverrides = [
              ...existingOverrides,
              ...stateOverrideArray,
            ]

            // Show comparison results to user
            if (stateOverride.bytecodeComparison) {
              const { isIdentical, localSize, deployedSize } =
                stateOverride.bytecodeComparison
            }
          } else {
            const reason = stateOverride.bytecodeComparison?.isIdentical
              ? 'bytecode is identical to deployed version'
              : 'contract does not require override'

            // Show helpful info about the comparison
            if (stateOverride.bytecodeComparison) {
              const { localSize, deployedSize } =
                stateOverride.bytecodeComparison
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
          }
        }
      } else {
      }

      // Store simulation parameters for execution on results page
      const simulationId = generateSimulationId()

      store(
        simulationId,
        {
          params: request.params,
          options: finalOptions,
        },
        {
          title: `${functionData?.functionName || 'Transaction'} Simulation`,
          tags: ['simulation', 'recent'],
        },
      )

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
                <span className="hidden sm:inline">
                  {simulationMode === 'bundle'
                    ? 'New Bundle Simulation'
                    : 'New Transaction Simulation'}
                </span>
                <span className="sm:hidden">New Simulation</span>
              </h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                {simulationMode === 'bundle'
                  ? 'Build and simulate sequential transaction bundles with state dependencies'
                  : 'Build and simulate HyperEVM transactions with detailed tracing and gas analysis'}
              </p>
            </div>
          </div>

          {/* Mode Selector */}
          <Tabs
            value={simulationMode}
            onValueChange={(value) =>
              setSimulationMode(value as 'single' | 'bundle')
            }
            className="w-full max-w-md"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single" className="flex items-center gap-2">
                <SendIcon className="h-4 w-4" />
                Single Transaction
              </TabsTrigger>
              <TabsTrigger value="bundle" className="flex items-center gap-2">
                <Layers3Icon className="h-4 w-4" />
                Bundle Transactions
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Quick Actions and Get Started at the top - constrained width */}
        <div className="max-w-4xl mx-auto mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Get Started Tips - First on mobile */}
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 order-1 md:order-2">
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

            {/* Quick Actions - Second on mobile */}
            <div className="bg-card border rounded-lg p-4 order-2 md:order-1">
              <h3 className="text-sm font-medium mb-3">Quick Actions</h3>
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

                {formData.to && (formData.data || functionData) && (
                  <div className="flex items-center gap-2 text-xs text-green-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    Ready to simulate!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Single column layout with full width */}
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
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

          {/* Transaction Form - Conditional based on mode */}
          {simulationMode === 'single' ? (
            <TransactionForm
              onSubmit={handleSimulation}
              onTraceTransaction={handleTraceTransaction}
              loading={loading}
              abi={abi}
              functionData={functionData}
              initialData={isPreFilled ? formData : undefined}
              compact={true}
              onManualDataChange={handleManualDataChange}
            />
          ) : (
            <BundleTransactionForm
              onSubmit={handleBundleSimulation}
              loading={loading}
              abi={abi}
              functionData={functionData}
              initialData={bundleFormData || undefined}
              compact={true}
              onManualDataChange={handleManualDataChange}
            />
          )}

          {/* Status Card - Only show when there's meaningful status */}
          {(loading ||
            (selectedContract && requiresStateOverride(selectedContract))) && (
            <div className="bg-card border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">Status</h3>

              {/* State Override Warning */}
              {selectedContract && requiresStateOverride(selectedContract) && (
                <div className="mb-3 p-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded text-xs">
                  <div className="font-medium text-orange-700 dark:text-orange-300 mb-1">
                    🔄 State Override Active
                  </div>
                  <div className="text-orange-600 dark:text-orange-400">
                    Contract has modified bytecode - using state override for
                    simulation
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
