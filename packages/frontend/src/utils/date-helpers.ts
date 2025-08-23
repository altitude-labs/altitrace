/**
 * Safe date formatting utilities to prevent hydration and runtime errors
 */

/**
 * Safely formats a date value to locale date string
 * Handles various input types: Date, string, number, or undefined
 */
export function safeFormatDate(
  dateValue: unknown,
  fallback = 'Unknown',
): string {
  if (!dateValue) {
    return fallback
  }

  try {
    const date = new Date(dateValue as string | number | Date)

    // Check if the date is valid
    if (Number.isNaN(date.getTime())) {
      return fallback
    }

    return date.toLocaleDateString()
  } catch {
    return fallback
  }
}

/**
 * Safely formats a date value to locale date and time string
 */
export function safeFormatDateTime(
  dateValue: unknown,
  fallback = 'Unknown',
): string {
  if (!dateValue) {
    return fallback
  }

  try {
    const date = new Date(dateValue as string | number | Date)

    // Check if the date is valid
    if (Number.isNaN(date.getTime())) {
      return fallback
    }

    return date.toLocaleString()
  } catch {
    return fallback
  }
}

/**
 * Safely formats a date value to ISO string
 */
export function safeFormatISOString(
  dateValue: unknown,
  fallback = 'Unknown',
): string {
  if (!dateValue) {
    return fallback
  }

  try {
    const date = new Date(dateValue as string | number | Date)

    // Check if the date is valid
    if (Number.isNaN(date.getTime())) {
      return fallback
    }

    return date.toISOString()
  } catch {
    return fallback
  }
}

/**
 * Safely gets a relative time string (e.g., "2 days ago")
 */
export function safeFormatRelativeTime(
  dateValue: unknown,
  fallback = 'Unknown',
): string {
  if (!dateValue) {
    return fallback
  }

  try {
    const date = new Date(dateValue as string | number | Date)

    // Check if the date is valid
    if (Number.isNaN(date.getTime())) {
      return fallback
    }

    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor(diffMs / (1000 * 60))

    if (diffDays > 0) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
    }
    if (diffHours > 0) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
    }
    if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
    }
    return 'Just now'
  } catch {
    return fallback
  }
}

/**
 * Check if a value is a valid date
 */
export function isValidDate(dateValue: unknown): boolean {
  if (!dateValue) {
    return false
  }

  try {
    const date = new Date(dateValue as string | number | Date)
    return !Number.isNaN(date.getTime())
  } catch {
    return false
  }
}
