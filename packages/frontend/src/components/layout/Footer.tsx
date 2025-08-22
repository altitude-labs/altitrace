import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t bg-background/95">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-lg">AltiTrace</h3>
              <p className="text-sm text-muted-foreground">
                HyperEVM Transaction Simulator
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Simulate, debug, and analyze EVM transactions with precision and
              control.
            </p>
          </div>

          {/* Product */}
          <div className="space-y-3">
            <h4 className="font-semibold">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/simulator"
                  className="hover:text-primary transition-colors"
                >
                  Transaction Simulator
                </Link>
              </li>
              <li>
                <a
                  href="/docs"
                  className="hover:text-primary transition-colors"
                >
                  Documentation
                </a>
              </li>
              <li>
                <a href="/api" className="hover:text-primary transition-colors">
                  API Reference
                </a>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-3">
            <h4 className="font-semibold">Resources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a
                  href="/examples"
                  className="hover:text-primary transition-colors"
                >
                  Examples
                </a>
              </li>
              <li>
                <a
                  href="/guides"
                  className="hover:text-primary transition-colors"
                >
                  Guides
                </a>
              </li>
              <li>
                <a
                  href="/changelog"
                  className="hover:text-primary transition-colors"
                >
                  Changelog
                </a>
              </li>
            </ul>
          </div>

          {/* Community */}
          <div className="space-y-3">
            <h4 className="font-semibold">Community</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a
                  href="https://github.com/altitrace/altitrace"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://twitter.com/altitrace"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  Twitter
                </a>
              </li>
              <li>
                <a
                  href="https://discord.gg/altitrace"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  Discord
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row items-center justify-between mt-8 pt-8 border-t">
          <div className="text-sm text-muted-foreground">
            © 2024 AltiTrace. Built for HyperEVM.
          </div>
          <div className="flex items-center gap-6 mt-4 md:mt-0">
            <a
              href="/privacy"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="/terms"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Terms of Service
            </a>
            <div className="text-sm text-muted-foreground">v0.1.0-beta</div>
          </div>
        </div>
      </div>
    </footer>
  )
}
