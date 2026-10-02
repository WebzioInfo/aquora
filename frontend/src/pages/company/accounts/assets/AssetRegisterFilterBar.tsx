import React, { useState } from 'react'
import { Search, X } from 'lucide-react'

export interface AssetRegisterFiltersProps {
  status: string
  category: string
  condition: string
  datePreset: string
  fromDate?: string
  toDate?: string
  search: string
  categories: string[]
  onStatusChange: (status: string) => void
  onCategoryChange: (category: string) => void
  onConditionChange: (condition: string) => void
  onDatePresetChange: (preset: string) => void
  onCustomDateChange: (from: string, to: string) => void
  onSearchChange: (search: string) => void
  onClearFilters: () => void
  hasActiveFilters: boolean
}

export const DATE_PRESETS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' }
]

export const AssetRegisterFilterBar: React.FC<AssetRegisterFiltersProps> = ({
  status,
  category,
  condition,
  datePreset,
  fromDate = '',
  toDate = '',
  search,
  categories,
  onStatusChange,
  onCategoryChange,
  onConditionChange,
  onDatePresetChange,
  onCustomDateChange,
  onSearchChange,
  onClearFilters,
  hasActiveFilters
}) => {
  const [searchInput, setSearchInput] = useState(search)
  const [customFrom, setCustomFrom] = useState(fromDate)
  const [customTo, setCustomTo] = useState(toDate)

  // Keep local search input in sync if reset externally
  React.useEffect(() => {
    setSearchInput(search)
  }, [search])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearchChange(searchInput.trim())
  }

  const handleApplyCustomDate = () => {
    onCustomDateChange(customFrom, customTo)
  }

  return (
    <div className="p-2 sm:px-3 sm:py-2 border border-slate-200/90 shadow-xs w-full bg-white rounded-xl shrink-0 select-none">
      <div className="flex flex-wrap items-center justify-between gap-2 w-full">
        {/* Left / Middle Group */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {/* Segmented Status Toggle (All / Active / Maintenance / Disposed) */}
          <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/60 shadow-inner shrink-0">
            <button
              type="button"
              onClick={() => onStatusChange('ALL')}
              className={`py-1 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
                status === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => onStatusChange('Active')}
              className={`py-1 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
                status === 'Active'
                  ? 'bg-slate-900 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => onStatusChange('UnderMaintenance')}
              className={`py-1 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
                status === 'UnderMaintenance'
                  ? 'bg-slate-900 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Maintenance
            </button>
            <button
              type="button"
              onClick={() => onStatusChange('Disposed')}
              className={`py-1 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
                status === 'Disposed'
                  ? 'bg-slate-900 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Disposed
            </button>
          </div>

          {/* Categories Selector */}
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="h-[32px] px-2 text-xs bg-white border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[150px] truncate shrink-0"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Condition Selector */}
          <select
            value={condition}
            onChange={(e) => onConditionChange(e.target.value)}
            className="h-[32px] px-2 text-xs bg-white border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[140px] truncate shrink-0"
          >
            <option value="ALL">All Conditions</option>
            <option value="Excellent">Excellent</option>
            <option value="Good">Good</option>
            <option value="Fair">Fair</option>
            <option value="NeedsRepair">Needs Repair</option>
            <option value="Critical">Critical</option>
          </select>

          {/* Date Preset Selector */}
          <select
            value={datePreset}
            onChange={(e) => onDatePresetChange(e.target.value)}
            className="h-[32px] px-2 text-xs bg-white border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer shrink-0"
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          {/* Custom Date Inputs if custom is selected */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200 shrink-0">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-[26px] px-1.5 text-xs border border-slate-200 rounded bg-white focus:outline-none"
              />
              <span className="text-[10px] text-slate-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-[26px] px-1.5 text-xs border border-slate-200 rounded bg-white focus:outline-none"
              />
              <button
                type="button"
                onClick={handleApplyCustomDate}
                className="h-[26px] px-2 text-xs bg-[#1A56DB] text-white rounded font-medium hover:bg-[#1746B3] cursor-pointer"
              >
                Apply
              </button>
            </div>
          )}

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer py-1 px-1.5 shrink-0"
              title="Reset all filters"
            >
              <X className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>

        {/* Right Group: Search Form */}
        <form
          onSubmit={handleSearchSubmit}
          className="flex items-center gap-1.5 w-full sm:w-60 md:w-72 lg:w-80 shrink-0"
        >
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Asset Name, Tag, SN, Model..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full h-[32px] pl-8 pr-6 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-indigo-500 focus:outline-none transition-all"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('')
                  onSearchChange('')
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="h-[32px] px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Search
          </button>
        </form>
      </div>
    </div>
  )
}

export default AssetRegisterFilterBar
