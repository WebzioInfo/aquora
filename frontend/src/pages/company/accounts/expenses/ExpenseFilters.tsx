import React, { useState } from 'react'
import { Search, X, Calendar, Filter, Landmark, Wallet, SlidersHorizontal } from 'lucide-react'
import { getCategoryMeta } from './categoryMeta'

export interface ExpenseFilterValues {
  search: string
  method: string // '' | 'Bank' | 'Cash'
  category: string
  datePreset: 'all' | 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'custom'
  startDate?: string
  endDate?: string
}

interface ExpenseFiltersProps {
  categories: string[]
  filters: ExpenseFilterValues
  onChange: (newFilters: Partial<ExpenseFilterValues>) => void
  onClear: () => void
  hasActiveFilters: boolean
}

export const DATE_PRESETS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'custom', label: 'Custom Range' }
]

export const getDateRangeForPreset = (
  preset: string
): { startDate?: string; endDate?: string } => {
  const now = new Date()
  const toYMD = (d: Date) => d.toISOString().split('T')[0]

  switch (preset) {
    case 'today': {
      const todayStr = toYMD(now)
      return { startDate: todayStr, endDate: todayStr }
    }
    case 'thisWeek': {
      // Monday of current week
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(now.setDate(diff))
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      return { startDate: toYMD(monday), endDate: toYMD(sunday) }
    }
    case 'thisMonth': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { startDate: toYMD(firstDay), endDate: toYMD(lastDay) }
    }
    case 'lastMonth': {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
      return { startDate: toYMD(firstDay), endDate: toYMD(lastDay) }
    }
    case 'all':
    default:
      return { startDate: undefined, endDate: undefined }
  }
}

