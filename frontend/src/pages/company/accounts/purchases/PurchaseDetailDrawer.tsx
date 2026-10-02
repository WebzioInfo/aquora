import React, { useEffect, useState, useRef } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Printer,
  Edit2,
  Copy,
  CreditCard,
  XCircle,
  Trash2,
  Calendar,
  Building2,
  User,
  CreditCard as PaymentIcon,
  Tag,
  Clock,
  Layers
} from 'lucide-react'
import { purchaseService, type Purchase, type PurchaseItem, type PurchasePayment } from '../../../../services/purchases'
import { CategoryPill } from '../expenses/categoryMeta'
import { formatINR, getStatusStyle } from './purchaseHelpers'

interface PurchaseDetailDrawerProps {
  isOpen: boolean
  purchase: Purchase | null
  onClose: () => void
  onNavigatePrev?: () => void
  onNavigateNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
  onEdit: (purchase: Purchase) => void
  onPrint: (purchase: Purchase) => void
  onDuplicate: (purchase: Purchase) => void
  onRecordPayment: (purchase: Purchase) => void
  onCancel: (purchase: Purchase) => void
  onDelete: (purchase: Purchase) => void
  canWrite: boolean
}

export const PurchaseDetailDrawer: React.FC<PurchaseDetailDrawerProps> = ({
  isOpen,
  purchase,
  onClose,
  onNavigatePrev,
  onNavigateNext,
  hasPrev = false,
  hasNext = false,
  onEdit,
  onPrint,
  onDuplicate,
  onRecordPayment,
  onCancel,
  onDelete,
  canWrite
}) => {
  const [fullPurchase, setFullPurchase] = useState<Purchase | null>(null)
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const lastActiveElementRef = useRef<HTMLElement | null>(null)

  // Save focus when opened, restore when closed
  useEffect(() => {
    if (isOpen) {
      lastActiveElementRef.current = document.activeElement as HTMLElement
      drawerRef.current?.focus()
    } else {
      lastActiveElementRef.current?.focus()
    }
  }, [isOpen])

  // Fetch full details whenever purchase ID changes
  useEffect(() => {
    if (isOpen && purchase?.id) {
      setFullPurchase(purchase)
      setLoadingDetails(true)
      purchaseService
        .getPurchaseById(purchase.id)
        .then((data) => {
          if (data) setFullPurchase(data)
        })
        .catch(() => {
          // Keep fallback to initial purchase if error
        })
        .finally(() => {
          setLoadingDetails(false)
        })
    } else {
      setFullPurchase(null)
    }
  }, [isOpen, purchase?.id])

  // Keyboard navigation & Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft' && hasPrev && onNavigatePrev) {
        onNavigatePrev()
      } else if (e.key === 'ArrowRight' && hasNext && onNavigateNext) {
        onNavigateNext()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, hasPrev, hasNext, onNavigatePrev, onNavigateNext, onClose])

  if (!isOpen || !purchase) return null

  const p = fullPurchase || purchase
  const isCancelled = p.isCancelled || p.paymentStatus === 'Cancelled'
  const statusStyle = getStatusStyle(p.paymentStatus, p.isCancelled)

  const dateFormatted = new Date(p.purchaseDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })

  const gross = p.grandTotal || 0
  const paid = p.amountPaid || 0
  const balance = p.balanceAmount || 0

  const items: PurchaseItem[] = p.items || []
  const payments: PurchasePayment[] = p.payments || []

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Slide-over panel: 480px on desktop, full-screen on mobile */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div
          ref={drawerRef}
          tabIndex={-1}
          className="w-screen max-w-[480px] bg-white shadow-2xl flex flex-col focus:outline-none animate-in slide-in-from-right duration-200"
        >
          {/* 1. Header: Purchase number, Prev/Next, Status pill, Close */}
          <div className="px-5 py-4 border-b border-[#E5E9F2] bg-[#F8FAFC] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-sm text-slate-900 font-mono truncate">
                {p.purchaseNo}
              </span>
              {p.invoiceNumber && (
                <span className="text-[11px] font-mono text-slate-500 bg-slate-200/80 px-1.5 py-0.5 rounded font-medium truncate">
                  #{p.invoiceNumber}
                </span>
              )}
              <span
                style={{
                  backgroundColor: statusStyle.bg,
                  color: statusStyle.text,
                  borderColor: statusStyle.border
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border shrink-0"
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusStyle.dot }} />
                {statusStyle.label}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Prev / Next controls */}
              <button
                type="button"
                disabled={!hasPrev}
                onClick={onNavigatePrev}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Previous purchase (Left arrow)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={!hasNext}
                onClick={onNavigateNext}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Next purchase (Right arrow)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="h-4 w-[1px] bg-slate-200 mx-1" />

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2. Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
            {/* Summary Block */}
            <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E5E9F2] space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Vendor
                  </span>
                  <span className="text-sm font-bold text-slate-900 block mt-0.5">
                    {p.vendorName || 'General Vendor'}
                  </span>
                  {p.vendorCode && (
                    <span className="text-[11px] font-mono text-slate-500 font-medium">
                      Code: {p.vendorCode}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Purchase Date
                  </span>
                  <span className="text-xs font-semibold text-slate-800 font-mono block mt-0.5">
                    {dateFormatted}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Category
                  </span>
                  <CategoryPill category={p.purchaseCategory} size="sm" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Payment Method
                  </span>
                  <span className="text-xs font-semibold text-slate-800">
                    {p.paymentMethod || 'Bank'}
                  </span>
                </div>
              </div>

              {p.createdByName && (
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Created By</span>
                  <span className="font-medium text-slate-700">{p.createdByName}</span>
                </div>
              )}

              {p.notes && (
                <div className="pt-2 border-t border-slate-200/60 text-[11px]">
                  <span className="font-bold text-slate-400 block mb-0.5 uppercase tracking-wider text-[10px]">
                    Remarks / Notes
                  </span>
                  <p className="text-slate-600 italic">{p.notes}</p>
                </div>
              )}
            </div>

            {/* Line Items Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  Line Items ({items.length})
                </span>
              </div>

              {items.length > 0 ? (
                <div className="border border-[#E5E9F2] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E5E9F2] text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        <th className="px-3 py-2">Item / Material</th>
                        <th className="px-2 py-2 text-right">Qty</th>
                        <th className="px-2 py-2 text-right">Rate</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E9F2]">
                      {items.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 text-slate-800 font-medium">
                            <div>
                              <span>{item.rawMaterialName || item.itemName || 'Raw Material Item'}</span>
                              {item.unit && (
                                <span className="text-[10px] text-slate-400 block">{item.unit}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right font-mono text-slate-700">
                            {item.quantity} {item.unit || ''}
                          </td>
                          <td className="px-2 py-2 text-right font-mono text-slate-700">
                            {formatINR(item.unitPrice)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">
                            {formatINR(item.totalAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center text-slate-400 text-xs">
                  {loadingDetails ? 'Loading items...' : 'No itemized line items recorded'}
                </div>
              )}

              {/* Totals under line items: gross, paid, balance */}
              <div className="mt-3 p-3 bg-white border border-[#E5E9F2] rounded-xl space-y-1.5 font-medium">
                <div className="flex justify-between text-slate-600">
                  <span>Gross Total</span>
                  <span className="font-mono font-bold text-slate-900">{formatINR(gross)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Paid Amount</span>
                  <span className="font-mono font-semibold text-slate-800">{formatINR(paid)}</span>
                </div>
                <div className="pt-1.5 border-t border-slate-100 flex justify-between font-bold">
                  <span className={balance > 0 ? 'text-rose-600' : 'text-slate-800'}>
                    Outstanding Balance
                  </span>
                  <span className={`font-mono text-sm ${balance > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                    {formatINR(balance)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment History List (only if payments exist) */}
            {payments.length > 0 && (
              <div>
                <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block mb-2">
                  Payment History ({payments.length})
                </span>
                <div className="space-y-2">
                  {payments.map((pmt) => (
                    <div
                      key={pmt.id}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-slate-900 block text-xs">
                          {pmt.paymentMethod} {pmt.bankAccountName ? `· ${pmt.bankAccountName}` : pmt.cashBookName ? `· ${pmt.cashBookName}` : ''}
                        </span>
                        <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                          <span>{new Date(pmt.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          {pmt.referenceNo && (
                            <>
                              <span className="mx-1">·</span>
                              <span className="font-mono text-slate-600">Ref: {pmt.referenceNo}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-emerald-700 text-xs block">
                          {formatINR(pmt.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. Footer Actions */}
          <div className="p-4 border-t border-[#E5E9F2] bg-[#F8FAFC] space-y-2 shrink-0">
            {/* Primary & Secondary Action Row */}
            <div className="flex items-center gap-2">
              {canWrite && !isCancelled && balance > 0 && (
                <button
                  type="button"
                  onClick={() => onRecordPayment(p)}
                  className="flex-1 h-[36px] px-3 text-xs font-semibold text-white bg-[#1A56DB] hover:bg-[#1746B3] rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Record Payment
                </button>
              )}

              {canWrite && !isCancelled && (
                <button
                  type="button"
                  onClick={() => onEdit(p)}
                  className="h-[36px] px-3 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Edit Purchase"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onPrint(p)}
                className="h-[36px] px-3 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Print Invoice"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>

              {canWrite && (
                <button
                  type="button"
                  onClick={() => onDuplicate(p)}
                  className="h-[36px] px-3 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Duplicate Purchase"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Danger Row: Cancel & Delete as text buttons */}
            {canWrite && (
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200/60">
                {!isCancelled && (
                  <button
                    type="button"
                    onClick={() => onCancel(p)}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-900 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <XCircle className="w-3 h-3 text-amber-600" />
                    Cancel purchase
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDelete(p)}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3 text-rose-500" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
