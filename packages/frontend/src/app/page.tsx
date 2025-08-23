import { BookOpenIcon, CodeIcon, PlayIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Layout } from '@/components/layout'
import { Button } from '@/components/ui'
import { generateHomeMetadata } from '@/utils/metadata'

export const metadata: Metadata = generateHomeMetadata()

export default function Home() {
  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="text-center space-y-8 mb-16">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-foreground">Altitrace</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Simulate, debug, and analyze EVM transactions within the HyperEVM
              network. Test your transactions before they hit the chain with
              full traceability and state control.
            </p>
          </div>

          <div className="flex items-center justify-center gap-4">
            <Link href="/simulator/new">
              <Button size="lg" className="text-lg px-8">
                <PlayIcon className="h-5 w-5 mr-2" />
                Start Simulating
              </Button>
            </Link>
            <Link href="/simulator">
              <Button variant="outline" size="lg" className="text-lg px-8">
                <CodeIcon className="h-5 w-5 mr-2" />
                View Simulator
              </Button>
            </Link>
            <Button
              variant="outline"
              size="lg"
              className="text-lg px-8"
              disabled
            >
              <BookOpenIcon className="h-5 w-5 mr-2" />
              Documentation (Coming Soon)
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <div className="bg-card rounded-lg p-6 border text-center">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="font-semibold mb-2">Transaction Simulation</h3>
            <p className="text-sm text-muted-foreground">
              Execute transactions against live or historical HyperEVM states
              with full validation
            </p>
          </div>

          <div className="bg-card rounded-lg p-6 border text-center">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="font-semibold mb-2">Detailed Analytics</h3>
            <p className="text-sm text-muted-foreground">
              Gas breakdowns, event logs, asset flows, and execution traces with
              visual charts
            </p>
          </div>

          <div className="bg-card rounded-lg p-6 border text-center">
            <div className="text-4xl mb-4">⚙️</div>
            <h3 className="font-semibold mb-2">State Control</h3>
            <p className="text-sm text-muted-foreground">
              Override state values, impersonate accounts, and modify contract
              code for testing
            </p>
          </div>

          <div className="bg-card rounded-lg p-6 border text-center">
            <div className="text-4xl mb-4">🔗</div>
            <h3 className="font-semibold mb-2">Bundle Support</h3>
            <p className="text-sm text-muted-foreground">
              Simulate complex transaction bundles with dependency analysis and
              state persistence
            </p>
          </div>
        </div>

        {/* Developer Features */}
        <div className="bg-muted rounded-lg p-8 text-center">
          <h2 className="text-2xl font-semibold mb-4">Built for Developers</h2>
          <p className="text-muted-foreground mb-6 max-w-3xl mx-auto">
            Altitrace provides a comprehensive toolchain for HyperEVM
            development with ABI import, function builders, and detailed error
            analysis to streamline your workflow.
          </p>

          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <CodeIcon className="h-4 w-4" />
              <span>TypeScript SDK</span>
            </div>
            <div className="flex items-center gap-2">
              <CodeIcon className="h-4 w-4" />
              <span>REST API</span>
            </div>
            <div className="flex items-center gap-2">
              <CodeIcon className="h-4 w-4" />
              <span>ABI Integration</span>
            </div>
            <div className="flex items-center gap-2">
              <CodeIcon className="h-4 w-4" />
              <span>Event Decoding</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
