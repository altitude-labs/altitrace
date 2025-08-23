'use client'

import type {
  HexString as Hex,
  SimulationRequest as SdkSimulationRequest,
} from '@altitrace/sdk/types'
import { ArrowLeftIcon } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { AbiImport } from '@/components/forms/AbiImport'
import { FunctionSelector } from '@/components/forms/FunctionSelector'
import { TransactionForm } from '@/components/forms/TransactionForm'
import { Layout } from '@/components/layout'
// Removed unused imports
import { Alert, AlertDescription, Button } from '@/components/ui'
import type { ParsedAbi } from '@/types/api'
import { createAltitraceClient } from '@/utils/client'
import { getRequest, store } from '@/utils/storage'
import {
  type EnhancedSimulationResult,
  executeEnhancedSimulation,
} from '@/utils/trace-integration'

const generateSimulationId = () => crypto.randomUUID()

function NewSimulationPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // ABI State
  const [abi, setAbi] = useState<ParsedAbi | null>(null)
  const [rawAbi, setRawAbi] = useState<string>('')
  const [isPreFilled, setIsPreFilled] = useState(false)

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
  const [simulationResult, setSimulationResult] =
    useState<EnhancedSimulationResult | null>(null)
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
    setAbi(parsedAbi)
    setRawAbi(rawAbiJson)
    setFunctionData(null) // Clear previous function data
  }

  const handleFunctionDataGenerated = (
    data: Hex,
    functionName: string,
    parameters: Record<string, string>,
  ) => {
    setFunctionData({ data, functionName, parameters })
  }

  const handleSimulation = async (request: {
    params: SdkSimulationRequest['params']
    options?: SdkSimulationRequest['options']
  }) => {
    setLoading(true)
    setError(null)
    setSimulationResult(null)

    try {
      const client = createAltitraceClient()

      // Use enhanced simulation with trace data
      const result = await executeEnhancedSimulation(client, {
        params: request.params,
        options: request.options,
      })

      // Store simulation result with UUID using proper storage system
      const simulationId = generateSimulationId()

      store(
        simulationId,
        { params: request.params, options: request.options },
        {
          title: `${functionData?.functionName || 'Transaction'} Simulation`,
          tags: ['recent'],
        },
      )

      setSimulationResult(result)
      // Results will be shown on dedicated page

      // Navigate to dedicated results page
      router.push(`/simulator/${simulationId}`)
    } catch (err) {
      setError(`An unexpected error occurred: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const resetSimulation = () => {
    setSimulationResult(null)
    setError(null)
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8">
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
              Back to Simulator
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">New Transaction Simulation</h1>
              <p className="text-muted-foreground mt-1">
                Build and simulate HyperEVM transactions with detailed tracing
                and gas analysis
              </p>
            </div>
            {simulationResult && (
              <button
                onClick={resetSimulation}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Reset Form
              </button>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Input Forms */}
          <div className="space-y-6">
            {/* ABI Import */}
            <div data-section="abi-import">
              <AbiImport onAbiImport={handleAbiImport} currentAbi={abi} />
            </div>

            {/* Function Selector */}
            <FunctionSelector
              abi={abi}
              rawAbi={rawAbi}
              onFunctionDataGenerated={handleFunctionDataGenerated}
              compact={true}
            />

            {/* Transaction Form */}
            <TransactionForm
              onSubmit={handleSimulation}
              loading={loading}
              abi={abi}
              functionData={functionData}
              initialData={isPreFilled ? formData : undefined}
              compact={true}
            />
          </div>

          {/* Right Column - Compact Sidebar */}
          <div className="space-y-4">
            {/* Status Card - Only show when there's meaningful status */}
            {(loading || simulationResult) && (
              <div className="bg-card border rounded-lg p-4">
                <h3 className="text-sm font-medium mb-3">Status</h3>
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

                {simulationResult && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Result</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          simulationResult.isSuccess()
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {simulationResult.isSuccess()
                          ? '✓ Success'
                          : '✗ Failed'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>
                        Gas: {simulationResult.getTotalGasUsed().toString()}
                      </div>
                      <div>Calls: {simulationResult.calls?.length || 0}</div>
                      {simulationResult.hasGasComparison && (
                        <div className="text-xs text-green-600 font-medium">
                          ⚡ Gas optimization available
                        </div>
                      )}
                      {simulationResult.hasCallHierarchy && (
                        <div className="text-xs text-blue-600">
                          🔍 Call trace enhanced
                        </div>
                      )}
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
                      const abiSection = document.querySelector(
                        '[data-section="abi-import"]',
                      )
                      abiSection?.scrollIntoView({ behavior: 'smooth' })
                    }}
                    className="w-full justify-start text-xs h-8"
                  >
                    📝 Import ABI (optional)
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
                    <p>• Enter a contract address first</p>
                    <p>• Import ABI for easy function calls</p>
                    <p>• Or use raw call data directly</p>
                  </>
                ) : !abi ? (
                  <>
                    <p>• Import ABI to select functions easily</p>
                    <p>• Use "from" for account simulation</p>
                    <p>• Raw call data works without ABI</p>
                  </>
                ) : (
                  <>
                    <p>• Select function from dropdown</p>
                    <p>• Parameters auto-validate types</p>
                    <p>• Leave gas empty for estimation</p>
                    <p>• Results include full call tree</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
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
