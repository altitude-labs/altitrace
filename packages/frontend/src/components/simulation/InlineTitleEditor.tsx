'use client'

import { CheckIcon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui'
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

  useEffect(() => {
    // Focus and select text on mount
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
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
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <Input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-6 px-2 py-1 text-sm font-medium border-2 border-blue-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-500/20"
        disabled={isLoading}
      />
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading || !title.trim() || title.trim() === currentTitle}
          className="p-1 hover:bg-green-100 hover:text-green-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Save changes"
        >
          <CheckIcon className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isLoading}
          className="p-1 hover:bg-red-100 hover:text-red-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Cancel editing"
        >
          <XIcon className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
