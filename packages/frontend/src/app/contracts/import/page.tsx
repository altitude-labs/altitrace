'use client'

import { ArrowLeftIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ContractImportDialog } from '@/components/forms/ContractImportDialog'
import { Button } from '@/components/ui'
import type { StoredContract } from '@/utils/contract-storage'

export default function ContractImportPage() {
  const router = useRouter()
  const [showDialog, setShowDialog] = useState(true)

  const handleImport = (contract: StoredContract) => {
    // Contract imported successfully, navigate to the contract details or library
    router.push(`/contracts?highlight=${contract.id}`)
  }

  const handleClose = () => {
    setShowDialog(false)
    router.push('/contracts')
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b bg-card">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/contracts')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-1" />
            Back to Library
          </Button>
        </div>

        <div className="mt-4">
          <h1 className="text-lg sm:text-xl font-bold">Import Contract</h1>
          <p className="text-muted-foreground mt-1">
            Add contracts to your library from explorer APIs or manual ABI input
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="p-6 border rounded-lg">
              <h3 className="font-semibold mb-2">🔍 From Address</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Enter a contract address to automatically fetch ABI from
                HyperScan or Etherscan
              </p>
              <div className="text-xs text-muted-foreground">
                • Auto-detects proxy contracts
                <br />• Resolves implementation ABIs
                <br />• Saves with metadata
              </div>
            </div>

            <div className="p-6 border rounded-lg">
              <h3 className="font-semibold mb-2">📝 Manual ABI</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Paste contract ABI JSON directly for any contract
              </p>
              <div className="text-xs text-muted-foreground">
                • Full ABI validation
                <br />• Custom naming
                <br />• Optional address linking
              </div>
            </div>

            <div className="p-6 border rounded-lg">
              <h3 className="font-semibold mb-2">📚 From Library</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Select from previously saved contracts in your library
              </p>
              <div className="text-xs text-muted-foreground">
                • Quick reuse
                <br />• Search and filter
                <br />• Tagged organization
              </div>
            </div>
          </div>

          {/* Features Overview */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h3 className="font-semibold text-blue-700 dark:text-blue-300 mb-3">
              ✨ Smart Contract Detection
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-600 dark:text-blue-400">
              <div>
                <strong>Proxy Support:</strong>
                <ul className="ml-4 mt-1 space-y-1">
                  <li>• EIP-1967 Standard Proxy</li>
                  <li>• Transparent Admin Proxy</li>
                  <li>• UUPS Upgradeable Proxy</li>
                  <li>• Beacon Proxy Pattern</li>
                </ul>
              </div>
              <div>
                <strong>Auto-Enhancement:</strong>
                <ul className="ml-4 mt-1 space-y-1">
                  <li>• Implementation resolution</li>
                  <li>• Function signature detection</li>
                  <li>• Verification status check</li>
                  <li>• Compiler version tracking</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Import Dialog */}
      <ContractImportDialog
        isOpen={showDialog}
        onClose={handleClose}
        onImport={handleImport}
        defaultTab="address"
      />
    </div>
  )
}
