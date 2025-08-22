import { clsx } from 'clsx'
import { forwardRef, type InputHTMLAttributes, useId } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
  label?: string
  description?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { className, type = 'text', error, label, description, id, ...props },
    ref,
  ) => {
    const generatedId = useId()
    const inputId = id || generatedId

    return (
      <div className="space-y-2">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
          </label>
        )}

        <input
          id={inputId}
          type={type}
          className={clsx(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
            'file:border-0 file:bg-transparent file:text-sm file:font-medium',
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

Input.displayName = 'Input'

export { Input }
