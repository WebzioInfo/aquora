import React, { useState, useEffect } from 'react'
import {
  X, ChevronLeft, ChevronRight, Phone, Mail, MapPin, Building2,
  Calendar, FileText, CreditCard, ShoppingBag, ExternalLink, Printer,
  Edit2, UserX, UserCheck, AlertCircle, ArrowUpRight, ArrowDownLeft
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  vendorService,
  type Vendor,
  type VendorDetails,
  type VendorLedgerEntry,
  type VendorTimelineEvent
} from '../../../../services/vendors'
import type { Purchase } from '../../../../services/purchases'
import { formatINR, getVendorInitials, getAvatarColor } from './vendorHelpers'
import { getCategoryMeta } from '../expenses/categoryMeta'
import EnterpriseButton from '../../../../components/ui/EnterpriseButton'

interface VendorDetailDrawerProps {
  isOpen: boolean
  onClose: () => void
  vendor: Vendor | null
  onOpenEdit: (vendor: Vendor) => void
  onOpenPayment: (vendor: Vendor) => void
  onPrintStatement: (vendor: Vendor) => void
  onToggleStatus: (vendor: Vendor) => void
  onPrev?: () => void
  onNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
  canWrite?: boolean
}

type DrawerTab = 'purchases' | 'payments' | 'ledger' | 'details'

