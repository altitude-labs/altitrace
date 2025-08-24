'use client'

import { useState } from 'react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import {
  ArrowRightIcon,
  CopyIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  FilterIcon,
} from 'lucide-react'
import type { StorageOperation } from '@/utils/trace-helpers'

interface StorageOperationsViewProps {
  operations: StorageOperation[]
  className?: string
}

interface StorageOperationCardProps {
  operation: StorageOperation
  index: number
}

/**
 * View component for displaying storage operations (SSTORE/SLOAD) from trace data
 * Similar to Tenderly's storage interface
 */
export function StorageOperationsView({
  operations,
  className = '',
}: StorageOperationsViewProps) {
  const [filter, setFilter] = useState<'all' | 'SSTORE' | 'SLOAD'>('all')
  const [expandedContracts, setExpandedContracts] = useState<Set<string>>(new Set())

  // Group operations by contract
  const operationsByContract = operations.reduce((acc, op) => {
    if (!acc[op.contract]) {
      acc[op.contract] = []
    }
    acc[op.contract].push(op)
    return acc
  }, {} as Record<string, StorageOperation[]>)

  // Filter operations
  const filteredOperations = operations.filter(op => 
    filter === 'all' || op.opcode === filter
  )

  const sstoreCount = operations.filter(op => op.opcode === 'SSTORE').length
  const sloadCount = operations.filter(op => op.opcode === 'SLOAD').length

  const toggleContractExpansion = (contract: string) => {
    const newExpanded = new Set(expandedContracts)
    if (newExpanded.has(contract)) {
      newExpanded.delete(contract)
    } else {
      newExpanded.add(contract)
    }
    setExpandedContracts(newExpanded)
  }

  if (operations.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center text-muted-foreground">
          <DatabaseIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-foreground">
              No Storage Operations Found
            </h3>
            <p className="text-sm max-w-md mx-auto">
              No SSTORE or SLOAD operations were detected in this trace. This means
              no contract storage was read from or written to during execution.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DatabaseIcon className="h-5 w-5" />
            Storage Operations ({operations.length})
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {sstoreCount} SSTORE
            </Badge>
            <Badge variant="outline" className="text-xs">
              {sloadCount} SLOAD
            </Badge>
            
            <div className="flex gap-1 ml-2">
              <Button
                variant={filter === 'all' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFilter('all')}
                className="h-7 text-xs"
              >
                All
              </Button>
              <Button
                variant={filter === 'SSTORE' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFilter('SSTORE')}
                className="h-7 text-xs"
              >
                SSTORE
              </Button>
              <Button
                variant={filter === 'SLOAD' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFilter('SLOAD')}
                className="h-7 text-xs"
              >
                SLOAD
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Group by contract */}
        {Object.entries(operationsByContract).map(([contract, contractOps]) => {
          const filteredContractOps = contractOps.filter(op => 
            filter === 'all' || op.opcode === filter
          )
          
          if (filteredContractOps.length === 0) return null
          
          const isExpanded = expandedContracts.has(contract)
          
          return (
            <div key={contract} className="border rounded-lg">
              {/* Contract header */}
              <button
                onClick={() => toggleContractExpansion(contract)}
                className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    CONTRACT
                  </Badge>
                  <a
                    href={`https://hyperevmscan.io/address/${contract}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 font-mono text-sm underline decoration-dotted underline-offset-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {contract}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {filteredContractOps.length} ops
                  </Badge>
                  <FilterIcon className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>
              
              {/* Contract operations */}
              {isExpanded && (
                <div className="border-t bg-muted/20">
                  {filteredContractOps.map((op, index) => (
                    <StorageOperationCard 
                      key={`${contract}-${op.pc}-${index}`} 
                      operation={op} 
                      index={index}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
        
        {/* Fallback: show all operations if no contract grouping */}
        {Object.keys(operationsByContract).length === 0 && (
          <div className="space-y-2">
            {filteredOperations.map((op, index) => (
              <StorageOperationCard key={`${op.pc}-${index}`} operation={op} index={index} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Individual storage operation card component
 */
function StorageOperationCard({ operation, index }: StorageOperationCardProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    } catch (error) {
      console.warn('Failed to copy to clipboard:', error)
    }
  }

  const getOpcodeColor = (opcode: string) => {
    return opcode === 'SSTORE' 
      ? 'bg-orange-500/10 text-orange-700 dark:text-orange-400'
      : 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
  }

  const formatHexValue = (value: string | undefined, maxLength = 20) => {
    if (!value || value === '0x0') return '0x0'
    
    if (value.length > maxLength) {
      return `${value.slice(0, maxLength)}...`
    }
    return value
  }

  return (
    <div className="p-3 border-b last:border-b-0 bg-card/50">
      <div className="flex items-start gap-3">
        {/* Opcode badge */}
        <Badge 
          className={`text-xs font-mono px-2 py-1 ${getOpcodeColor(operation.opcode)}`}
          variant="outline"
        >
          {operation.opcode}
        </Badge>
        
        {/* Operation details */}
        <div className="flex-1 space-y-2 min-w-0">
          {/* Slot information */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">SLOT:</span>
            <div className="flex items-center gap-1">
              <code className="text-xs font-mono bg-muted/50 px-2 py-1 rounded">
                {formatHexValue(operation.slot, 16)}
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => copyToClipboard(operation.slot, `slot-${index}`)}
              >
                <CopyIcon className="h-3 w-3" />
              </Button>
              {copied === `slot-${index}` && (
                <span className="text-xs text-green-600">Copied!</span>
              )}
            </div>
          </div>
          
          {/* Value information for SSTORE */}
          {operation.opcode === 'SSTORE' && (
            <div className="flex items-center gap-2 flex-wrap">
              {operation.oldValue && operation.oldValue !== '0x0' && (
                <>
                  <span className="text-xs text-muted-foreground">FROM:</span>
                  <code className="text-xs font-mono bg-red-500/10 text-red-700 dark:text-red-400 px-2 py-1 rounded">
                    {formatHexValue(operation.oldValue, 16)}
                  </code>
                </>
              )}
              
              {operation.oldValue && operation.oldValue !== '0x0' && (
                <ArrowRightIcon className="h-3 w-3 text-muted-foreground" />
              )}
              
              <span className="text-xs text-muted-foreground">TO:</span>
              <div className="flex items-center gap-1">
                <code className="text-xs font-mono bg-green-500/10 text-green-700 dark:text-green-400 px-2 py-1 rounded">
                  {formatHexValue(operation.value, 16)}
                </code>
                {operation.value && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => copyToClipboard(operation.value!, `value-${index}`)}
                  >
                    <CopyIcon className="h-3 w-3" />
                  </Button>
                )}
                {copied === `value-${index}` && (
                  <span className="text-xs text-green-600">Copied!</span>
                )}
              </div>
            </div>
          )}

          {/* Value information for SLOAD */}
          {operation.opcode === 'SLOAD' && operation.value && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">READ VALUE:</span>
              <div className="flex items-center gap-1">
                <code className="text-xs font-mono bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 px-2 py-1 rounded">
                  {formatHexValue(operation.value, 16)}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => copyToClipboard(operation.value!, `sload-value-${index}`)}
                >
                  <CopyIcon className="h-3 w-3" />
                </Button>
                {copied === `sload-value-${index}` && (
                  <span className="text-xs text-green-600">Copied!</span>
                )}
              </div>
            </div>
          )}
          
          {/* Gas and execution info */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Gas: {operation.gas.toLocaleString()}</span>
            <span>Cost: {operation.gasCost.toLocaleString()}</span>
            <span>PC: {operation.pc}</span>
            <span>Depth: {operation.depth}</span>
          </div>
        </div>
      </div>
    </div>
  )
}