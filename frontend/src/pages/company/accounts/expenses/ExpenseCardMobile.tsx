import React, { useState, useRef, useEffect } from 'react'
import {
  MoreVertical,
  Eye,
  Edit2,
  Printer,
  Trash2,
  Landmark,
  Wallet
} from 'lucide-react'
import type { SimpleExpense } from '../../../../services/simpleAccounts'
import { getCategoryMeta, CategoryPill } from './categoryMeta'

interface ExpenseCardMobileProps {
  expense: SimpleExpense
  isSelected: boolean
  onToggleSelect: (e: React.SyntheticEvent, id: string) => void
  onRowClick: (expense: SimpleExpense) => void
  onEdit: (expense: SimpleExpense) => void
  onPrint: (expense: SimpleExpense) => void
  onDelete: (expense: SimpleExpense) => void
  canWrite: boolean
}

export const ExpenseCardMobile: React.FC<ExpenseCardMobileProps> = ({
  expense,
  isSelected,
  onToggleSelect,
  onRowClick,
  onEdit,
  onPrint,
  onDelete,
  canWrite
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
      return () => document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [menuOpen])

  const meta = getCategoryMeta(expense.category)
  const CategoryIcon = meta.icon

  const isBank = expense.paymentMethod?.toLowerCase() === 'bank'
  const paidFromName = isBank
    ? expense.paidFrom || expense.bankAccountName || 'Bank'
    : expense.paidFrom || expense.cashBookName || 'Cash'

  const formattedDate = expense.expenseDate
    ? new Date(expense.expenseDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : '-'

  return (
    <div
      onClick={() => onRowClick(expense)}
      className={`p-3.5 border-b border-slate-100 last:border-b-0 cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-50/70' : 'bg-white hover:bg-slate-50'
      }`}
    >
      {/* Top row: Checkbox + Expense # + Menu */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={e => onToggleSelect(e, expense.id)}
            className="w-4 h-4 rounded border-slate-300 text-[#1A56DB] focus:ring-[#1A56DB]"
          />
          <span className="font-mono font-bold text-slate-800 text-xs">
            {expense.expenseNumber || 'EXP-—'}
          </span>
          <span className="text-slate-400 text-xs">·</span>
          <span className="text-[11px] text-slate-500">{formattedDate}</span>
        </div>

        <div className="relative" ref={menuRef} onClick={e => e.stopPropagation()}>
          <button
            type="button"
            aria-label="More actions"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-[#E5E9F2] rounded-xl shadow-lg py-1 z-30 text-xs font-semibold text-slate-700 animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onRowClick(expense)
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                View details
              </button>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onEdit(expense)
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
                >
                  <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onPrint(expense)
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                Print
              </button>
              {canWrite && (
                <>
                  <div className="h-[1px] bg-slate-100 my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      onDelete(expense)
                    }}
                    className="w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Middle row: Description */}
      <div className="mt-1 font-semibold text-slate-900 text-xs">
        {expense.description || 'No description recorded'}
      </div>

      {/* Bottom row: Category pill + Source + Amount */}
      <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-slate-50">
        <div className="flex items-center gap-2 flex-wrap">
          <CategoryPill category={expense.category} size="sm" />
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            {isBank ? (
              <Landmark className="w-3 h-3 text-slate-400" />
            ) : (
              <Wallet className="w-3 h-3 text-slate-400" />
            )}
            <span className="truncate max-w-[120px]">{paidFromName}</span>
          </span>
        </div>

        <span className="font-mono font-bold text-slate-900 text-xs">
          ₹{expense.amount?.toLocaleString('en-IN') || '0'}
        </span>
      </div>
    </div>
  )
}
