import React from 'react'

/**
 * Format currency with Indian grouping (lakhs/crores).
 * Automatically displays decimals only if paise exist (or when forceDecimals is true).
 */
export const formatINR = (val: number | string | undefined | null, forceDecimals: boolean = false): string => {
  if (val === undefined || val === null || isNaN(Number(val))) return '₹0.00'
  const num = Number(val)
  const hasPaise = Math.abs(num % 1) > 0.001
  const decimals = (forceDecimals || hasPaise) ? 2 : 2
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

/**
 * Extract clean initials from employee full name
 */
export const getEmployeeInitials = (name?: string): string => {
  if (!name || !name.trim()) return 'EM'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Distinct pastel avatar colors based on name hash
 */
export const getAvatarColor = (name?: string) => {
  const palette = [
    { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
    { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
    { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
    { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
    { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
    { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' },
    { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
    { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' }
  ]
  if (!name) return palette[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % palette.length
  return palette[index]
}

/**
 * Format YYYY-MM to "August 2026"
 */
export const formatMonthLabel = (mStr?: string): string => {
  if (!mStr) return 'All Months'
  const parts = mStr.split('-')
  if (parts.length !== 2) return mStr
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  if (isNaN(year) || isNaN(month)) return mStr
  const d = new Date(year, month, 1)
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

/**
 * Format YYYY-MM to short label "Aug 2026"
 */
export const formatShortMonth = (mStr?: string): string => {
  if (!mStr) return 'All'
  const parts = mStr.split('-')
  if (parts.length !== 2) return mStr
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  if (isNaN(year) || isNaN(month)) return mStr
  const d = new Date(year, month, 1)
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

/**
 * Calculate previous month in YYYY-MM
 */
export const getPrevMonth = (mStr?: string): string => {
  const base = mStr && /^\d{4}-\d{2}$/.test(mStr) ? mStr : new Date().toISOString().slice(0, 7)
  const [year, month] = base.split('-').map(Number)
  const d = new Date(year, month - 2, 1)
  const prevY = d.getFullYear()
  const prevM = String(d.getMonth() + 1).padStart(2, '0')
  return `${prevY}-${prevM}`
}

/**
 * Calculate next month in YYYY-MM
 */
export const getNextMonth = (mStr?: string): string => {
  const base = mStr && /^\d{4}-\d{2}$/.test(mStr) ? mStr : new Date().toISOString().slice(0, 7)
  const [year, month] = base.split('-').map(Number)
  const d = new Date(year, month, 1)
  const nextY = d.getFullYear()
  const nextM = String(d.getMonth() + 1).padStart(2, '0')
  return `${nextY}-${nextM}`
}

/**
 * Format date to standard Indian display "18 Aug 2026" or "18 Aug"
 */
export const formatDisplayDate = (dStr?: string | null, includeYear: boolean = true): string => {
  if (!dStr) return '—'
  const d = new Date(dStr)
  if (isNaN(d.getTime())) return String(dStr)
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: includeYear ? 'numeric' : undefined
  })
}

/**
 * Safe currency rounder
 */
export const roundToCurrency = (val: number | string): number => {
  const num = typeof val === 'number' ? val : parseFloat(String(val))
  if (isNaN(num)) return 0
  return Math.round((num + Number.EPSILON) * 100) / 100
}
