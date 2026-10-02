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

interface ExpenseRowProps {
  expense: SimpleExpense
  isSelected: boolean
  onToggleSelect: (e: React.SyntheticEvent, id: string) => void
  onRowClick: (expense: SimpleExpense) => void
  onEdit: (expense: SimpleExpense) => void
  onPrint: (expense: SimpleExpense) => void
  onDelete: (expense: SimpleExpense) => void
  canWrite: boolean
}

export const ExpenseRow: React.FC<ExpenseRowProps> = ({
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

  // Close menu on click outside
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

  // Date formatting
  const formattedDate = expense.expenseDate
    ? new Date(expense.expenseDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short'
      })
    : '-'

  // Initials for avatar
  const creatorName = expense.createdByName || expense.createdBy || 'System'
  const initials = creatorName
    .split(' ')
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'S'

  // Paid from source
  const isBank = expense.paymentMethod?.toLowerCase() === 'bank'
  const paidFromName = isBank
    ? expense.paidFrom || expense.bankAccountName || 'Bank'
    : expense.paidFrom || expense.cashBookName || 'Cash'

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onRowClick(expense)
    } else if (e.key === ' ') {
      e.preventDefault()
      onToggleSelect(e, expense.id)
    }
  }

  return (
    <tr
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={() => onRowClick(expense)}
      className={`group cursor-pointer transition-colors duration-150 focus:outline-none focus:bg-blue-50/50 ${
        isSelected ? 'bg-blue-50/70 hover:bg-blue-50' : 'hover:bg-slate-50/80'
      }`}
    >
      {/* 1. Checkbox */}
      <td
        className="w-10 px-3.5 py-3 text-center align-middle"
        onClick={e => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={e => onToggleSelect(e as any, expense.id)}
          aria-label={`Select expense ${expense.expenseNumber || expense.description}`}
          className="w-4 h-4 rounded border-slate-300 text-[#1A56DB] focus:ring-[#1A56DB] focus:ring-offset-0 cursor-pointer"
        />
      </td>

      {/* 2. Expense cell: 2 lines */}
      <td className="px-3.5 py-3 align-middle min-w-[220px]">
        {/* Line 1: Description */}
        <div className="font-semibold text-slate-900 text-xs truncate max-w-sm" title={expense.description}>
          {expense.description || 'No description recorded'}
        </div>
        {/* Line 2: EXP-#### · 17 Aug · [avatar] Created-by */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 truncate">
          <span className="font-mono font-bold text-slate-700">{expense.expenseNumber || 'EXP-—'}</span>
          <span>·</span>
          <span>{formattedDate}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1 shrink-0">
            <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[9px] font-bold inline-flex items-center justify-center shrink-0">
              {initials}
            </span>
            <span className="truncate max-w-[120px]">{creatorName}</span>
          </span>
          {/* Tablet only category pill (640-1023px) */}
          <span className="hidden sm:inline lg:hidden ml-1">
            <CategoryPill category={expense.category} size="sm" />
          </span>
        </div>
      </td>

      {/* 3. Category (Hidden on tablet 640-1023px, shown on desktop >= 1024px) */}
      <td className="hidden lg:table-cell px-3.5 py-3 align-middle whitespace-nowrap">
        <CategoryPill category={expense.category} size="md" />
      </td>

      {/* 4. Paid From: small icon + plain text (NOT a blue link) */}
      <td className="px-3.5 py-3 align-middle whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
          {isBank ? (
            <Landmark className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          ) : (
            <Wallet className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          )}
          <span className="truncate max-w-[160px]" title={paidFromName}>
            {paidFromName}
          </span>
        </div>
      </td>

      {/* 5. Amount (Right-aligned, medium weight, neutral color - NOT red) */}
      <td className="px-3.5 py-3 align-middle text-right whitespace-nowrap">
        <span className="font-mono font-bold text-slate-900 text-xs">
          ₹{expense.amount?.toLocaleString('en-IN') || '0'}
        </span>
      </td>

      {/* 6. Row Menu (⋮ icon button) */}
      <td
        className="w-10 px-3.5 py-3 text-center align-middle whitespace-nowrap"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative inline-block text-left" ref={menuRef}>
          <button
            type="button"
            aria-label="More actions"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-[#E5E9F2] rounded-xl shadow-lg py-1 z-30 text-xs font-semibold text-slate-700 animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onRowClick(expense)
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
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
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
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
                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
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
                    className="w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}
