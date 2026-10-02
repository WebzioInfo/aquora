import React, { useMemo, useState, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Purchase } from '../../../../services/purchases'
import { getCategoryMeta, DYNAMIC_PALETTE } from '../expenses/categoryMeta'
import { formatINR, toPaise, fromPaise } from './purchaseHelpers'
import { useViewportSize } from '../../../../hooks/useViewportSize'

interface SpendBreakdownCardsProps {
  purchases: Purchase[]
  selectedCategory?: string
  onSelectCategory: (category: string) => void
  selectedPaymentMethod?: string
  onSelectPaymentMethod: (method: string) => void
  loading?: boolean
}

const METHOD_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  bank: { dot: '#64748B', bg: '#F1F5F9', text: '#334155' },
  bankaccount: { dot: '#64748B', bg: '#F1F5F9', text: '#334155' },
  banktransfer: { dot: '#64748B', bg: '#F1F5F9', text: '#334155' },
  cash: { dot: '#F59E0B', bg: '#FEF3C7', text: '#92400E' },
  upi: { dot: '#06B6D4', bg: '#CFFAFE', text: '#155E75' },
  cheque: { dot: '#8B5CF6', bg: '#EDE9FE', text: '#5B21B6' }
}

const getMethodColor = (method: string) => {
  const key = (method || 'Other').toLowerCase().replace(/\s+/g, '')
  if (METHOD_COLORS[key]) return METHOD_COLORS[key]

  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i)
    hash |= 0
  }
  const idx = Math.abs(hash) % DYNAMIC_PALETTE.length
  const pal = DYNAMIC_PALETTE[idx]
  return { dot: pal.dot, bg: pal.bg, text: pal.text }
}

