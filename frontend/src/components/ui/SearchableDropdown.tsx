import React, { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Search, X, Check } from 'lucide-react'

export interface SearchableDropdownProps {
  label: string
  value: string
  onChange: (value: string) => void
  items?: { id: string; name: string }[]
  options?: { id: string; name: string }[]
  placeholder?: string
  isLoading?: boolean
  disabled?: boolean
  required?: boolean
  labelRight?: React.ReactNode
}

export const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  label,
  value,
  onChange,
  items,
  options,
  placeholder = 'Select...',
  isLoading = false,
  disabled = false,
  required = false,
  labelRight
}) => {
  const dropdownItems = useMemo(() => items || options || [], [items, options])
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
    if (!searchTerm) return dropdownItems
    const lowerSearch = searchTerm.toLowerCase()
    return dropdownItems.filter(item => item.name.toLowerCase().includes(lowerSearch))
  }, [dropdownItems, searchTerm])

  const selectedItem = dropdownItems.find(item => item.id === value)

  const handleSelect = (id: string) => {
    onChange(id)
    setIsOpen(false)
    setSearchTerm('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setSearchTerm('')
  }

  return (
    <div className="flex flex-col gap-1.5 text-left" ref={containerRef}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="text-xs font-semibold text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {labelRight}
      </div>
      
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`w-full h-10 px-3 bg-white border rounded-[10px] text-left text-sm flex items-center justify-between transition-colors
            ${isOpen ? 'border-[#1A56DB] ring-2 ring-blue-50' : 'border-gray-200 hover:border-gray-300'}
            ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'text-gray-900 cursor-pointer'}
          `}
        >
          <span className={`block truncate ${!selectedItem ? 'text-gray-400' : ''}`}>
            {selectedItem ? selectedItem.name : placeholder}
          </span>
          <div className="flex items-center gap-1">
            {selectedItem && !disabled && (
              <div
                onClick={handleClear}
                className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </div>
            )}
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-[10px] shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 text-sm bg-gray-50 border border-gray-200 rounded-[8px] focus:outline-none focus:border-[#1A56DB] focus:bg-white transition-colors"
                />
              </div>
            </div>
            
            <div className="max-h-60 overflow-y-auto p-1">
              {isLoading ? (
                <div className="p-3 text-center text-sm text-gray-500">Loading...</div>
              ) : filteredItems.length === 0 ? (
                <div className="p-3 text-center text-sm text-gray-500">
                  {searchTerm ? 'No matches found.' : 'No items available.'}
                </div>
              ) : (
                filteredItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-left rounded-[6px] hover:bg-gray-50 transition-colors"
                  >
                    <span className="truncate pr-4">{item.name}</span>
                    {value === item.id && <Check className="w-4 h-4 text-[#1A56DB]" />}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
