import { BookOpenIcon, CodeIcon, PlayIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui'
import { generateHomeMetadata } from '@/utils/metadata'

export const metadata: Metadata = generateHomeMetadata()

export default function Home() {
  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="text-center space-y-6 sm:space-y-8 mb-12 sm:mb-16">
          <div className="space-y-6">
            <h1 className="hidden sm:block text-4xl sm:text-5xl lg:text-6xl font-bold text-brand-light-1 tracking-tight">
              Altitrace
            </h1>
            <div className="hidden sm:block w-24 h-1 bg-gradient-primary mx-auto rounded-full" />
            <p className="text-lg sm:text-xl text-brand-light-2 max-w-2xl mx-auto px-4 sm:px-0 leading-relaxed mt-4 sm:mt-0">
              Simulate, debug, and analyze EVM transactions within the HyperEVM
              network. Test your transactions before they hit the chain with
              full traceability and state control.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4 sm:px-0 pt-4">
            <Link href="/simulator/new" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto text-base sm:text-lg px-8 sm:px-10 py-3 sm:py-4 glow-brand shadow-brand-lg font-medium"
              >
                <PlayIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Start Simulating
              </Button>
            </Link>
            <Link href="/simulator" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto text-base sm:text-lg px-8 sm:px-10 py-3 sm:py-4 border-brand-light-3/30 text-brand-light-2 hover:bg-brand-light-3/10 font-medium"
              >
                <CodeIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                View Simulator
              </Button>
            </Link>
            <Link
              href="/docs"
              className="w-full sm:w-auto"
            >
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto text-base sm:text-lg px-8 sm:px-10 py-3 sm:py-4 border-brand-light-3/30 text-brand-light-2 hover:bg-brand-light-3/10 font-medium"
              >
                <BookOpenIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                <span className="hidden sm:inline">Documentation</span>
                <span className="sm:hidden">Docs</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12 sm:mb-16">
          <div className="card-enhanced p-4 sm:p-6 text-center group">
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4 transition-transform group-hover:scale-110">
              🔍
            </div>
            <h3 className="font-semibold mb-2 text-sm sm:text-base text-brand-light-1">
              Transaction Simulation
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Execute transactions against live or historical HyperEVM states
              with full validation
            </p>
          </div>

          <div className="card-enhanced p-4 sm:p-6 text-center group">
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4 transition-transform group-hover:scale-110">
              📊
            </div>
            <h3 className="font-semibold mb-2 text-sm sm:text-base text-brand-light-1">
              Detailed Analytics
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Gas breakdowns, event logs, asset flows, and execution traces with
              visual charts
            </p>
          </div>

          <div className="card-enhanced p-4 sm:p-6 text-center group">
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4 transition-transform group-hover:scale-110">
              ⚙️
            </div>
            <h3 className="font-semibold mb-2 text-sm sm:text-base text-brand-light-1">
              State Control
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Override state values, impersonate accounts, and modify contract
              code for testing
            </p>
          </div>

          <div className="card-enhanced p-4 sm:p-6 text-center group">
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4 transition-transform group-hover:scale-110">
              🔗
            </div>
            <h3 className="font-semibold mb-2 text-sm sm:text-base text-brand-light-1">
              Bundle Support
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Simulate complex transaction bundles with dependency analysis and
              state persistence
            </p>
          </div>
        </div>

        {/* Developer Features */}
        <div className="gradient-subtle rounded-xl p-6 sm:p-8 text-center border border-brand-light-3/20 shadow-brand-lg">
          <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-brand-light-1">
            Built for Developers
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-8 max-w-3xl mx-auto">
            Altitrace provides a comprehensive toolchain for HyperEVM
            development with ABI import, function builders, and detailed error
            analysis to streamline your workflow.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs sm:text-sm">
            <div className="flex items-center gap-2 px-4 py-2 bg-card/50 rounded-lg border border-brand-light-3/20">
              <CodeIcon className="h-3 w-3 sm:h-4 sm:w-4 text-brand-light-3" />
              <span className="text-brand-light-2">TypeScript SDK</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-card/50 rounded-lg border border-brand-light-3/20">
              <CodeIcon className="h-3 w-3 sm:h-4 sm:w-4 text-brand-light-3" />
              <span className="text-brand-light-2">REST API</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-card/50 rounded-lg border border-brand-light-3/20">
              <CodeIcon className="h-3 w-3 sm:h-4 sm:w-4 text-brand-light-3" />
              <span className="text-brand-light-2">ABI Integration</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-card/50 rounded-lg border border-brand-light-3/20">
              <CodeIcon className="h-3 w-3 sm:h-4 sm:w-4 text-brand-light-3" />
              <span className="text-brand-light-2">Event Decoding</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
