import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  X, ChevronLeft, ChevronRight, Phone, Mail, Calendar, User,
  TrendingUp, TrendingDown, ArrowDownLeft, ArrowUpRight, ArrowLeftRight,
  Edit2, Trash2, Landmark, FileText, CheckCircle2
} from 'lucide-react'
import type { Owner, OwnerInvestmentTransaction } from '../../../../services/simpleAccounts'
import {
  formatINR,
  getOwnerInitials,
  getOwnerColor,
  getOwnerTransactionTotals
} from './ownerHelpers'

interface OwnerDetailDrawerProps {
  isOpen: boolean
  onClose: () => void
  owner: Owner | null
  allOwners: Owner[]
  onSelectOwner: (owner: Owner) => void
  onOpenTransact: (owner: Owner) => void
  onOpenEdit: (owner: Owner) => void
  onDelete: (owner: Owner) => void
}

type DrawerTab = 'transactions' | 'details'

export const OwnerDetailDrawer: React.FC<OwnerDetailDrawerProps> = ({
  isOpen,
  onClose,
  owner,
  allOwners,
  onSelectOwner,
  onOpenTransact,
  onOpenEdit,
  onDelete
}) => {
  const [activeTab, setActiveTab] = useState<DrawerTab>('transactions')
  const modalRef = useRef<HTMLDivElement>(null)

  // Prev / Next owner navigation in filtered list
  const currentIndex = useMemo(() => {
    if (!owner) return -1
    return allOwners.findIndex(o => o.id === owner.id)
  }, [allOwners, owner])

  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < allOwners.length - 1

  const handlePrev = () => {
    if (hasPrev) onSelectOwner(allOwners[currentIndex - 1])
  }

  const handleNext = () => {
    if (hasNext) onSelectOwner(allOwners[currentIndex + 1])
  }

  // Lock body scroll and handle keyboard navigation (Escape, Left Arrow, Right Arrow)
  useEffect(() => {
    if (!isOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        handlePrev()
      } else if (e.key === 'ArrowRight' && hasNext) {
        handleNext()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, hasPrev, hasNext, currentIndex])

  if (!isOpen || !owner) return null

  const initials = getOwnerInitials(owner.name)
  const color = getOwnerColor(owner.id || owner.name)
  const pct = Number(owner.ownershipPercentage || 0)
  const initialInv = Number(owner.initialInvestment || 0)
  const currentInv = Number(owner.currentInvestment || 0)

  const { additionalInvested, totalWithdrawn } = getOwnerTransactionTotals(owner)
  const hasHistory = Boolean(owner.transactions && owner.transactions.length > 0)

  // Compute running balance per transaction:
  // Sort oldest to newest, compute balance after each step, then reverse for display (newest first)
  const transactionsWithBalance = useMemo(() => {
    if (!owner.transactions || owner.transactions.length === 0) return []

    // Sort ascending by date
    const sorted = [...owner.transactions].sort((a, b) => {
      const da = new Date(a.transactionDate).getTime()
      const db = new Date(b.transactionDate).getTime()
      return da - db
    })

    let running = initialInv
    const withBal = sorted.map(t => {
      const type = (t.transactionType || '').toLowerCase()
      const amt = Number(t.amount || 0)
      if (type === 'investment') {
        running += amt
      } else {
        running -= amt
      }
      return {
        ...t,
        runningBalance: running
      }
    })

    // Reverse to display newest first
    return withBal.reverse()
  }, [owner.transactions, initialInv])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden text-left">
      {/* Backdrop Overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200"
      />

      {/* Centered Landscape Modal Container */}
      <div
        ref={modalRef}
        className="relative w-full max-w-[1100px] max-h-[calc(100vh-48px)] bg-white border border-slate-200 rounded-[12px] shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150 z-10 overflow-hidden my-auto select-none"
        style={{ width: 'min(1100px, calc(100vw - 48px))' }}
      >
        {/* 1. Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border ${color.bg} ${color.text} ${color.border}`}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate flex items-center gap-1.5">
                  <span>{owner.name}</span>
                  {owner.userId && (
                    <span className="inline-flex items-center px-1.5 py-0.2 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded" title="Integrated Employee profile">
                      Employee
                    </span>
                  )}
                </h3>
                <span
                  className="px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 font-mono"
                  style={{ backgroundColor: color.lightBg, color: color.hex }}
                >
                  {pct}% equity
                </span>
              </div>
              <div className="text-xs text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{owner.phone || 'No phone'}</span>
                {owner.email && (
                  <>
                    <span className="text-slate-300">·</span>
                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{owner.email}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Prev / Next & Close */}
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              type="button"
              onClick={handlePrev}
              disabled={!hasPrev}
              title="Previous owner"
              className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:pointer-events-none rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!hasNext}
              title="Next owner"
              className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:pointer-events-none rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Landscape Investment Summary Grid */}
        <div className="px-5 sm:px-6 py-4 bg-slate-50/90 border-b border-slate-200 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 items-center">
            {/* Current Investment Card */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Current Investment
              </span>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-900 font-mono mt-0.5">
                {formatINR(currentInv)}
              </div>
            </div>

            {/* Initial Contribution */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Initial Contribution
              </span>
              <div className="text-base sm:text-lg font-bold text-slate-700 font-mono mt-0.5">
                {formatINR(initialInv)}
              </div>
            </div>

            {/* Added Investment (+) */}
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200/80 bg-emerald-50/30 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                Added Investment (+)
              </span>
              <div className="text-base sm:text-lg font-bold text-emerald-700 font-mono mt-0.5">
                +{formatINR(additionalInvested)}
              </div>
            </div>

            {/* Withdrawn Amount (−) */}
            <div className="bg-white p-3.5 rounded-xl border border-rose-200/80 bg-rose-50/30 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                Withdrawn Amount (−)
              </span>
              <div className="text-base sm:text-lg font-bold text-rose-700 font-mono mt-0.5">
                −{formatINR(totalWithdrawn)}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Segmented Tab Switcher: Transactions | Details */}
        <div className="px-5 sm:px-6 pt-3 pb-2.5 border-b border-slate-200 bg-white shrink-0">
          <div className="inline-flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('transactions')}
              className={`py-1.5 px-4 rounded-md transition-all text-center flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'transactions'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Transactions</span>
              <span className="text-[10px] bg-slate-200 px-1.5 py-0.2 rounded-full font-mono">
                {transactionsWithBalance.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`py-1.5 px-4 rounded-md transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'details'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Details</span>
            </button>
          </div>
        </div>

        {/* 4. Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 select-text">
          {activeTab === 'transactions' ? (
            <div>
              {transactionsWithBalance.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-700">No additional transactions</h4>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto mt-1">
                    Only the initial contribution of {formatINR(initialInv)} is recorded for this owner.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenTransact(owner)}
                    className="mt-4 px-3.5 py-2 bg-[#05303B] hover:bg-[#0A4352] active:bg-[#031F27] text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>Record first transaction</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="overflow-x-auto">
                    <div className="min-w-[640px]">
                      {/* Timeline Table Header */}
                      <div className="grid grid-cols-12 px-3.5 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/80 rounded-lg border border-slate-100 mb-2">
                        <div className="col-span-3">Type & Date</div>
                        <div className="col-span-4">Notes & References</div>
                        <div className="col-span-2 text-right">Amount</div>
                        <div className="col-span-3 text-right">Running Balance</div>
                      </div>

                      {/* Timeline Transactions Rows */}
                      <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-2xs">
                        {transactionsWithBalance.map(t => {
                          const isInvest = (t.transactionType || '').toLowerCase() === 'investment'
                          return (
                            <div key={t.id} className="grid grid-cols-12 px-3.5 sm:px-4 py-3 items-center gap-2 hover:bg-slate-50/60 transition-colors">
                              {/* Type & Date */}
                              <div className="col-span-3 flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                    isInvest ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                  }`}
                                >
                                  {isInvest ? (
                                    <ArrowDownLeft className="w-4 h-4" />
                                  ) : (
                                    <ArrowUpRight className="w-4 h-4" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <span className="font-semibold text-xs text-slate-900 block truncate">
                                    {isInvest ? 'Investment' : 'Withdrawal'}
                                  </span>
                                  <span className="text-[11px] text-slate-400 block font-medium">
                                    {new Date(t.transactionDate).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                    })}
                                  </span>
                                </div>
                              </div>

                              {/* Notes & References */}
                              <div className="col-span-4 text-xs text-slate-600 font-medium">
                                {t.notes ? (
                                  <span className="text-slate-700">{t.notes}</span>
                                ) : (
                                  <span className="text-slate-300 italic text-[11px]">No notes</span>
                                )}
                              </div>

                              {/* Amount */}
                              <div className="col-span-2 text-right">
                                <span className={`font-mono font-bold text-xs sm:text-sm ${
                                  isInvest ? 'text-emerald-600' : 'text-rose-600'
                                }`}>
                                  {isInvest ? '+' : '−'}{formatINR(t.amount)}
                                </span>
                              </div>

                              {/* Running Balance */}
                              <div className="col-span-3 text-right">
                                <span className="font-mono font-semibold text-xs sm:text-sm text-slate-900">
                                  {formatINR(t.runningBalance)}
                                </span>
                              </div>
                            </div>
                          )
                        })}

                        {/* Initial Contribution anchor */}
                        <div className="grid grid-cols-12 px-3.5 sm:px-4 py-3 items-center gap-2 bg-slate-50/70 border-t border-slate-100">
                          <div className="col-span-3 flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-xs text-slate-800 block truncate">
                                Initial Contribution
                              </span>
                              <span className="text-[11px] text-slate-400 block font-medium">
                                {owner.createdAt
                                  ? new Date(owner.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                  : 'Joining date'}
                              </span>
                            </div>
                          </div>

                          <div className="col-span-4 text-xs text-slate-500 italic">
                            Baseline capital registered at joining
                          </div>

                          <div className="col-span-2 text-right">
                            <span className="font-mono font-bold text-xs sm:text-sm text-slate-700">
                              {formatINR(initialInv)}
                            </span>
                          </div>

                          <div className="col-span-3 text-right">
                            <span className="font-mono font-bold text-xs sm:text-sm text-slate-900">
                              {formatINR(initialInv)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Details Tab */
            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <span className="font-bold text-slate-800 text-sm">Owner Profile Overview</span>
                  <button
                    type="button"
                    onClick={() => onOpenEdit(owner)}
                    className="text-[#0B7A70] hover:underline font-semibold flex items-center gap-1.5 cursor-pointer text-xs"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit profile</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                  <div className="bg-white p-3.5 rounded-lg border border-slate-200/70 shadow-2xs">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">
                      Full Name
                    </span>
                    <span className="font-semibold text-slate-900 text-sm">{owner.name}</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-lg border border-slate-200/70 shadow-2xs">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">
                      Ownership Share
                    </span>
                    <span className="font-bold text-slate-900 font-mono text-sm">{pct}%</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-lg border border-slate-200/70 shadow-2xs">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">
                      Phone Number
                    </span>
                    <span className="text-slate-800 font-medium">{owner.phone || '—'}</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-lg border border-slate-200/70 shadow-2xs">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">
                      Email Address
                    </span>
                    <span className="text-slate-800 font-medium truncate block">{owner.email || '—'}</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-lg border border-slate-200/70 shadow-2xs">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">
                      Initial Investment
                    </span>
                    <span className="text-slate-800 font-medium font-mono">{formatINR(initialInv)}</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-lg border border-slate-200/70 shadow-2xs">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">
                      Joined / Created
                    </span>
                    <span className="text-slate-800 font-medium">
                      {owner.createdAt
                        ? new Date(owner.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })
                        : '—'}
                    </span>
                  </div>
                </div>

                {owner.notes && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                      Notes
                    </span>
                    <p className="text-slate-700 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                      {owner.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 5. Modal Footer Actions */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50/90 flex items-center justify-between gap-3 shrink-0 rounded-b-[12px]">
          {/* Delete button (disabled with tooltip when history exists) on bottom-left */}
          <div title={hasHistory ? 'Owner has transaction history' : undefined}>
            <button
              type="button"
              disabled={hasHistory}
              onClick={() => onDelete(owner)}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete owner</span>
            </button>
          </div>

          {/* Edit Owner and Transact on bottom-right */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onOpenEdit(owner)}
              className="h-[36px] px-3.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Edit2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Edit owner</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenTransact(owner)}
              className="h-[36px] px-4 bg-[#05303B] hover:bg-[#0A4352] active:bg-[#031F27] text-white font-medium rounded-lg text-xs shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Transact</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OwnerDetailDrawer
