import React, { useState, useMemo, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { SimpleExpense } from '../../../../services/simpleAccounts'
import { getCategoryMeta } from './categoryMeta'
import { useViewportSize } from '../../../../hooks/useViewportSize'

interface CategoryBarProps {
  expenses: SimpleExpense[]
  selectedCategory?: string
  onSelectCategory: (category: string) => void
  loading?: boolean
}

export const CategoryBar: React.FC<CategoryBarProps> = ({
  expenses,
  selectedCategory,
  onSelectCategory,
  loading = false
}) => {
  const { isCollapseBreakdown } = useViewportSize()
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState<boolean>(!isCollapseBreakdown)

  // Sync default expansion when entering/leaving collapse breakpoint
  useEffect(() => {
    setIsExpanded(!isCollapseBreakdown)
  }, [isCollapseBreakdown])

  // Compute breakdown
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>()
    let total = 0
    for (const exp of expenses) {
      const cat = exp.category?.trim() || 'Miscellaneous'
      const amt = exp.amount || 0
      map.set(cat, (map.get(cat) || 0) + amt)
      total += amt
    }

    if (total === 0) return []

    return Array.from(map.entries())
      .map(([cat, amount]) => {
        const percent = (amount / total) * 100
        const meta = getCategoryMeta(cat)
        return {
          category: cat,
          amount,
          percent,
          meta
        }
      })
      .sort((a, b) => b.amount - a.amount)
  }, [expenses])

  if (loading) {
    return (
      <div className="bg-white border border-[#E5E9F2] rounded-[12px] p-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] shrink-0 animate-pulse">
        <div className="flex items-center justify-between mb-2">
          <div className="h-3 w-32 bg-slate-100 rounded" />
          <div className="h-3 w-16 bg-slate-100 rounded" />
        </div>
        <div className="h-[8px] w-full bg-slate-100 rounded-full" />
      </div>
    )
  }

  if (categoryBreakdown.length === 0) {
    return null
  }

  // Collapsed slim row state (height <= 720px and user hasn't expanded)
  if (isCollapseBreakdown && !isExpanded) {
    return (
      <div className="bg-white border border-[#E5E9F2] rounded-xl px-3 py-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] shrink-0 flex items-center justify-between text-xs select-none">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
            Spend by Category
          </span>
          <span className="text-[10px] text-slate-400">
            ({categoryBreakdown.length})
          </span>
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
          className="text-[11px] text-[#1A56DB] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
        >
          Show breakdown
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#E5E9F2] rounded-[12px] p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] shrink-0 select-none">
      <div className="flex items-center justify-between pb-1.5 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
            Spend by Category
          </span>
          <span className="text-[10px] text-slate-400">
            ({categoryBreakdown.length} {categoryBreakdown.length === 1 ? 'category' : 'categories'})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selectedCategory && (
            <button
              type="button"
              onClick={() => onSelectCategory('')}
              className="text-[11px] text-[#1A56DB] hover:underline font-semibold cursor-pointer"
            >
              Show All
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

      {/* 8px high horizontal stacked bar with 2px gaps */}
      <div className="h-[8px] w-full flex items-center gap-[2px] rounded-full overflow-hidden bg-slate-100 p-[1px]">
        {categoryBreakdown.map(item => {
          const isSelected = selectedCategory?.toLowerCase() === item.category.toLowerCase()
          const isHovered = hoveredCategory?.toLowerCase() === item.category.toLowerCase()
          const isDimmed = (selectedCategory && !isSelected) || (hoveredCategory && !isHovered)

          return (
            <div
              key={item.category}
              onClick={() => onSelectCategory(isSelected ? '' : item.category)}
              onMouseEnter={() => setHoveredCategory(item.category)}
              onMouseLeave={() => setHoveredCategory(null)}
              style={{
                width: `${Math.max(item.percent, 1.5)}%`,
                backgroundColor: item.meta.dot,
                minWidth: '4px'
              }}
              className={`h-full cursor-pointer transition-opacity duration-150 rounded-xs ${
                isDimmed ? 'opacity-30' : 'opacity-100 hover:opacity-85'
              }`}
              title={`${item.category}: ₹${Math.round(item.amount).toLocaleString('en-IN')} (${item.percent.toFixed(1)}%)`}
            />
          )
        })}
      </div>

      {/* Legend below the bar */}
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap pt-2 mt-1 border-t border-slate-50 text-[11px]">
        {categoryBreakdown.slice(0, 8).map(item => {
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
              <span className="truncate max-w-[110px]">{item.category}</span>
              <span className="font-mono text-slate-900 font-semibold">
                ₹{Math.round(item.amount).toLocaleString('en-IN')}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
