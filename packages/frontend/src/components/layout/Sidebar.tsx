'use client'

import {
  BookOpenIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  FileTextIcon,
  HomeIcon,
  PlusIcon,
  ZapIcon,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui'

interface SidebarProps {
  isCollapsed?: boolean
  onToggle?: () => void
  isMobile?: boolean
  onNavigate?: () => void
}

export function Sidebar({
  isCollapsed = false,
  onToggle,
  isMobile = false,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname()
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['simulator', 'contracts']),
  )

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
    // For exact matching of specific routes
    return pathname === path
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
      onClick={() => {
        if (isMobile && onNavigate) {
          onNavigate()
        }
      }}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-150 ${
        isActive(href)
          ? 'bg-brand-dark-1 text-brand-light-1 border border-brand-light-3/20 shadow-sm'
          : 'text-muted-foreground hover:text-brand-light-2 hover:bg-brand-dark-2/50 hover:border hover:border-brand-light-3/10'
      } ${isSubItem ? 'ml-4' : ''} ${isCollapsed && !isSubItem ? 'justify-center' : ''}`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {(!isCollapsed || isMobile) && (
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
    defaultHref,
    childPaths,
  }: {
    icon: any
    label: string
    sectionKey: string
    children: React.ReactNode
    defaultHref?: string
    childPaths?: string[]
  }) => {
    const isExpanded = expandedSections.has(sectionKey)
    const router = useRouter()

    // Check if any child path is active
    const isActiveSection = childPaths?.some((path) => isActive(path)) || false

    const handleClick = () => {
      if (isCollapsed && !isMobile && defaultHref) {
        // When collapsed, navigate to the default href
        router.push(defaultHref)
      } else {
        // When expanded, toggle the section
        toggleSection(sectionKey)
      }
    }

    return (
      <div>
        <button
          onClick={handleClick}
          className={`flex items-center gap-3 px-3 py-2 w-full text-left rounded-lg transition-colors duration-150 ${
            isActiveSection
              ? 'bg-brand-dark-1 text-brand-light-1 border border-brand-light-3/20 shadow-sm'
              : 'text-muted-foreground hover:text-brand-light-2 hover:bg-brand-dark-2/50 hover:border hover:border-brand-light-3/10'
          } ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? label : undefined}
        >
          <Icon className="h-4 w-4 flex-shrink-0" />
          {(!isCollapsed || isMobile) && (
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

        {/* Regular expanded view */}
        {(!isCollapsed || isMobile) && isExpanded && (
          <div className="mt-1 space-y-1">{children}</div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col h-full border-r transition-all duration-200 ${
        isMobile
          ? 'w-64 bg-background'
          : isCollapsed
            ? 'w-16 bg-card'
            : 'w-64 bg-card'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b h-[72px] flex items-center">
        <div className="flex items-center justify-center w-full">
          {!isCollapsed || isMobile ? (
            <div className="flex items-center justify-center">
              <Image
                src="/altitrace.svg"
                alt="Altitrace"
                width={160}
                height={32}
                className="h-8 w-auto max-w-[160px]"
              />
            </div>
          ) : (
            <div className="w-8 h-8 flex items-center justify-center">
              <Image
                src="/logo.svg"
                alt="Altitrace"
                width={32}
                height={32}
                className="w-8 h-8"
              />
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {/* Dashboard */}
        <NavItem href="/" icon={HomeIcon} label="Dashboard" />

        {/* Simulator Section */}
        <SectionHeader
          icon={ZapIcon}
          label="Simulator"
          sectionKey="simulator"
          defaultHref="/simulator/new"
          childPaths={['/simulator', '/simulator/new']}
        >
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
          defaultHref="/contracts"
          childPaths={['/contracts', '/contracts/import', '/contracts/edit']}
        >
          <NavItem
            href="/contracts"
            icon={FileTextIcon}
            label="Library"
            isSubItem
          />
          <NavItem
            href="/contracts/import"
            icon={PlusIcon}
            label="Import"
            isSubItem
          />
        </SectionHeader>
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
            {(!isCollapsed || isMobile) && (
              <span className="ml-2">{isMobile ? 'Close' : 'Collapse'}</span>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
