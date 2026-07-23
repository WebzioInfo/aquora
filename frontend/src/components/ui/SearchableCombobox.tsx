import React, { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Search, X, Check } from 'lucide-react'

export interface SearchableComboboxProps<T> {
  label: string
  items: T[]
  value: string
  onChange: (value: string, item: T | undefined) => void
  primaryKey: keyof T
  searchKeys: (keyof T)[]
  displayValue: (item: T) => string
  renderOption: (item: T) => React.ReactNode
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
}

export function SearchableCombobox<T>({
  label,
  items,
  value,
  onChange,
  primaryKey,
  searchKeys,
  displayValue,
  renderOption,
  placeholder = 'Search...',
  disabled = false,
  required = false,
  className = ''
}: SearchableComboboxProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isOpen])

  const filteredItems = useMemo(() => {
    if (!searchTerm) return items
    const lowerSearch = searchTerm.toLowerCase()
    return items.filter(item => {
      return searchKeys.some(key => {
        const val = item[key]
        if (typeof val === 'string' || typeof val === 'number') {
          return String(val).toLowerCase().includes(lowerSearch)
        }
        return false
      })
    })
  }, [items, searchTerm, searchKeys])

  const selectedItem = items.find(item => String(item[primaryKey]) === value)

  const handleSelect = (item: T) => {
    onChange(String(item[primaryKey]), item)
    setIsOpen(false)
    setSearchTerm('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('', undefined)
    setSearchTerm('')
  }

  return (
    <div className={`flex flex-col gap-1 text-left ${className}`} ref={containerRef}>
      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`w-full h-[38px] px-3 bg-white border rounded-[8px] text-left text-[13px] flex items-center justify-between transition-colors
            ${isOpen ? 'border-blue-500 ring-2 ring-blue-50' : 'border-slate-300 hover:border-slate-400'}
            ${disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'text-slate-900 cursor-pointer'}
          `}
        >
          <span className={`block truncate ${!selectedItem ? 'text-slate-400 font-semibold' : 'font-black text-slate-800'}`}>
            {selectedItem ? displayValue(selectedItem) : placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {selectedItem && !disabled && (
              <div
                onClick={handleClear}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </div>
            )}
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-[10px] shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Type to search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-[6px] focus:outline-none focus:border-blue-500 focus:bg-white transition-colors text-slate-800 font-semibold"
                />
              </div>
            </div>
            
            <div className="max-h-72 overflow-y-auto p-1">
              {filteredItems.length === 0 ? (
                <div className="p-3 text-center text-[12px] font-semibold text-slate-500">
                  {searchTerm ? 'No matching records found.' : 'No records available.'}
                </div>
              ) : (
                filteredItems.map(item => {
                  const isSelected = value === String(item[primaryKey])
                  return (
                    <button
                      key={String(item[primaryKey])}
                      type="button"
                      onClick={() => handleSelect(item)}
                      className={`w-full flex items-center justify-between p-2 text-left rounded-[6px] transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        {renderOption(item)}
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
