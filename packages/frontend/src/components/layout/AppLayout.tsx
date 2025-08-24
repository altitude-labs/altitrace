'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Footer } from './Footer'
import { Sidebar } from './Sidebar'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(true)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      setSidebarCollapsed(true)
      setSidebarOpen(false)
    }

    setIsHydrated(true)
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  const handleSidebarToggle = () => {
    if (isMobile) {
      setSidebarOpen(!sidebarOpen)
    } else {
      setSidebarCollapsed(!sidebarCollapsed)
    }
  }

  const handleOverlayClick = () => {
    if (isMobile && sidebarOpen) {
      setSidebarOpen(false)
    }
  }

  const handleNavigate = () => {
    if (isMobile && sidebarOpen) {
      setSidebarOpen(false)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={handleOverlayClick}
        />
      )}

      {/* Sidebar */}
      {isHydrated && (
        <div
          className={`${
            isMobile
              ? `fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ${
                  sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`
              : 'relative'
          }`}
        >
          <Sidebar
            isCollapsed={sidebarCollapsed}
            onToggle={handleSidebarToggle}
            isMobile={isMobile}
            onNavigate={handleNavigate}
          />
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col">
        {/* Mobile Header */}
        {isMobile && isHydrated && (
          <div className="bg-card border-b p-4 h-[72px] flex items-center md:hidden">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSidebarToggle}
                className="p-2 rounded-lg hover:bg-muted"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
              <Image
                src="/altitrace.svg"
                alt="Altitrace"
                width={120}
                height={24}
                className="h-6 w-auto"
              />
            </div>
          </div>
        )}
        <div className="flex-1">{children}</div>
        <Footer />
      </main>
    </div>
  )
}
