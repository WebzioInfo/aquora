import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Eye,
  Edit2,
  UserCheck,
  Truck,
  Wrench,
  TrendingDown,
  Archive,
  Trash2,
  MoreVertical
} from 'lucide-react'
import type { DetailedAsset } from '../../../../services/assets'

interface AssetRowActionsProps {
  asset: DetailedAsset
  canManage: boolean
  canDelete: boolean
  onView: () => void
  onEdit: () => void
  onAssign: () => void
  onTransfer: () => void
  onMaintenance: () => void
  onDepreciation: () => void
  onDispose: () => void
  onDelete: () => void
}

export const AssetRowActions: React.FC<AssetRowActionsProps> = ({
  asset,
  canManage,
  canDelete,
  onView,
  onEdit,
  onAssign,
  onTransfer,
  onMaintenance,
  onDepreciation,
  onDispose,
  onDelete
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; right: number; placeAbove?: boolean }>({ top: 0, right: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const isHistorical = ['disposed', 'retired'].includes(asset.currentStatus.toLowerCase())

  const updatePosition = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const menuHeight = isHistorical ? 120 : 310
    const spaceBelow = window.innerHeight - rect.bottom
    const placeAbove = spaceBelow < menuHeight && rect.top > menuHeight

    const top = placeAbove ? rect.top - menuHeight - 4 : rect.bottom + 4
    const right = window.innerWidth - rect.right

    setCoords({ top, right, placeAbove })
  }

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isOpen) {
      updatePosition()
    }
    setIsOpen(prev => !prev)
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

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isHistorical])

  const handleAction = (action: () => void) => {
    setIsOpen(false)
    action()
  }

  return (
    <div className="flex items-center justify-end gap-1 select-none">
      {/* Primary Action: View Details */}
      <button
        type="button"
        onClick={onView}
        title="View Details"
        aria-label="View Details"
        className="p-1.5 text-slate-500 hover:text-[#1A56DB] hover:bg-blue-50/80 active:bg-blue-100 rounded-lg transition-colors border border-transparent hover:border-blue-200/60 cursor-pointer"
      >
        <Eye className="w-3.5 h-3.5" />
      </button>

      {/* Secondary Action: Edit Asset */}
      <button
        type="button"
        disabled={!canManage || isHistorical}
        onClick={onEdit}
        title={isHistorical ? "Disposed assets cannot be edited" : "Edit Asset"}
        aria-label="Edit Asset"
        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50/80 active:bg-blue-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 disabled:cursor-not-allowed rounded-lg transition-colors border border-transparent hover:border-blue-200/60 cursor-pointer"
      >
        <Edit2 className="w-3.5 h-3.5" />
      </button>

      {/* More Actions Dropdown Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleDropdown}
        title="More actions"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 rounded-lg transition-colors border border-transparent hover:border-slate-200 cursor-pointer ${
          isOpen ? 'bg-slate-100 text-slate-900 border-slate-200' : ''
        }`}
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>

      {/* Floating Modern Action Menu */}
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-orientation="vertical"
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              right: `${coords.right}px`,
              zIndex: 9999
            }}
            className="w-56 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1.5 text-xs text-slate-700 font-medium animate-in fade-in zoom-in-95 duration-100"
          >
            {/* Header info in menu */}
            <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] uppercase tracking-wider font-bold text-slate-400">
              Actions · {asset.assetTag || asset.assetCode}
            </div>

            <div className="py-1">
              {/* View details (also accessible in dropdown) */}
              <button
                type="button"
                role="menuitem"
                onClick={() => handleAction(onView)}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 hover:text-[#1A56DB] text-left transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#1A56DB]" />
                <span>View Details</span>
              </button>

              {/* Edit asset */}
              {(!isHistorical || canManage) && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={!canManage || isHistorical}
                  onClick={() => handleAction(onEdit)}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-700 text-left transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Edit Asset</span>
                </button>
              )}

              {/* Active operations - only if not historical */}
              {!isHistorical && (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!canManage}
                    onClick={() => handleAction(onAssign)}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-emerald-50/80 hover:text-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-left transition-colors cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Assign Employee</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    disabled={!canManage}
                    onClick={() => handleAction(onTransfer)}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-indigo-50/80 hover:text-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-left transition-colors cursor-pointer"
                  >
                    <Truck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Transfer Asset</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    disabled={!canManage}
                    onClick={() => handleAction(onDepreciation)}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-purple-50/80 hover:text-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-left transition-colors cursor-pointer"
                  >
                    <TrendingDown className="w-3.5 h-3.5 text-purple-600" />
                    <span>Record Depreciation</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    disabled={!canManage}
                    onClick={() => handleAction(onMaintenance)}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-amber-50/80 hover:text-amber-800 disabled:opacity-40 disabled:cursor-not-allowed text-left transition-colors cursor-pointer"
                  >
                    <Wrench className="w-3.5 h-3.5 text-amber-600" />
                    <span>Maintenance</span>
                  </button>
                </>
              )}
            </div>

            {/* Destructive / Lifecycle Section */}
            <div className="border-t border-slate-100 pt-1 mt-0.5">
              {!isHistorical && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={!canManage}
                  onClick={() => handleAction(onDispose)}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-amber-700 hover:bg-amber-50/80 disabled:opacity-40 disabled:cursor-not-allowed text-left transition-colors cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5 text-amber-600" />
                  <span>Dispose Asset</span>
                </button>
              )}

              <button
                type="button"
                role="menuitem"
                disabled={!canDelete}
                onClick={() => handleAction(onDelete)}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-rose-600 hover:bg-rose-50/80 disabled:opacity-40 disabled:cursor-not-allowed text-left transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default AssetRowActions
