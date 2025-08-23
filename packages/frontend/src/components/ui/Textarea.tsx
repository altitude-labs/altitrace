import { clsx } from 'clsx'
import { forwardRef, type TextareaHTMLAttributes, useId } from 'react'

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
  label?: string
  description?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, label, description, id, ...props }, ref) => {
    const generatedId = useId()
    const textareaId = id || generatedId

    return (
      <div className="space-y-2">
        {label && (
          <label
            htmlFor={textareaId}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
          </label>
        )}

        <textarea
          id={textareaId}
          className={clsx(
            'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            {
              'border-destructive focus-visible:ring-destructive': error,
            },
            className,
          )}
          ref={ref}
          {...props}
        />

        {description && !error && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  },
)

Textarea.displayName = 'Textarea'

export { Textarea }
