import React, { useState, useRef, useEffect } from 'react'
import { Search, X, Calendar, Filter, ChevronDown } from 'lucide-react'

export interface AssetFilterValues {
  search: string
  status: string // 'ALL' | 'Active' | 'UnderMaintenance' | 'Disposed'
  category: string
  condition: string
  datePreset: 'all' | 'today' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom'
  fromDate?: string
  toDate?: string
}

interface AssetFiltersProps {
  filters: AssetFilterValues
  onChange: (newFilters: Partial<AssetFilterValues>) => void
  onClear: () => void
  hasActiveFilters: boolean
  categories?: string[]
}

export const DATE_PRESETS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'thisYear', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' }
]

export const getDateRangeForPreset = (
  preset: string
): { fromDate?: string; toDate?: string } => {
  const now = new Date()
  const toYMD = (d: Date) => d.toISOString().split('T')[0]

  switch (preset) {
    case 'today': {
      const todayStr = toYMD(now)
      return { fromDate: todayStr, toDate: todayStr }
    }
    case 'thisMonth': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { fromDate: toYMD(firstDay), toDate: toYMD(lastDay) }
    }
    case 'lastMonth': {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
      return { fromDate: toYMD(firstDay), toDate: toYMD(lastDay) }
    }
    case 'thisYear': {
      const firstDay = new Date(now.getFullYear(), 0, 1)
      const lastDay = new Date(now.getFullYear(), 11, 31)
      return { fromDate: toYMD(firstDay), toDate: toYMD(lastDay) }
    }
    case 'all':
    default:
      return { fromDate: undefined, toDate: undefined }
  }
}

export const AssetFilters: React.FC<AssetFiltersProps> = ({
  filters,
  onChange,
  onClear,
  hasActiveFilters,
  categories = [
    'Machinery',
    'Vehicles',
    'Computers',
    'Printers',
    'Furniture',
    'Office Equipment',
    'Buildings',
    'Other'
  ]
}) => {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const datePickerRef = useRef<HTMLDivElement>(null)

  // Close date picker popover on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setIsDatePickerOpen(false)
      }
    }
    if (isDatePickerOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isDatePickerOpen])

  const handlePresetSelect = (preset: 'all' | 'today' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom') => {
    if (preset === 'custom') {
      onChange({ datePreset: 'custom' })
    } else {
      const range = getDateRangeForPreset(preset)
      onChange({
        datePreset: preset,
        fromDate: range.fromDate,
        toDate: range.toDate
      })
      setIsDatePickerOpen(false)
    }
  }

  const activeDateLabel = DATE_PRESETS.find(p => p.value === filters.datePreset)?.label || 'All Time'

  return (
    <div className="p-3 border-b border-[#E5E9F2] bg-white flex flex-wrap items-center justify-between gap-3 shrink-0 select-none">
      <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
        {/* 1. Search input */}
        <div className="relative min-w-[200px] max-w-xs flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filters.search}
            onChange={e => onChange({ search: e.target.value })}
            placeholder="Search name, tag, serial, model..."
            className="w-full h-[34px] pl-8 pr-7 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1A56DB] transition-colors"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onChange({ search: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 2. Status Segmented Control (BLACK active segment with white text) */}
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white text-xs shadow-2xs h-[34px] items-center">
          {[
            { value: 'ALL', label: 'All' },
            { value: 'Active', label: 'Active' },
            { value: 'UnderMaintenance', label: 'Maintenance' },
            { value: 'Disposed', label: 'Disposed' }
          ].map(opt => {
            const isActive = filters.status === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ status: opt.value })}
                className={`h-full px-2.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        {/* 3. Category Dropdown (White, 0.5px border, 34px high with filter icon) */}
        <div className="relative shrink-0 flex items-center">
          <Filter className="w-3 h-3 text-slate-400 absolute left-2.5 pointer-events-none" />
          <select
            value={filters.category}
            onChange={e => onChange({ category: e.target.value })}
            className={`h-[34px] pl-7 pr-7 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB] cursor-pointer appearance-none ${
              filters.category && filters.category !== 'ALL'
                ? 'font-bold text-slate-900 border-slate-300'
                : 'text-slate-600 font-medium'
            }`}
          >
            <option value="ALL">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
        </div>

        {/* 4. Condition Dropdown (White, 0.5px border, 34px high) */}
        <div className="relative shrink-0 flex items-center">
          <select
            value={filters.condition}
            onChange={e => onChange({ condition: e.target.value })}
            className={`h-[34px] px-3 pr-7 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#1A56DB] cursor-pointer appearance-none ${
              filters.condition && filters.condition !== 'ALL'
                ? 'font-bold text-slate-900 border-slate-300'
                : 'text-slate-600 font-medium'
            }`}
          >
            <option value="ALL">All Conditions</option>
            <option value="Excellent">Excellent</option>
            <option value="Good">Good</option>
            <option value="Fair">Fair</option>
            <option value="NeedsRepair">Needs Repair</option>
            <option value="Critical">Critical</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
        </div>

        {/* 5. Date Range Picker Dropdown (White, 0.5px border, 34px high) */}
        <div className="relative shrink-0" ref={datePickerRef}>
          <button
            type="button"
            onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
            className={`h-[34px] px-3 flex items-center gap-1.5 border border-slate-200 rounded-lg bg-white text-xs font-medium hover:border-slate-300 transition-colors ${
              filters.datePreset !== 'all' ? 'text-[#1A56DB] font-bold border-blue-200 bg-blue-50/40' : 'text-slate-700'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Date: {activeDateLabel}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
          </button>

          {isDatePickerOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-40 animate-in fade-in zoom-in-95 duration-100">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                Filter by Purchase Date
              </div>

              <div className="space-y-0.5">
                {DATE_PRESETS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => handlePresetSelect(p.value as any)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      filters.datePreset === p.value
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {filters.datePreset === 'custom' && (
                <div className="mt-2 pt-2 border-t border-slate-100 space-y-2">
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-0.5">From</label>
                    <input
                      type="date"
                      value={filters.fromDate || ''}
                      onChange={e => onChange({ fromDate: e.target.value })}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-0.5">To</label>
                    <input
                      type="date"
                      value={filters.toDate || ''}
                      onChange={e => onChange({ toDate: e.target.value })}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDatePickerOpen(false)}
                    className="w-full mt-1 py-1 bg-[#1A56DB] text-white rounded text-xs font-semibold"
                  >
                    Apply Range
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 6. Clear Filters Button */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-rose-600 hover:text-rose-700 font-semibold hover:underline cursor-pointer shrink-0"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}

export default AssetFilters
