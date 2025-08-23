'use client'

import { AlertCircleIcon, CheckIcon, FileTextIcon } from 'lucide-react'
import { useState } from 'react'
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Textarea,
} from '@/components/ui'
import type { AbiFunction, ParsedAbi } from '@/types/api'
import { AbiError, parseAbiJson } from '@/utils/abi'

interface AbiImportProps {
  onAbiImport: (abi: ParsedAbi, rawAbi: string) => void
  currentAbi?: ParsedAbi | null
}

export function AbiImport({ onAbiImport, currentAbi }: AbiImportProps) {
  const [abiJson, setAbiJson] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleImport = async () => {
    if (!abiJson.trim()) {
      setError('Please paste ABI JSON')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const parsedAbi = parseAbiJson(abiJson)

      if (parsedAbi.functions.length === 0) {
        setError('No functions found in ABI')
        return
      }

      onAbiImport(parsedAbi, abiJson)
      setSuccess(
        `Successfully imported ABI with ${parsedAbi.functions.length} functions`,
      )

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      if (err instanceof AbiError) {
        setError(err.message)
      } else {
        setError('Failed to parse ABI')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setAbiJson('')
    setError(null)
    setSuccess(null)
  }

  const loadExampleAbi = () => {
    const exampleAbi = [
      {
        inputs: [
          { name: 'spender', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        name: 'approve',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        name: 'transfer',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
        ],
        name: 'allowance',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    ]

    setAbiJson(JSON.stringify(exampleAbi, null, 2))
    setError(null)
    setSuccess(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileTextIcon className="h-5 w-5" />
          ABI Import
          {currentAbi && (
            <div className="flex items-center gap-1 text-sm font-normal text-green-600">
              <CheckIcon className="h-4 w-4" />
              {currentAbi.functions.length} functions loaded
            </div>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert variant="success">
            <CheckIcon className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

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

        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handleImport}
            loading={loading}
            disabled={!abiJson.trim()}
          >
            Import ABI
          </Button>

          <Button variant="outline" onClick={loadExampleAbi}>
            Load ERC-20 Example
          </Button>

          <Button variant="ghost" onClick={handleClear} disabled={!abiJson}>
            Clear
          </Button>
        </div>

        {currentAbi && currentAbi.functions.length > 0 && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold text-sm mb-2">Available Functions:</h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {currentAbi.functions.map((func: AbiFunction, index) => (
                <div key={index} className="text-sm font-mono">
                  <span className="text-blue-600 dark:text-blue-400">
                    {func.name}
                  </span>
                  <span className="text-muted-foreground">
                    (
                    {func.inputs
                      .map((input) => `${input.type} ${input.name}`)
                      .join(', ')}
                    )
                  </span>
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-background">
                    {func.stateMutability}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
