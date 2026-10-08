/**
 * Financial balance parsing, formatting, and semantic color utility.
 *
 * Semantic color standards:
 * - Negative balance (< 0): RED (text-rose-600)
 * - Positive balance (> 0): GREEN (text-emerald-600)
 * - Zero balance (=== 0): NEUTRAL (text-slate-600)
 */

export function parseBalance(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  const parsed = Number(val)
  return isNaN(parsed) ? 0 : parsed
}

export function formatBalanceCurrency(val: unknown): string {
  const num = parseBalance(val)
  const isNegative = num < 0
  const absFormatted = Math.abs(num).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  return isNegative ? `-₹${absFormatted}` : `₹${absFormatted}`
}

export function getBalanceColorClass(val: unknown): string {
  const num = parseBalance(val)
  if (num < 0) return 'text-rose-600'
  if (num > 0) return 'text-emerald-600'
  return 'text-slate-600'
}