export const VendorDetailDrawer: React.FC<VendorDetailDrawerProps> = ({
  isOpen,
  onClose,
  vendor,
  onOpenEdit,
  onOpenPayment,
  onPrintStatement,
  onToggleStatus,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  canWrite = true
}) => {
  const [details, setDetails] = useState<VendorDetails | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<DrawerTab>('purchases')

  useEffect(() => {
    if (isOpen && vendor) {
      setLoading(true)
      vendorService
        .getVendorDetails(vendor.id)
        .then(data => {
          setDetails(data)
        })
        .catch(err => {
          console.error('Failed to load vendor details:', err)
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setDetails(null)
      setActiveTab('purchases')
    }
  }, [isOpen, vendor?.id])

  // Keyboard shortcut Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !vendor) return null

  const avatar = getAvatarColor(vendor.name)
  const initials = getVendorInitials(vendor.name)
  const outstanding = vendor.currentBalance || 0

  // Derived payments from ledger or purchases
  const paymentsList = details?.purchases
    ?.flatMap(p =>
      (p.payments || []).map(pay => ({
        ...pay,
        purchaseNo: p.purchaseNo,
        purchaseId: p.id
      }))
    )
    .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()) || []

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-2xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md sm:max-w-[460px] bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {/* Avatar */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border"
                style={{ backgroundColor: avatar.bg, color: avatar.text, borderColor: avatar.border }}
              >
                {initials}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 truncate" title={vendor.name}>
                    {vendor.name}
                  </h2>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                      vendor.isActive
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {vendor.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 font-mono">
                  <span>{vendor.vendorCode || 'VND'}</span>
                  {vendor.address && (
                    <>
                      <span>·</span>
                      <span className="truncate max-w-[180px] font-sans">{vendor.address}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Prev / Next & Close */}
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {onPrev && (
                <button
                  type="button"
                  onClick={onPrev}
                  disabled={!hasPrev}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-400 hover:bg-slate-100 cursor-pointer"
                  title="Previous vendor"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              {onNext && (
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!hasNext}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-400 hover:bg-slate-100 cursor-pointer"
                  title="Next vendor"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer ml-1"
                title="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-4 text-xs">
            {/* 1. Outstanding Balance Highlight Card */}
            <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/60 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Outstanding Balance
              </span>
              <div className="flex items-baseline justify-between">
                <span
                  className={`text-2xl font-bold font-mono tracking-tight leading-none ${
                    outstanding > 0 ? 'text-rose-600' : 'text-slate-900'
                  }`}
                >
                  {formatINR(outstanding)}
                </span>
                {outstanding > 0 && canWrite && (
                  <EnterpriseButton
                    variant="primary"
                    size="sm"
                    onClick={() => onOpenPayment(vendor)}
                    className="!h-[28px] text-xs font-semibold shadow-xs"
                  >
                    Record payment
                  </EnterpriseButton>
                )}
              </div>
            </div>

            {/* 2. Real Balance Breakdown */}
            <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Balance Breakdown
              </span>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Opening Balance:</span>
                  <span className="font-mono font-medium text-slate-900">{formatINR(vendor.openingBalance || 0)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Total Purchases:</span>
                  <span className="font-mono font-medium text-slate-900">{formatINR(vendor.totalPurchaseValue || 0)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Paid towards Purchases:</span>
                  <span className="font-mono font-medium text-emerald-600">
                    {formatINR(details?.summaryStats?.paidAmount || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Unpaid Purchase Invoices:</span>
                  <span className="font-mono font-medium text-amber-600">
                    {formatINR(details?.summaryStats?.pendingAmount || 0)}
                  </span>
                </div>
                <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between font-semibold text-slate-800">
                  <span>Current Balance:</span>
                  <span className={`font-mono ${outstanding > 0 ? 'text-rose-600 font-bold' : 'text-slate-900'}`}>
                    {formatINR(outstanding)}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Segmented Tab Switcher */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('purchases')}
                className={`py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  activeTab === 'purchases'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Purchases
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('payments')}
                className={`py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  activeTab === 'payments'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Payments
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ledger')}
                className={`py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  activeTab === 'ledger'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Ledger
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className={`py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  activeTab === 'details'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Details
              </button>
            </div>

            {/* Tab 1: Purchases */}
            {activeTab === 'purchases' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs pb-1">
                  <span className="font-semibold text-slate-700">Recent Purchases ({details?.purchases?.length || 0})</span>
                  <Link
                    to={`/company/accounts/purchases?vendorId=${vendor.id}`}
                    className="text-[#1A56DB] hover:underline font-semibold flex items-center gap-1"
                  >
                    <span>View all purchases</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>

                {loading ? (
                  <div className="space-y-2 py-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : !details?.purchases || details.purchases.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    No purchases recorded for this vendor.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {details.purchases.slice(0, 10).map(p => {
                      const cat = p.purchaseCategory || 'Miscellaneous'
                      const meta = getCategoryMeta(cat)
                      const dateStr = new Date(p.purchaseDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })
                      return (
                        <div
                          key={p.id}
                          className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between hover:border-slate-300 transition-colors"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 font-mono">{p.purchaseNo}</span>
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                style={{ backgroundColor: meta.bg, color: meta.text }}
                              >
                                {cat}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2">
                              <span>{dateStr}</span>
                              {p.invoiceNumber && <span>· Inv: {p.invoiceNumber}</span>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-bold font-mono text-slate-900 block">{formatINR(p.grandTotal)}</span>
                            <span
                              className={`text-[10px] font-semibold ${
                                p.paymentStatus === 'Paid'
                                  ? 'text-emerald-600'
                                  : p.paymentStatus === 'Cancelled'
                                  ? 'text-slate-400'
                                  : 'text-amber-600'
                              }`}
                            >
                              {p.paymentStatus || 'Pending'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Payments */}
            {activeTab === 'payments' && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700 pb-1">
                  Payment History ({paymentsList.length})
                </div>

                {loading ? (
                  <div className="space-y-2 py-4">
                    {[1, 2].map(i => (
                      <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : paymentsList.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    No payment records found.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {paymentsList.map(pay => (
                      <div
                        key={pay.id}
                        className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between"
                      >
                        <div className="space-y-1">
                          <span className="font-bold font-mono text-slate-900 block">
                            {pay.referenceNo || `PAY-${pay.id.substring(0, 6)}`}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {new Date(pay.paymentDate).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}{' '}
                            · {pay.paymentMethod || 'Bank'}
                          </span>
                        </div>
                        <span className="font-bold font-mono text-emerald-600">{formatINR(pay.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Ledger */}
            {activeTab === 'ledger' && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700 pb-1">
                  Vendor Ledger Standing
                </div>

                {loading ? (
                  <div className="space-y-2 py-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : !details?.ledger || details.ledger.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    No ledger transactions recorded.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {details.ledger.map((entry, idx) => (
                      <div
                        key={entry.id || idx}
                        className="p-3 bg-white border border-slate-200 rounded-lg space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800">{entry.transactionType}</span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {new Date(entry.date).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-mono">{entry.voucherNo}</span>
                          <div className="flex items-center gap-3">
                            {entry.credit > 0 && (
                              <span className="text-slate-800 font-mono font-semibold">+₹{entry.credit.toLocaleString('en-IN')}</span>
                            )}
                            {entry.debit > 0 && (
                              <span className="text-emerald-600 font-mono font-semibold">-₹{entry.debit.toLocaleString('en-IN')}</span>
                            )}
                            <span className="text-slate-400 font-mono text-[11px]">
                              Bal: ₹{entry.runningBalance?.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                        {entry.remarks && (
                          <p className="text-[11px] text-slate-400 italic">{entry.remarks}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Details */}
            {activeTab === 'details' && (
              <div className="space-y-3">
                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">Contact & Company Info</span>
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => onOpenEdit(vendor)}
                        className="text-[#1A56DB] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-xs pt-1">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{vendor.phone || 'No phone provided'}</span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{vendor.email || 'No email provided'}</span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-600">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>GST: {vendor.gst || 'Non-GST Vendor'}</span>
                    </div>

                    <div className="flex items-start gap-2 text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>{vendor.address || 'No physical address provided'}</span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-600">
                      <CreditCard className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Credit Limit: {vendor.creditLimit ? formatINR(vendor.creditLimit) : 'No limit'}</span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-600">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        Created:{' '}
                        {new Date(vendor.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>

                  {vendor.notes && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Remarks</span>
                      <p className="text-slate-600 text-[11px] leading-relaxed">{vendor.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              {outstanding > 0 && canWrite && (
                <EnterpriseButton
                  variant="primary"
                  size="sm"
                  onClick={() => onOpenPayment(vendor)}
                  className="!h-[32px] text-xs font-semibold shadow-xs"
                >
                  Record payment
                </EnterpriseButton>
              )}

              {canWrite && (
                <EnterpriseButton
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenEdit(vendor)}
                  className="!h-[32px] text-xs font-semibold"
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  Edit
                </EnterpriseButton>
              )}

              <EnterpriseButton
                variant="secondary"
                size="sm"
                onClick={() => onPrintStatement(vendor)}
                className="!h-[32px] text-xs font-semibold"
              >
                <Printer className="w-3.5 h-3.5 mr-1 text-slate-500" />
                Print
              </EnterpriseButton>
            </div>

            {canWrite && (
              <button
                type="button"
                onClick={() => onToggleStatus(vendor)}
                className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
              >
                {vendor.isActive ? 'Deactivate' : 'Activate'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default VendorDetailDrawer