export const ExpenseFilters: React.FC<ExpenseFiltersProps> = ({
  categories,
  filters,
  onChange,
  onClear,
  hasActiveFilters
}) => {
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  const handlePresetChange = (preset: 'all' | 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'custom') => {
    if (preset === 'custom') {
      onChange({ datePreset: 'custom' })
    } else {
      const dates = getDateRangeForPreset(preset)
      onChange({
        datePreset: preset,
        startDate: dates.startDate,
        endDate: dates.endDate
      })
    }
  }

  return (
    <div className="p-3 border-b border-[#E5E9F2] bg-white">
      {/* Desktop & Tablet View (>= 640px) */}
      <div className="hidden sm:flex flex-wrap items-center justify-between gap-2.5">
        {/* Left Side: Search + Chips + Category + Date Preset */}
        <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
          {/* Search Box */}
          <div className="relative w-56 md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search exp #, description..."
              value={filters.search}
              onChange={e => onChange({ search: e.target.value })}
              className="w-full h-[32px] pl-8 pr-7 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-[#1A56DB] focus:outline-none transition-all placeholder:text-slate-400"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => onChange({ search: '' })}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Chips: All / Bank / Cash */}
          <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/60 shrink-0">
            <button
              type="button"
              onClick={() => onChange({ method: '' })}
              className={`py-1 px-2.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                filters.method === ''
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => onChange({ method: 'Bank' })}
              className={`flex items-center gap-1 py-1 px-2.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                filters.method === 'Bank'
                  ? 'bg-[#1A56DB] text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Landmark className="w-3 h-3" />
              Bank
            </button>
            <button
              type="button"
              onClick={() => onChange({ method: 'Cash' })}
              className={`flex items-center gap-1 py-1 px-2.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                filters.method === 'Cash'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wallet className="w-3 h-3" />
              Cash
            </button>
          </div>

          {/* Category Dropdown */}
          <div className="relative shrink-0 flex items-center">
            {filters.category && (
              <span
                className="absolute left-2.5 w-2 h-2 rounded-full z-10 pointer-events-none"
                style={{ backgroundColor: getCategoryMeta(filters.category).dot }}
              />
            )}
            <select
              value={filters.category}
              onChange={e => onChange({ category: e.target.value })}
              style={
                filters.category
                  ? {
                      backgroundColor: getCategoryMeta(filters.category).bg,
                      color: getCategoryMeta(filters.category).text,
                      borderColor: getCategoryMeta(filters.category).dot
                    }
                  : undefined
              }
              className={`h-[32px] ${
                filters.category ? 'pl-6 font-bold' : 'pl-2.5'
              } pr-7 text-xs border rounded-lg focus:outline-none cursor-pointer appearance-none ${
                !filters.category ? 'border-slate-200 bg-slate-50 text-slate-700' : ''
              }`}
            >
              <option value="" style={{ color: '#334155', backgroundColor: '#ffffff' }}>All Categories</option>
              {categories.map(c => {
                const meta = getCategoryMeta(c)
                return (
                  <option
                    key={c}
                    value={c}
                    style={{ color: meta.text, backgroundColor: '#ffffff' }}
                  >
                    ● {c}
                  </option>
                )
              })}
            </select>
            <Filter className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Date Range Preset Selector */}
          <div className="relative shrink-0">
            <select
              value={filters.datePreset}
              onChange={e => handlePresetChange(e.target.value as any)}
              className={`h-[32px] pl-2.5 pr-7 text-xs border rounded-lg focus:outline-none focus:border-[#1A56DB] cursor-pointer appearance-none ${
                filters.datePreset !== 'all'
                  ? 'border-[#1A56DB] bg-blue-50 text-[#1A56DB] font-bold'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              {DATE_PRESETS.map(p => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <Calendar className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Custom Date Inputs (only if preset is 'custom') */}
          {filters.datePreset === 'custom' && (
            <div className="flex items-center gap-1 text-xs shrink-0">
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={e => onChange({ startDate: e.target.value })}
                className="h-[32px] px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-[#1A56DB] focus:outline-none"
              />
              <span className="text-slate-400 font-semibold">–</span>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={e => onChange({ endDate: e.target.value })}
                className="h-[32px] px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-[#1A56DB] focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Right Side: Clear Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer py-1 px-2 rounded hover:bg-rose-50 transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            Clear filters
          </button>
        )}
      </div>

      {/* Mobile View (< 640px) */}
      <div className="sm:hidden flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search expenses..."
            value={filters.search}
            onChange={e => onChange({ search: e.target.value })}
            className="w-full h-[36px] pl-8 pr-7 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-[#1A56DB] focus:outline-none"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onChange({ search: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setMobileFilterOpen(true)}
          className={`h-[36px] px-3 text-xs font-semibold rounded-lg border flex items-center gap-1.5 cursor-pointer ${
            hasActiveFilters
              ? 'bg-blue-50 border-[#1A56DB] text-[#1A56DB]'
              : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
        </button>
      </div>

      {/* Mobile Filters Bottom Sheet */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-xs sm:hidden">
          <div
            className="fixed inset-0"
            onClick={() => setMobileFilterOpen(false)}
          />
          <div className="relative bg-white rounded-t-2xl p-4 space-y-4 shadow-xl border-t border-slate-200 z-10 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Filter Expenses</h3>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">
                Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['', 'Bank', 'Cash'].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onChange({ method: m })}
                    className={`py-2 text-xs font-semibold rounded-lg border cursor-pointer ${
                      filters.method === m
                        ? 'bg-[#1A56DB] text-white border-[#1A56DB]'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {m === '' ? 'All' : m}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">
                Category
              </label>
              <div className="relative flex items-center">
                {filters.category && (
                  <span
                    className="absolute left-3 w-2 h-2 rounded-full z-10 pointer-events-none"
                    style={{ backgroundColor: getCategoryMeta(filters.category).dot }}
                  />
                )}
                <select
                  value={filters.category}
                  onChange={e => onChange({ category: e.target.value })}
                  style={
                    filters.category
                      ? {
                          backgroundColor: getCategoryMeta(filters.category).bg,
                          color: getCategoryMeta(filters.category).text,
                          borderColor: getCategoryMeta(filters.category).dot
                        }
                      : undefined
                  }
                  className={`w-full h-9 ${
                    filters.category ? 'pl-7 font-bold' : 'px-3'
                  } text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB]`}
                >
                  <option value="" style={{ color: '#334155', backgroundColor: '#ffffff' }}>All Categories</option>
                  {categories.map(c => {
                    const meta = getCategoryMeta(c)
                    return (
                      <option
                        key={c}
                        value={c}
                        style={{ color: meta.text, backgroundColor: '#ffffff' }}
                      >
                        ● {c}
                      </option>
                    )
                  })}
                </select>
              </div>
            </div>

            {/* Date Preset */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">
                Date Range
              </label>
              <select
                value={filters.datePreset}
                onChange={e => handlePresetChange(e.target.value as any)}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A56DB]"
              >
                {DATE_PRESETS.map(p => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {filters.datePreset === 'custom' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">From</label>
                  <input
                    type="date"
                    value={filters.startDate || ''}
                    onChange={e => onChange({ startDate: e.target.value })}
                    className="w-full h-9 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">To</label>
                  <input
                    type="date"
                    value={filters.endDate || ''}
                    onChange={e => onChange({ endDate: e.target.value })}
                    className="w-full h-9 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    onClear()
                    setMobileFilterOpen(false)
                  }}
                  className="flex-1 py-2 text-xs font-semibold text-rose-600 border border-rose-200 rounded-lg"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="flex-1 py-2 text-xs font-bold text-white bg-[#1A56DB] rounded-lg shadow-xs"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
