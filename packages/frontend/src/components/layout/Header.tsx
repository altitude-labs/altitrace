'use client'

import { ExternalLinkIcon, FlaskConicalIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui'

export function Header() {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 flex h-14 items-center justify-between">
        {/* Logo and Brand */}
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center justify-center">
              <Image
                src="/altitrace.svg"
                alt="Altitrace"
                width={120}
                height={24}
                className="h-6 w-auto max-w-[120px]"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xl">Altitrace</span>
              <span className="text-xs text-muted-foreground -mt-1">
                HyperEVM Simulator
              </span>
            </div>
          </Link>
          <Badge variant="outline" className="ml-2 text-xs">
            Beta
          </Badge>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-6">
          <Link
            href="/simulator"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            <FlaskConicalIcon className="inline h-4 w-4 mr-1" />
            Simulator
          </Link>

          <span className="text-sm font-medium text-muted-foreground cursor-not-allowed">
            Docs (Soon)
          </span>

          <a
            href="https://github.com/altitrace/altitrace"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium transition-colors hover:text-primary text-muted-foreground"
          >
            <ExternalLinkIcon className="inline h-4 w-4" />
          </a>
        </nav>

        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-muted-foreground">HyperEVM</span>
          </div>
        </div>
      </div>
    </header>
  )
}
