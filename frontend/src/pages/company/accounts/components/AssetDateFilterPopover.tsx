import React, { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown, Check, X, ArrowRight } from 'lucide-react'

export type DateFilterMode = 'all' | 'this_month' | 'last_month' | 'month' | 'custom'

export interface AssetDateFilterState {
  mode: DateFilterMode
  selectedMonth: number // 1 to 12
  selectedYear: number
  fromDate: string // YYYY-MM-DD
  toDate: string // YYYY-MM-DD
}

interface Props {
  value: AssetDateFilterState
  onChange: (filter: AssetDateFilterState) => void
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

// Generate year options around current year (e.g. 2020 - 2030)
const currentYearVal = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => currentYearVal - 5 + i)

export const computeDateRange = (
  mode: DateFilterMode,
  selectedMonth: number,
  selectedYear: number,
  customFrom: string,
  customTo: string
): { fromDate: string; toDate: string; label: string } => {
  const now = new Date()
  const currYear = now.getFullYear()
  const currMonth = now.getMonth() + 1 // 1-12

  if (mode === 'all') {
    return { fromDate: '', toDate: '', label: 'All Dates' }
  }

  if (mode === 'this_month') {
    const lastDay = new Date(currYear, currMonth, 0).getDate()
    const from = `${currYear}-${String(currMonth).padStart(2, '0')}-01`
    const to = `${currYear}-${String(currMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    const mName = MONTH_NAMES[currMonth - 1]
    return { fromDate: from, toDate: to, label: `${mName} ${currYear}` }
  }

  if (mode === 'last_month') {
    let year = currYear
    let month = currMonth - 1
    if (month < 1) {
      month = 12
      year -= 1
    }
    const lastDay = new Date(year, month, 0).getDate()
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    const mName = MONTH_NAMES[month - 1]
    return { fromDate: from, toDate: to, label: `${mName} ${year}` }
  }

  if (mode === 'month') {
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate()
    const from = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
    const to = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    const mName = MONTH_NAMES[selectedMonth - 1]
    return { fromDate: from, toDate: to, label: `${mName} ${selectedYear}` }
  }

  if (mode === 'custom') {
    if (!customFrom && !customTo) {
      return { fromDate: '', toDate: '', label: 'Custom Range' }
    }
    const formatDisplay = (d: string) => {
      if (!d) return ''
      const parts = d.split('-')
      if (parts.length !== 3) return d
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    let label = ''
    if (customFrom && customTo) {
      label = `${formatDisplay(customFrom)} – ${formatDisplay(customTo)}`
    } else if (customFrom) {
      label = `From ${formatDisplay(customFrom)}`
    } else {
      label = `To ${formatDisplay(customTo)}`
    }
    return { fromDate: customFrom, toDate: customTo, label }
  }

  return { fromDate: '', toDate: '', label: 'All Dates' }
}

export const AssetDateFilterPopover: React.FC<Props> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Local draft states for Custom & Month selection
  const [draftMode, setDraftMode] = useState<DateFilterMode>(value.mode)
  const [draftMonth, setDraftMonth] = useState<number>(value.selectedMonth)
  const [draftYear, setDraftYear] = useState<number>(value.selectedYear)
  const [draftFrom, setDraftFrom] = useState<string>(value.fromDate)
  const [draftTo, setDraftTo] = useState<string>(value.toDate)

  // Synchronize draft when props value changes or when opened
  useEffect(() => {
    setDraftMode(value.mode)
    setDraftMonth(value.selectedMonth)
    setDraftYear(value.selectedYear)
    setDraftFrom(value.fromDate)
    setDraftTo(value.toDate)
  }, [value, isOpen])

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const currentRange = computeDateRange(
    value.mode,
    value.selectedMonth,
    value.selectedYear,
    value.fromDate,
    value.toDate
  )

  const handleSelectPreset = (mode: 'all' | 'this_month' | 'last_month') => {
    const range = computeDateRange(mode, draftMonth, draftYear, '', '')
    onChange({
      mode,
      selectedMonth: draftMonth,
      selectedYear: draftYear,
      fromDate: range.fromDate,
      toDate: range.toDate
    })
    setIsOpen(false)
  }

  const handleApplyMonth = () => {
    const range = computeDateRange('month', draftMonth, draftYear, '', '')
    onChange({
      mode: 'month',
      selectedMonth: draftMonth,
      selectedYear: draftYear,
      fromDate: range.fromDate,
      toDate: range.toDate
    })
    setIsOpen(false)
  }

  const handleApplyCustom = () => {
    const range = computeDateRange('custom', draftMonth, draftYear, draftFrom, draftTo)
    onChange({
      mode: 'custom',
      selectedMonth: draftMonth,
      selectedYear: draftYear,
      fromDate: range.fromDate,
      toDate: range.toDate
    })
    setIsOpen(false)
  }

  const isFiltered = value.mode !== 'all'

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* TRIGGER BUTTON */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-2 text-xs border rounded-xl font-medium flex items-center justify-between gap-2 transition-all w-full sm:w-auto min-w-[150px] cursor-pointer ${
          isFiltered
            ? 'border-blue-500 bg-blue-50/60 text-[#1A56DB] shadow-sm font-semibold'
            : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <Calendar className={`w-3.5 h-3.5 shrink-0 ${isFiltered ? 'text-[#1A56DB]' : 'text-slate-400'}`} />
          <span className="truncate">{isFiltered ? currentRange.label : 'Date: All Dates'}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* POPOVER PANEL */}
      {isOpen && (
        <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-4 z-50 text-slate-800 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#1A56DB]" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Filter by Purchase Date
              </span>
            </div>
            {isFiltered && (
              <button
                type="button"
                onClick={() => handleSelectPreset('all')}
                className="text-[11px] text-slate-400 hover:text-slate-700 underline font-medium cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* PRESETS LIST */}
          <div className="space-y-1 mb-3">
            <button
              type="button"
              onClick={() => handleSelectPreset('all')}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                draftMode === 'all'
                  ? 'bg-blue-50 text-[#1A56DB] font-bold'
                  : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <span>All Dates</span>
              {draftMode === 'all' && <Check className="w-3.5 h-3.5 text-[#1A56DB]" />}
            </button>

            <button
              type="button"
              onClick={() => handleSelectPreset('this_month')}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                draftMode === 'this_month'
                  ? 'bg-blue-50 text-[#1A56DB] font-bold'
                  : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <span>This Month</span>
              {draftMode === 'this_month' && <Check className="w-3.5 h-3.5 text-[#1A56DB]" />}
            </button>

            <button
              type="button"
              onClick={() => handleSelectPreset('last_month')}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                draftMode === 'last_month'
                  ? 'bg-blue-50 text-[#1A56DB] font-bold'
                  : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <span>Last Month</span>
              {draftMode === 'last_month' && <Check className="w-3.5 h-3.5 text-[#1A56DB]" />}
            </button>

            <button
              type="button"
              onClick={() => setDraftMode('month')}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                draftMode === 'month'
                  ? 'bg-blue-50 text-[#1A56DB] font-bold'
                  : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <span>Specific Month</span>
              {draftMode === 'month' && <Check className="w-3.5 h-3.5 text-[#1A56DB]" />}
            </button>

            <button
              type="button"
              onClick={() => setDraftMode('custom')}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                draftMode === 'custom'
                  ? 'bg-blue-50 text-[#1A56DB] font-bold'
                  : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <span>Custom Date Range</span>
              {draftMode === 'custom' && <Check className="w-3.5 h-3.5 text-[#1A56DB]" />}
            </button>
          </div>

          {/* CONDITIONAL CONTROLS */}
          {draftMode === 'month' && (
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Month
                  </label>
                  <select
                    value={draftMonth}
                    onChange={(e) => setDraftMonth(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-[#1A56DB]"
                  >
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={name} value={idx + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Year
                  </label>
                  <select
                    value={draftYear}
                    onChange={(e) => setDraftYear(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-[#1A56DB]"
                  >
                    {YEAR_OPTIONS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleApplyMonth}
                className="w-full py-2 bg-[#1A56DB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Apply Month</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {draftMode === 'custom' && (
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={draftFrom}
                    onChange={(e) => setDraftFrom(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-[#1A56DB]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={draftTo}
                    onChange={(e) => setDraftTo(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-[#1A56DB]"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleApplyCustom}
                disabled={!draftFrom && !draftTo}
                className="w-full py-2 bg-[#1A56DB] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Apply Date Range</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
