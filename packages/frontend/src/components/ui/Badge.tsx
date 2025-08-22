import { HTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline';
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          {
            'border-transparent bg-primary text-primary-foreground hover:bg-primary/80':
              variant === 'default',
            'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80':
              variant === 'secondary',
            'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80':
              variant === 'destructive',
            'border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300':
              variant === 'success',
            'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300':
              variant === 'warning',
            'text-foreground': variant === 'outline',
          },
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };