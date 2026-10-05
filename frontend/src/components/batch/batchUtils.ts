export const LONG_RUN_DAYS = 30

/**
 * Calculates running time from the started timestamp and returns "46d 1h".
 * Marks isLongRun = true when running > 30 days.
 */
export function formatRunningDuration(
  startedAt?: string | Date | null,
  completedAt?: string | Date | null
): { text: string; isLongRun: boolean } {
  if (!startedAt) return { text: '—', isLongRun: false }
  const start = new Date(startedAt).getTime()
  if (isNaN(start)) return { text: '—', isLongRun: false }

  const end = completedAt ? new Date(completedAt).getTime() : Date.now()
  const diffMs = Math.max(0, end - start)
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  const isLongRun = days >= LONG_RUN_DAYS

  return {
    text: `${days}d ${hours}h`,
    isLongRun
  }
}

export function formatBatchDate(d?: string | Date | null): string {
  if (!d) return '—'
  const dateObj = new Date(d)
  if (isNaN(dateObj.getTime())) return '—'
  return dateObj.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

export function formatBatchTime(d?: string | Date | null): string {
  if (!d) return '—'
  const dateObj = new Date(d)
  if (isNaN(dateObj.getTime())) return '—'
  return dateObj.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}
