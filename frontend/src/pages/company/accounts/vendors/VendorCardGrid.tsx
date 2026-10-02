import React from 'react'
import { Phone, Mail, Building2, CreditCard, MoreVertical, Edit2, Printer, UserX, UserCheck, Trash2 } from 'lucide-react'
import type { Vendor } from '../../../../services/vendors'
import { formatINR, getVendorInitials, getAvatarColor, calculateShareOfPayable } from './vendorHelpers'

interface VendorCardGridProps {
  vendors: Vendor[]
  selectedIds: Set<string>
  onToggleSelect: (id: string, e: React.MouseEvent) => void
  onCardClick: (vendor: Vendor) => void
  onOpenEdit: (vendor: Vendor) => void
  onOpenPayment: (vendor: Vendor) => void
  onPrintStatement: (vendor: Vendor) => void
  onToggleStatus: (vendor: Vendor) => void
  onDelete: (vendor: Vendor) => void
  totalPayableAll: number
  canWrite?: boolean
}

export const VendorCardGrid: React.FC<VendorCardGridProps> = ({
  vendors,
  selectedIds,
  onToggleSelect,
  onCardClick,
  onOpenEdit,
  onOpenPayment,
  onPrintStatement,
  onToggleStatus,
  onDelete,
  totalPayableAll,
  canWrite = true
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3 select-none">
      {vendors.map(vendor => {
        const isSelected = selectedIds.has(vendor.id)
        const avatar = getAvatarColor(vendor.name)
        const initials = getVendorInitials(vendor.name)
        const outstanding = vendor.currentBalance || 0
        const sharePercent = calculateShareOfPayable(outstanding, totalPayableAll)

        return (
          <div
            key={vendor.id}
            onClick={() => onCardClick(vendor)}
            className={`bg-white border rounded-xl p-3.5 flex flex-col justify-between transition-all cursor-pointer hover:shadow-xs hover:border-slate-300 relative ${
              isSelected ? 'border-[#1A56DB] bg-blue-50/20 ring-1 ring-[#1A56DB]' : 'border-[#E5E9F2]'
            }`}
          >
            <div>
              {/* Top row: Checkbox, Avatar, Name, Status */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    onClick={e => onToggleSelect(vendor.id, e)}
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-[#1A56DB] focus:ring-0 cursor-pointer shrink-0"
                  />

                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border"
                    style={{ backgroundColor: avatar.bg, color: avatar.text, borderColor: avatar.border }}
                  >
                    {initials}
                  </div>

                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 text-xs truncate" title={vendor.name}>
                      {vendor.name}
                    </h3>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {vendor.vendorCode || 'VND'}
                    </div>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                    vendor.isActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {vendor.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Location & GST */}
              <div className="mt-2.5 space-y-1 text-[11px] text-slate-500">
                {vendor.address && (
                  <p className="truncate text-slate-600">{vendor.address}</p>
                )}
                <div className="flex items-center gap-2">
                  {vendor.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      {vendor.phone}
                    </span>
                  )}
                  {vendor.gst && (
                    <span className="font-mono text-[10px] text-slate-400">GST: {vendor.gst}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom: Purchases summary and Outstanding */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-end justify-between text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Purchases</span>
                <span className="font-medium text-slate-800">
                  {vendor.totalPurchasesCount || 0} orders ·{' '}
                  <span className="font-mono font-semibold">{formatINR(vendor.totalPurchaseValue || 0)}</span>
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Outstanding</span>
                <div className="flex items-center gap-1.5 justify-end">
                  <span className={`font-mono font-bold ${outstanding > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                    {formatINR(outstanding)}
                  </span>
                  {outstanding > 0 && canWrite && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        onOpenPayment(vendor)
                      }}
                      className="h-[22px] px-2 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] border border-rose-200/80 cursor-pointer shadow-2xs"
                    >
                      Pay
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default VendorCardGrid
