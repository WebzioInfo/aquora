import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

export interface ActionDropdownItem {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onClick: () => void
  variant?: 'default' | 'danger' | 'warning' | 'info'
  dividerBefore?: boolean
  disabled?: boolean
}

export interface ActionDropdownProps {
  triggerLabel?: string
  triggerIcon?: React.ReactNode
  triggerClassName?: string
  items: ActionDropdownItem[]
  align?: 'left' | 'right'
  disabled?: boolean
}

export const ActionDropdown: React.FC<ActionDropdownProps> = ({
  triggerLabel = 'Actions',
  triggerIcon = <ChevronDown className="w-3 h-3 text-slate-400" />,
  triggerClassName,
  items,
  align = 'right',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left?: number; right?: number }>({ top: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const updatePosition = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const estimatedMenuHeight = items.length * 34 + 16
    const placement = spaceBelow < estimatedMenuHeight && rect.top > estimatedMenuHeight ? 'top' : 'bottom'

    const top = placement === 'bottom' 
      ? rect.bottom + 4 
      : rect.top - estimatedMenuHeight - 4

    if (align === 'right') {
      const right = window.innerWidth - rect.right
      setCoords({ top, right })
    } else {
      const left = rect.left
      setCoords({ top, left })
    }
  }

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isOpen) {
      updatePosition()
    }
    setIsOpen(!isOpen)
  }

  useEffect(() => {
    if (!isOpen) return

    const handleScrollOrResize = () => {
      updatePosition()
    }

    const handleOutsideClick = (e: MouseEvent) => {
      if (triggerRef.current && triggerRef.current.contains(e.target as Node)) {
        return
      }
      if (menuRef.current && menuRef.current.contains(e.target as Node)) {
        return
      }
      setIsOpen(false)
    }

    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    document.addEventListener('mousedown', handleOutsideClick)

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isOpen, items])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        className={triggerClassName || "px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-xs font-medium flex items-center gap-1 ml-auto shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"}
      >
        {triggerLabel} {triggerIcon}
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            ...(coords.right !== undefined ? { right: `${coords.right}px` } : {}),
            ...(coords.left !== undefined ? { left: `${coords.left}px` } : {}),
            zIndex: 9999
          }}
          className="w-48 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in duration-150"
        >
          <div className="p-1 space-y-0.5">
            {items.map((item, idx) => {
              const Icon = item.icon
              const colorClass = 
                item.variant === 'danger' ? 'text-red-600 hover:bg-red-50' :
                item.variant === 'warning' ? 'text-amber-700 hover:bg-amber-50' :
                item.variant === 'info' ? 'text-blue-700 hover:bg-blue-50' :
                'text-slate-700 hover:bg-slate-50'

              return (
                <React.Fragment key={idx}>
                  {item.dividerBefore && <div className="h-px bg-slate-100 my-0.5" />}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsOpen(false)
                      item.onClick()
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs rounded-md flex items-center gap-2 transition-colors font-medium cursor-pointer ${colorClass}`}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                    {item.label}
                  </button>
                </React.Fragment>
              )
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
