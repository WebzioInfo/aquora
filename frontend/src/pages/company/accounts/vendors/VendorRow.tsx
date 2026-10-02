import React, { useState, useRef, useEffect } from 'react'
import {
  Phone, Mail, MoreVertical, CreditCard, Edit2, FileText,
  Trash2, UserX, UserCheck, Eye, Printer, AlertCircle
} from 'lucide-react'
import type { Vendor } from '../../../../services/vendors'
import {
  formatINR,
  getVendorInitials,
  getAvatarColor,
  calculateShareOfPayable
} from './vendorHelpers'

interface VendorRowProps {
  vendor: Vendor
  isSelected: boolean
  onToggleSelect: (id: string, e: React.MouseEvent) => void
  onRowClick: (vendor: Vendor) => void
  onOpenEdit: (vendor: Vendor) => void
  onOpenPayment: (vendor: Vendor) => void
  onPrintStatement: (vendor: Vendor) => void
  onToggleStatus: (vendor: Vendor) => void
  onDelete: (vendor: Vendor) => void
  totalPayableAll: number
  canWrite?: boolean
}

export const VendorRow: React.FC<VendorRowProps> = ({
  vendor,
  isSelected,
  onToggleSelect,
  onRowClick,
  onOpenEdit,
  onOpenPayment,
  onPrintStatement,
  onToggleStatus,
  onDelete,
  totalPayableAll,
  canWrite = true
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const avatar = getAvatarColor(vendor.name)
  const initials = getVendorInitials(vendor.name)
  const outstanding = vendor.currentBalance || 0
  const sharePercent = calculateShareOfPayable(outstanding, totalPayableAll)

  const hasHistory = (vendor.totalPurchasesCount || 0) > 0 || (vendor.openingBalance || 0) > 0

  return (
    <tr
      onClick={() => onRowClick(vendor)}
      className={`group border-b border-[#E5E9F2] transition-colors cursor-pointer select-none ${
        isSelected ? 'bg-blue-50/50 hover:bg-blue-50/70' : 'hover:bg-slate-50/80 bg-white'
      }`}
    >
      {/* 1. Checkbox */}
      <td
        className="w-10 px-3 py-2.5 text-center"
        onClick={e => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          onClick={e => onToggleSelect(vendor.id, e)}
          className="w-4 h-4 rounded border-slate-300 text-[#1A56DB] focus:ring-0 focus:outline-none cursor-pointer"
        />
      </td>

      {/* 2. Vendor (Avatar, Name, Subtitle) */}
      <td className="px-3 py-2.5 max-w-[260px] min-w-[180px]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border"
            style={{ backgroundColor: avatar.bg, color: avatar.text, borderColor: avatar.border }}
          >
            {initials}
          </div>

          <div className="min-w-0">
            <span className="font-medium text-slate-900 truncate block text-xs" title={vendor.name}>
              {vendor.name}
            </span>

            {/* Secondary line */}
            <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
              {vendor.address ? (
                <span className="truncate max-w-[140px]">{vendor.address}</span>
              ) : (
                <span className="font-mono">{vendor.vendorCode || 'VND'}</span>
              )}
              {vendor.gst && (
                <>
                  <span>·</span>
                  <span className="font-mono text-[10px] text-slate-600">GST {vendor.gst}</span>
                </>
              )}
            </div>

            {/* Mobile/Tablet: Phone under vendor name */}
            <div className="lg:hidden text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>{vendor.phone || '—'}</span>
            </div>
          </div>
        </div>
      </td>

      {/* 3. Contact (Hidden on <1024px) */}
      <td className="px-3 py-2.5 hidden lg:table-cell max-w-[200px]">
        <div className="space-y-0.5 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-700">
            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{vendor.phone || '—'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate" title={vendor.email || ''}>
              {vendor.email || '—'}
            </span>
          </div>
        </div>
      </td>

      {/* 4. Purchases */}
      <td className="px-3 py-2.5 text-right whitespace-nowrap">
        <span className="font-medium text-slate-900 block text-xs">
          {vendor.totalPurchasesCount || 0} {vendor.totalPurchasesCount === 1 ? 'order' : 'orders'}
        </span>
        <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
          {formatINR(vendor.totalPurchaseValue || 0)}
        </span>
      </td>

      {/* 5. Outstanding & Pay button */}
      <td className="px-3 py-2.5 min-w-[160px] text-right">
        <div className="flex items-center justify-end gap-2">
          <span
            className={`font-mono text-xs font-semibold ${
              outstanding > 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {formatINR(outstanding)}
          </span>

          {outstanding > 0 && canWrite && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                onOpenPayment(vendor)
              }}
              className="h-[22px] px-2 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] border border-rose-200/80 cursor-pointer shadow-2xs transition-colors shrink-0"
              title="Record payment for vendor"
            >
              Pay
            </button>
          )}
        </div>

        {/* Share of Payable progress bar & text */}
        {outstanding > 0 && sharePercent > 0 && (
          <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-slate-500">
            <div className="w-14 h-[3px] bg-slate-100 rounded-full overflow-hidden shrink-0">
              <div
                className="h-full bg-rose-500 rounded-full"
                style={{ width: `${Math.min(100, Math.max(5, sharePercent))}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-slate-400">{sharePercent}% of total</span>
          </div>
        )}
      </td>

      {/* 6. Status */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            vendor.isActive
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
              : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          {vendor.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>

      {/* 7. Row Menu (⋮) */}
      <td
        className="w-10 px-2 py-2.5 text-center relative"
        onClick={e => e.stopPropagation()}
      >
        <div ref={menuRef} className="relative inline-block text-left">
          <button
            type="button"
            onClick={() => setMenuOpen(prev => !prev)}
            aria-label="More actions"
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30 text-xs text-left animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onRowClick(vendor)
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                <span>View ledger</span>
              </button>

              {canWrite && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onOpenEdit(vendor)
                  }}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Edit</span>
                </button>
              )}

              {outstanding > 0 && canWrite && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onOpenPayment(vendor)
                  }}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-[#1A56DB] hover:bg-blue-50 cursor-pointer font-medium"
                >
                  <CreditCard className="w-3.5 h-3.5 text-[#1A56DB]" />
                  <span>Record payment</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onPrintStatement(vendor)
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-400" />
                <span>Print statement</span>
              </button>

              <div className="my-1 border-t border-slate-100" />

              {canWrite && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onToggleStatus(vendor)
                  }}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {vendor.isActive ? (
                    <>
                      <UserX className="w-3.5 h-3.5 text-amber-500" />
                      <span>Deactivate</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Activate</span>
                    </>
                  )}
                </button>
              )}

              {canWrite && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    if (!hasHistory) {
                      onDelete(vendor)
                    }
                  }}
                  disabled={hasHistory}
                  title={hasHistory ? 'Cannot delete vendor with purchase history or opening balance' : 'Delete vendor'}
                  className={`w-full px-3 py-1.5 flex items-center gap-2 ${
                    hasHistory
                      ? 'text-slate-400 cursor-not-allowed opacity-60'
                      : 'text-rose-600 hover:bg-rose-50 cursor-pointer'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

export default VendorRow
