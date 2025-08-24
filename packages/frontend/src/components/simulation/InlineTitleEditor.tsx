'use client'

import { CheckIcon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { updateMetadata } from '@/utils/storage'

interface InlineTitleEditorProps {
  simulationId: string
  currentTitle: string
  onTitleUpdated: (newTitle: string) => void
  onCancel: () => void
}

export function InlineTitleEditor({
  simulationId,
  currentTitle,
  onTitleUpdated,
  onCancel,
}: InlineTitleEditorProps) {
  const [title, setTitle] = useState(currentTitle)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Focus and select text on mount
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }

    // Add click outside listener
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // Click outside - cancel editing without saving
        handleCancel()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSave = async () => {
    if (!title.trim() || title.trim() === currentTitle) {
      onCancel()
      return
    }

    setIsLoading(true)
    try {
      const success = updateMetadata(simulationId, { title: title.trim() })
      if (success) {
        onTitleUpdated(title.trim())
      }
    } catch {
      // Silently handle errors for now
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setTitle(currentTitle)
    onCancel()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  return (
    <div ref={containerRef} className="flex items-center gap-2 min-w-0 flex-1">
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        className="flex-1 min-w-0 text-lg sm:text-xl font-bold bg-transparent border-none outline-none focus:outline-none focus:ring-0 px-0 py-0 placeholder:text-muted-foreground"
        disabled={isLoading}
        placeholder="Enter title..."
      />
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading || !title.trim() || title.trim() === currentTitle}
          className="p-1 hover:bg-green-100 hover:text-green-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Save changes"
        >
          <CheckIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isLoading}
          className="p-1 hover:bg-red-100 hover:text-red-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Cancel editing"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
