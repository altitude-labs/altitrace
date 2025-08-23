'use client'

import {
  BookOpenIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  FileTextIcon,
  HomeIcon,
  PlusIcon,
  SettingsIcon,
  ZapIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui'
import { useContractStorage } from '@/hooks/useContractStorage'

interface SidebarProps {
  isCollapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({ isCollapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['simulator', 'contracts']),
  )
  const [isClient, setIsClient] = useState(false)
  const { getStats } = useContractStorage()
  const contractStats = isClient
    ? getStats()
    : { total: 0, today: 0, byStatus: {}, bySource: {} }

  // Handle client-side hydration
  useEffect(() => {
    setIsClient(true)
  }, [])

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }

  const NavItem = ({
    href,
    icon: Icon,
    label,
    badge,
    isSubItem = false,
  }: {
    href: string
    icon: any
    label: string
    badge?: string | number
    isSubItem?: boolean
  }) => (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
        isActive(href)
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
      } ${isSubItem ? 'ml-4' : ''} ${isCollapsed && !isSubItem ? 'justify-center' : ''}`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {!isCollapsed && (
        <>
          <span className="font-medium text-sm">{label}</span>
          {badge && (
            <span className="ml-auto text-xs px-2 py-0.5 bg-muted rounded-full">
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  )

  const SectionHeader = ({
    icon: Icon,
    label,
    sectionKey,
    children,
  }: {
    icon: any
    label: string
    sectionKey: string
    children: React.ReactNode
  }) => {
    const isExpanded = expandedSections.has(sectionKey)

    return (
      <div>
        <button
          onClick={() => toggleSection(sectionKey)}
          className={`flex items-center gap-3 px-3 py-2 w-full text-left rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/50 ${
            isCollapsed ? 'justify-center' : ''
          }`}
        >
          <Icon className="h-4 w-4 flex-shrink-0" />
          {!isCollapsed && (
            <>
              <span className="font-medium text-sm">{label}</span>
              {isExpanded ? (
                <ChevronDownIcon className="h-3 w-3 ml-auto" />
              ) : (
                <ChevronRightIcon className="h-3 w-3 ml-auto" />
              )}
            </>
          )}
        </button>
        {!isCollapsed && isExpanded && (
          <div className="mt-1 space-y-1">{children}</div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col bg-card border-r transition-all duration-200 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <ZapIcon className="h-5 w-5 text-primary-foreground" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="font-bold text-lg">AltiTrace</h1>
              <p className="text-xs text-muted-foreground">
                HyperEVM Simulator
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {/* Dashboard */}
        <NavItem href="/" icon={HomeIcon} label="Dashboard" />

        {/* Simulator Section */}
        <SectionHeader icon={ZapIcon} label="Simulator" sectionKey="simulator">
          <NavItem
            href="/simulator/new"
            icon={PlusIcon}
            label="New Simulation"
            isSubItem
          />
          <NavItem
            href="/simulator"
            icon={ClockIcon}
            label="History"
            isSubItem
          />
        </SectionHeader>

        {/* Contracts Section */}
        <SectionHeader
          icon={BookOpenIcon}
          label="Contracts"
          sectionKey="contracts"
        >
          <NavItem
            href="/contracts"
            icon={FileTextIcon}
            label="Library"
            badge={contractStats.total > 0 ? contractStats.total : undefined}
            isSubItem
          />
          <NavItem
            href="/contracts/import"
            icon={PlusIcon}
            label="Import"
            isSubItem
          />
        </SectionHeader>

        {/* Settings */}
        <div className="pt-4 border-t">
          <NavItem href="/settings" icon={SettingsIcon} label="Settings" />
        </div>
      </nav>

      {/* Collapse Toggle */}
      {onToggle && (
        <div className="p-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className={`w-full ${isCollapsed ? 'justify-center' : 'justify-start'}`}
          >
            <ChevronRightIcon
              className={`h-4 w-4 transition-transform ${
                isCollapsed ? 'rotate-0' : 'rotate-180'
              }`}
            />
            {!isCollapsed && <span className="ml-2">Collapse</span>}
          </Button>
        </div>
      )}
    </div>
  )
}
