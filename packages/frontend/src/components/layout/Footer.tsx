import { GithubIcon, GlobeIcon, TwitterIcon } from 'lucide-react'
import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-8 sm:py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Brand Section */}
          <div className="space-y-4 col-span-1 md:col-span-2 lg:col-span-1">
            <div>
              <h3 className="font-bold text-lg">Altitrace</h3>
              <p className="text-sm text-muted-foreground">
                HyperEVM Transaction Simulator
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Simulate, debug, and analyze EVM transactions with precision and
              control.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="font-semibold">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/simulator/new"
                  className="hover:text-primary transition-colors"
                >
                  New Simulation
                </Link>
              </li>
              <li>
                <Link
                  href="/simulator"
                  className="hover:text-primary transition-colors"
                >
                  Simulation History
                </Link>
              </li>
              <li>
                <Link
                  href="/contracts"
                  className="hover:text-primary transition-colors"
                >
                  Contract Library
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-3">
            <h4 className="font-semibold">Resources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/docs"
                  className="hover:text-primary transition-colors"
                >
                  Documentation
                </Link>
              </li>
              <li>
                <Link
                  href="/docs/api"
                  className="hover:text-primary transition-colors"
                >
                  API Reference
                </Link>
              </li>
              <li>
                <Link
                  href="/docs/sdk"
                  className="hover:text-primary transition-colors"
                >
                  SDK Guide
                </Link>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div className="space-y-3">
            <h4 className="font-semibold">Connect</h4>
            <p className="text-sm text-muted-foreground">
              Join our community and stay updated with the latest features.
            </p>
            {/* Social Icons */}
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://github.com/altitude-labs/altitrace"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors group"
                title="GitHub"
              >
                <GithubIcon className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </a>
              <a
                href="https://twitter.com/valtitudexyz"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors group"
                title="Twitter"
              >
                <TwitterIcon className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </a>
              <a
                href="https://reachaltitude.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors group"
                title="Website"
              >
                <GlobeIcon className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </a>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t pt-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Copyright */}
            <div className="text-sm text-muted-foreground text-center sm:text-left">
              © {new Date().getFullYear()} Altitude Labs. All rights reserved.
            </div>

            {/* Bottom Links */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm">
              <Link
                href="https://rpc.reachaltitude.xyz/privacy.html"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="https://rpc.reachaltitude.xyz/terms.html"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Terms of Service
              </Link>
              <span className="text-muted-foreground">v0.1.0-beta</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
