import React, { useEffect, useRef } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Wallet,
  Calendar,
  User,
  Clock,
  Printer,
  Edit2,
  Trash2,
  AlertCircle
} from 'lucide-react'
import type { SimpleExpense } from '../../../../services/simpleAccounts'
import { getCategoryMeta, CategoryPill } from './categoryMeta'
import EnterpriseButton from '../../../../components/ui/EnterpriseButton'

interface ExpenseDetailDrawerProps {
  isOpen: boolean
  onClose: () => void
  expense: SimpleExpense | null
  expensesList: SimpleExpense[]
  onSelectExpense: (exp: SimpleExpense) => void
  onEdit: (exp: SimpleExpense) => void
  onPrint: (exp: SimpleExpense) => void
  onDelete: (exp: SimpleExpense) => void
  canWrite: boolean
}

export const ExpenseDetailDrawer: React.FC<ExpenseDetailDrawerProps> = ({
  isOpen,
  onClose,
  expense,
  expensesList,
  onSelectExpense,
  onEdit,
  onPrint,
  onDelete,
  canWrite
}) => {
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Focus trap & restore
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      drawerRef.current?.focus()
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus()
    }
  }, [isOpen])

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !expense) return null

  // Find index in current filtered list for prev/next
  const currentIndex = expensesList.findIndex(e => e.id === expense.id)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < expensesList.length - 1

  const handlePrev = () => {
    if (hasPrev) onSelectExpense(expensesList[currentIndex - 1])
  }
  const handleNext = () => {
    if (hasNext) onSelectExpense(expensesList[currentIndex + 1])
  }

  const meta = getCategoryMeta(expense.category)
  const CategoryIcon = meta.icon
  const isBank = expense.paymentMethod?.toLowerCase() === 'bank'
  const sourceName = isBank
    ? expense.paidFrom || expense.bankAccountName || 'Bank Account'
    : expense.paidFrom || expense.cashBookName || 'Cash Book'

  const formattedDate = expense.expenseDate
    ? new Date(expense.expenseDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : '-'

  const formattedCreatedAt = expense.createdDate
    ? new Date(expense.createdDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '-'

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/30 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      {/* Slide-over Panel (440px desktop, full width mobile) */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div
          ref={drawerRef}
          tabIndex={-1}
          className="w-screen max-w-[440px] bg-white shadow-2xl flex flex-col focus:outline-none animate-in slide-in-from-right duration-200 text-left border-l border-[#E5E9F2]"
        >
          {/* 1. Header: Expense #, category pill, prev/next, close */}
          <div className="px-5 py-4 border-b border-[#E5E9F2] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-slate-900 text-sm">
                {expense.expenseNumber || 'EXP-DETAILS'}
              </span>
              <CategoryPill category={expense.category} size="sm" />
            </div>

            <div className="flex items-center gap-1">
              {/* Prev / Next Arrows */}
              <button
                type="button"
                onClick={handlePrev}
                disabled={!hasPrev}
                aria-label="Previous expense"
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title="Previous expense"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!hasNext}
                aria-label="Next expense"
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title="Next expense"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="w-[1px] h-4 bg-slate-200 mx-1" />

              <button
                type="button"
                onClick={onClose}
                aria-label="Close drawer"
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2. Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-700">
            {/* Big Amount (Neutral color - not red) */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Expense Amount
              </span>
              <div className="mt-1 text-2xl sm:text-3xl font-bold font-mono text-slate-900">
                ₹{expense.amount?.toLocaleString('en-IN') || '0'}
              </div>
            </div>

            {/* Details List */}
            <div className="space-y-3 bg-white border border-[#E5E9F2] rounded-xl p-4">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider pb-2 border-b border-slate-100">
                Expense Information
              </h4>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Date</span>
                  <span className="font-semibold text-slate-900 flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {formattedDate}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Payment Source</span>
                  <span className="font-semibold text-slate-900 flex items-center gap-1.5 mt-0.5 truncate" title={sourceName}>
                    {isBank ? (
                      <Landmark className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    ) : (
                      <Wallet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    )}
                    <span className="truncate">{sourceName}</span>
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] font-bold uppercase">Description</span>
                <p className="font-medium text-slate-900 mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {expense.description || 'No description recorded.'}
                </p>
              </div>

              {expense.vendor && (
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Vendor / Payee</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{expense.vendor}</p>
                </div>
              )}

              {expense.notes && (
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Notes</span>
                  <p className="text-slate-600 mt-1 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {expense.notes}
                  </p>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" />
                  <span>By: <strong className="text-slate-700">{expense.createdByName || expense.createdBy || 'System'}</strong></span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{formattedCreatedAt}</span>
                </span>
              </div>
            </div>

            {/* Section: Balance Impact */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
                Balance Impact
              </h4>
              <p className="text-slate-600 text-xs">
                This expense automatically debited{' '}
                <strong className="font-mono text-slate-900">
                  ₹{expense.amount?.toLocaleString('en-IN')}
                </strong>{' '}
                from <strong className="text-slate-900">{sourceName}</strong> ({isBank ? 'Bank Account' : 'Cash Book'}).
              </p>
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between font-mono text-xs mt-2">
                <span className="text-slate-500 font-sans font-medium">Deduction amount:</span>
                <span className="font-bold text-slate-900">
                  -₹{expense.amount?.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Footer Actions: Edit (secondary), Print (secondary), Delete (danger text) */}
          <div className="p-4 border-t border-[#E5E9F2] bg-white flex items-center justify-between gap-2 shrink-0">
            {canWrite ? (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onDelete(expense)
                }}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                Delete
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <EnterpriseButton
                variant="secondary"
                size="sm"
                onClick={() => onPrint(expense)}
                className="!h-[32px] text-xs"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Print
              </EnterpriseButton>

              {canWrite && (
                <EnterpriseButton
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onClose()
                    onEdit(expense)
                  }}
                  className="!h-[32px] text-xs"
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                  Edit
                </EnterpriseButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