export const SpendBreakdownCards: React.FC<SpendBreakdownCardsProps> = ({
  purchases,
  selectedCategory,
  onSelectCategory,
  selectedPaymentMethod,
  onSelectPaymentMethod,
  loading = false
}) => {
  const { isCollapseBreakdown } = useViewportSize()
  const [hoveredCat, setHoveredCat] = useState<string | null>(null)
  const [hoveredMethod, setHoveredMethod] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState<boolean>(!isCollapseBreakdown)

  useEffect(() => {
    setIsExpanded(!isCollapseBreakdown)
  }, [isCollapseBreakdown])

  // 1. Category breakdown
  const categoryBreakdown = useMemo(() => {
    const active = purchases.filter(p => !p.isCancelled && p.paymentStatus !== 'Cancelled')
    const map = new Map<string, number>()
    let totalPaise = 0

    for (const p of active) {
      const cat = (p.purchaseCategory || 'Miscellaneous').trim()
      const amtPaise = toPaise(p.grandTotal)
      map.set(cat, (map.get(cat) || 0) + amtPaise)
      totalPaise += amtPaise
    }

    if (totalPaise === 0) return []

    return Array.from(map.entries())
      .map(([cat, amtPaise]) => {
        const amount = fromPaise(amtPaise)
        const percent = (amtPaise / totalPaise) * 100
        const meta = getCategoryMeta(cat)
        return {
          category: cat,
          amount,
          percent,
          meta
        }
      })
      .sort((a, b) => b.amount - a.amount)
  }, [purchases])

  // 2. Payment Method breakdown
  const methodBreakdown = useMemo(() => {
    const active = purchases.filter(p => !p.isCancelled && p.paymentStatus !== 'Cancelled')
    const map = new Map<string, number>()
    let totalPaise = 0

    for (const p of active) {
      const m = (p.paymentMethod || 'Bank').trim()
      const amtPaise = toPaise(p.grandTotal)
      map.set(m, (map.get(m) || 0) + amtPaise)
      totalPaise += amtPaise
    }

    if (totalPaise === 0) return []

    return Array.from(map.entries())
      .map(([method, amtPaise]) => {
        const amount = fromPaise(amtPaise)
        const percent = (amtPaise / totalPaise) * 100
        const colors = getMethodColor(method)
        return {
          method,
          amount,
          percent,
          colors
        }
      })
      .sort((a, b) => b.amount - a.amount)
  }, [purchases])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 w-full shrink-0">
        {[1, 2].map(idx => (
          <div
            key={idx}
            className="bg-white border border-[#E5E9F2] rounded-[12px] p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] animate-pulse"
          >
            <div className="flex justify-between mb-2">
              <div className="h-3 w-28 bg-slate-100 rounded" />
              <div className="h-3 w-16 bg-slate-100 rounded" />
            </div>
            <div className="h-[8px] w-full bg-slate-100 rounded-full" />
          </div>
        ))}
      </div>
    )
  }

  // Collapsed single slim row (height <= 720px and not expanded)
  if (isCollapseBreakdown && !isExpanded) {
    return (
      <div className="bg-white border border-[#E5E9F2] rounded-xl px-3 py-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] shrink-0 flex items-center justify-between text-xs select-none">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
              Category & Payment Breakdowns
            </span>
            <span className="text-[10px] text-slate-400">
              ({categoryBreakdown.length} categories · {methodBreakdown.length} methods)
            </span>
          </div>

          {/* Mini preview bar */}
          <div className="hidden sm:flex h-[6px] w-28 items-center gap-[1px] rounded-full overflow-hidden bg-slate-100">
            {categoryBreakdown.slice(0, 5).map(item => (
              <div
                key={item.category}
                style={{ width: `${item.percent}%`, backgroundColor: item.meta.dot }}
                className="h-full"
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="text-[11px] text-[#1A56DB] hover:underline font-semibold flex items-center gap-1 cursor-pointer shrink-0"
        >
          Show breakdown
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 w-full shrink-0 select-none">
      {/* CARD 1: Spend by Category */}
      <div className="bg-white border border-[#E5E9F2] rounded-[12px] p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-1.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                Spend by Category
              </span>
              <span className="text-[10px] text-slate-400">
                ({categoryBreakdown.length})
              </span>
            </div>
            <div className="flex items-center gap-2">
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => onSelectCategory('')}
                  className="text-[11px] text-[#1A56DB] hover:underline font-semibold cursor-pointer"
                >
                  Clear
                </button>
              )}
              {isCollapseBreakdown && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="text-[11px] text-slate-500 hover:text-slate-800 font-medium flex items-center gap-0.5 cursor-pointer ml-1"
                >
                  Hide
                  <ChevronUp className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Thin stacked bar: 8px, rounded, 2px gaps, min segment width 4px */}
          {categoryBreakdown.length > 0 ? (
            <div className="h-[8px] w-full flex items-center gap-[2px] rounded-full overflow-hidden bg-slate-100 p-[1px]">
              {categoryBreakdown.map(item => {
                const isSelected = selectedCategory?.toLowerCase() === item.category.toLowerCase()
                const isHovered = hoveredCat?.toLowerCase() === item.category.toLowerCase()
                const isDimmed = (selectedCategory && !isSelected) || (hoveredCat && !isHovered)

                return (
                  <div
                    key={item.category}
                    onClick={() => onSelectCategory(isSelected ? '' : item.category)}
                    onMouseEnter={() => setHoveredCat(item.category)}
                    onMouseLeave={() => setHoveredCat(null)}
                    style={{
                      width: `${Math.max(item.percent, 2)}%`,
                      backgroundColor: item.meta.dot,
                      minWidth: '4px'
                    }}
                    className={`h-full cursor-pointer transition-opacity duration-150 rounded-xs ${
                      isDimmed ? 'opacity-30' : 'opacity-100 hover:opacity-85'
                    }`}
                    title={`${item.category}: ${formatINR(item.amount)} (${item.percent.toFixed(1)}%)`}
                  />
                )
              })}
            </div>
          ) : (
            <div className="h-[8px] w-full bg-slate-100 rounded-full" />
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap pt-2 mt-1 border-t border-slate-50 text-[11px]">
          {categoryBreakdown.slice(0, 6).map(item => {
            const isSelected = selectedCategory?.toLowerCase() === item.category.toLowerCase()
            return (
              <button
                key={item.category}
                type="button"
                onClick={() => onSelectCategory(isSelected ? '' : item.category)}
                className={`inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isSelected ? 'font-bold text-slate-900' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.meta.dot }}
                />
                <span className="truncate max-w-[100px]">{item.category}</span>
                <span className="font-mono text-slate-900 font-semibold">{formatINR(item.amount)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* CARD 2: Paid Via */}
      <div className="bg-white border border-[#E5E9F2] rounded-[12px] p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-1.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                Paid Via
              </span>
              <span className="text-[10px] text-slate-400">
                ({methodBreakdown.length})
              </span>
            </div>
            {selectedPaymentMethod && (
              <button
                type="button"
                onClick={() => onSelectPaymentMethod('')}
                className="text-[11px] text-[#1A56DB] hover:underline font-semibold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Thin stacked bar: 8px, rounded, 2px gaps, min segment width 4px */}
          {methodBreakdown.length > 0 ? (
            <div className="h-[8px] w-full flex items-center gap-[2px] rounded-full overflow-hidden bg-slate-100 p-[1px]">
              {methodBreakdown.map(item => {
                const isSelected = selectedPaymentMethod?.toLowerCase() === item.method.toLowerCase()
                const isHovered = hoveredMethod?.toLowerCase() === item.method.toLowerCase()
                const isDimmed = (selectedPaymentMethod && !isSelected) || (hoveredMethod && !isHovered)

                return (
                  <div
                    key={item.method}
                    onClick={() => onSelectPaymentMethod(isSelected ? '' : item.method)}
                    onMouseEnter={() => setHoveredMethod(item.method)}
                    onMouseLeave={() => setHoveredMethod(null)}
                    style={{
                      width: `${Math.max(item.percent, 2)}%`,
                      backgroundColor: item.colors.dot,
                      minWidth: '4px'
                    }}
                    className={`h-full cursor-pointer transition-opacity duration-150 rounded-xs ${
                      isDimmed ? 'opacity-30' : 'opacity-100 hover:opacity-85'
                    }`}
                    title={`${item.method}: ${formatINR(item.amount)} (${item.percent.toFixed(1)}%)`}
                  />
                )
              })}
            </div>
          ) : (
            <div className="h-[8px] w-full bg-slate-100 rounded-full" />
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap pt-2 mt-1 border-t border-slate-50 text-[11px]">
          {methodBreakdown.map(item => {
            const isSelected = selectedPaymentMethod?.toLowerCase() === item.method.toLowerCase()
            return (
              <button
                key={item.method}
                type="button"
                onClick={() => onSelectPaymentMethod(isSelected ? '' : item.method)}
                className={`inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isSelected ? 'font-bold text-slate-900' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.colors.dot }}
                />
                <span className="truncate">{item.method}</span>
                <span className="font-mono text-slate-900 font-semibold">{formatINR(item.amount)}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
