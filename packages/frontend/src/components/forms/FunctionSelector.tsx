'use client'

import type { HexString as Hex } from '@altitrace/sdk/types'
import { CodeIcon, FunctionSquareIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
} from '@/components/ui'
import type { ParsedAbi } from '@/types/api'
import {
  encodeFunctionCall,
  getFunctionSignature,
  parseAbiString,
  validateParameter,
} from '@/utils/abi'

interface FunctionSelectorProps {
  abi: ParsedAbi | null
  rawAbi: string
  onFunctionDataGenerated: (
    data: Hex,
    functionName: string,
    parameters: Record<string, string>,
  ) => void
  selectedFunction?: string
  compact?: boolean
}

export function FunctionSelector({
  abi,
  rawAbi,
  onFunctionDataGenerated,
  selectedFunction,
  compact = false,
}: FunctionSelectorProps) {
  const [selectedFunctionName, setSelectedFunctionName] = useState<string>(
    selectedFunction || '',
  )
  const [parameters, setParameters] = useState<Record<string, string>>({})
  const [parameterErrors, setParameterErrors] = useState<
    Record<string, string>
  >({})
  const [generatedData, setGeneratedData] = useState<string>('')

  // Reset form when ABI changes
  useEffect(() => {
    setSelectedFunctionName('')
    setParameters({})
    setParameterErrors({})
    setGeneratedData('')
  }, [])

  // Update selected function from props
  useEffect(() => {
    if (selectedFunction) {
      setSelectedFunctionName(selectedFunction)
    }
  }, [selectedFunction])

  const selectedFunc = abi?.functions.find(
    (f) => f.name === selectedFunctionName,
  )

  const handleFunctionSelect = (functionName: string) => {
    setSelectedFunctionName(functionName)

    // Reset parameters for new function
    const newParams: Record<string, string> = {}
    const func = abi?.functions.find((f) => f.name === functionName)

    if (func) {
      func.inputs.forEach((input) => {
        newParams[input.name] = ''
      })
    }

    setParameters(newParams)
    setParameterErrors({})
    setGeneratedData('')
  }

  const handleParameterChange = (paramName: string, value: string) => {
    setParameters((prev) => ({
      ...prev,
      [paramName]: value,
    }))

    // Clear error for this parameter
    if (parameterErrors[paramName]) {
      setParameterErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[paramName]
        return newErrors
      })
    }
  }

  const validateAllParameters = (): boolean => {
    if (!selectedFunc) return false

    const errors: Record<string, string> = {}
    let isValid = true

    selectedFunc.inputs.forEach((input) => {
      const value = parameters[input.name] || ''
      const error = validateParameter(value, input.type, input.name)

      if (error) {
        errors[input.name] = error
        isValid = false
      }
    })

    setParameterErrors(errors)
    return isValid
  }

  const handleGenerateData = async () => {
    if (!selectedFunc || !rawAbi) return

    if (!validateAllParameters()) {
      return
    }

    try {
      const parsedAbi = parseAbiString(rawAbi)
      const data = encodeFunctionCall(
        parsedAbi,
        selectedFunctionName,
        parameters,
      )

      setGeneratedData(data)
      onFunctionDataGenerated(data, selectedFunctionName, parameters)
    } catch (error) {
      // Handle encoding errors
      setParameterErrors({
        _general:
          error instanceof Error
            ? error.message
            : 'Failed to encode function data',
      })
    }
  }

  if (!abi || abi.functions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <FunctionSquareIcon className="h-5 w-5" />
            Function Selector
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Import an ABI to select and configure contract functions
          </p>
        </CardContent>
      </Card>
    )
  }

  const functionOptions = abi.functions.map((func) => ({
    value: func.name,
    label: getFunctionSignature(func),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FunctionSquareIcon className="h-5 w-5" />
          Function Selector
        </CardTitle>
      </CardHeader>

      <CardContent className={compact ? 'space-y-3' : 'space-y-4'}>
        <Select
          options={functionOptions}
          placeholder="Select a function..."
          value={selectedFunctionName}
          onChange={(e) => handleFunctionSelect(e.target.value)}
          label="Contract Function"
          description="Choose the function you want to call"
        />

        {selectedFunc && (
          <div className={compact ? 'space-y-3' : 'space-y-4'}>
            <div>
              {!compact && (
                <h4 className="font-semibold text-sm mb-2">
                  Function Parameters:
                </h4>
              )}

              {selectedFunc.inputs.length === 0 ? (
                <p className="text-muted-foreground text-sm italic">
                  This function has no parameters
                </p>
              ) : (
                <div className={compact ? 'space-y-2' : 'space-y-3'}>
                  {selectedFunc.inputs.map((input, index) => (
                    <Input
                      key={`${input.name}-${index}`}
                      label={`${input.name} (${input.type})`}
                      placeholder={`Enter ${input.type} value...`}
                      value={parameters[input.name] || ''}
                      onChange={(e) =>
                        handleParameterChange(input.name, e.target.value)
                      }
                      error={parameterErrors[input.name]}
                      className="font-mono text-sm"
                    />
                  ))}
                </div>
              )}
            </div>

            {parameterErrors._general && (
              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                {parameterErrors._general}
              </div>
            )}

            <Button
              onClick={handleGenerateData}
              disabled={!selectedFunctionName}
              className="w-full"
              size={compact ? 'sm' : 'md'}
            >
              <CodeIcon className="h-4 w-4 mr-2" />
              {compact ? 'Generate Data' : 'Generate Function Data'}
            </Button>

            {generatedData && (
              <div className="space-y-2">
                <label
                  htmlFor="generated-call-data"
                  className="text-sm font-medium"
                >
                  Generated Call Data:
                </label>
                <div className="bg-muted p-3 rounded font-mono text-sm break-all">
                  {generatedData}
                </div>
                <p className="text-xs text-muted-foreground">
                  This data will be used in the transaction&apos;s data field
                </p>
              </div>
            )}

            {!compact && (
              <div className="mt-4 p-3 bg-muted/50 rounded text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">Function Details:</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div>
                    <span className="font-medium">Name:</span>{' '}
                    {selectedFunc.name}
                  </div>
                  <div>
                    <span className="font-medium">State Mutability:</span>{' '}
                    {selectedFunc.stateMutability}
                  </div>
                  <div>
                    <span className="font-medium">Signature:</span>{' '}
                    {getFunctionSignature(selectedFunc)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
