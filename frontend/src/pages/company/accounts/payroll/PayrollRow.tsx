import React, { useState, useRef, useEffect } from 'react'
import { MoreVertical, Eye, ArrowUpRight, Calculator, Clock, Printer, Lock } from 'lucide-react'
import type { MonthlySalaryDirectory } from '../../../../services/payroll'
import {
  formatINR,
  getEmployeeInitials,
  getAvatarColor,
  formatShortMonth,
  formatDisplayDate
} from './payrollHelpers'

interface PayrollRowProps {
  record: MonthlySalaryDirectory
  isSelected: boolean
  onToggleSelect: (e: React.MouseEvent) => void
  onRowClick: () => void
  onOpenAdvance: () => void
  onOpenSettle: () => void
  onOpenHistory: () => void
  onOpenPayslip: () => void
  onPrintPayslip: () => void
}

export const PayrollRow: React.FC<PayrollRowProps> = ({
  record,
  isSelected,
  onToggleSelect,
  onRowClick,
  onOpenAdvance,
  onOpenSettle,
  onOpenHistory,
  onOpenPayslip,
  onPrintPayslip
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLTableCellElement>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [menuOpen])

  const avatar = getAvatarColor(record.employeeName)
  const initials = getEmployeeInitials(record.employeeName)

  const baseSalary = Number(record.baseSalary || 0)
  const earnedSalary = Number(record.earnedSalary ?? record.netSalaryEntitlement ?? baseSalary)
  const totalPaid = Number(record.totalPaid || 0)
  const balance = Number(record.remainingBalance || 0)
  const isFinalized = Boolean(record.isFinalized)

  // Status computation
  const statusLower = (record.status || '').toLowerCase()
  const isFullyPaid =
    isFinalized ||
    statusLower === 'fully paid' ||
    statusLower === 'paid' ||
    (earnedSalary > 0 && balance <= 0.01)

  const isPartiallyPaid = !isFullyPaid && (statusLower === 'partially paid' || (totalPaid > 0 && balance > 0.01))
  const isUnpaid = !isFullyPaid && !isPartiallyPaid

  // Progress Bar
  const pct = earnedSalary > 0 ? Math.min(100, Math.round((totalPaid / earnedSalary) * 100)) : 0

  // Payment secondary line text
  let paymentSubText = ''
  if (totalPaid <= 0) {
    paymentSubText = 'No payment yet'
  } else if (totalPaid < earnedSalary && balance <= 0.01) {
    const diff = Math.max(0, earnedSalary - totalPaid)
    paymentSubText = `Paid ${formatINR(totalPaid)} · ${formatINR(diff)} adjusted`
  } else {
    paymentSubText = `Paid ${formatINR(totalPaid)} of ${formatINR(earnedSalary)}${
      record.lastPaymentDate ? ` · last ${formatDisplayDate(record.lastPaymentDate, false)}` : ''
    }`
  }

  // Row Action and Menu Disable Reasons
  const advanceDisabled = isFinalized || (Number(record.totalAdvances || 0) >= baseSalary && baseSalary > 0)
  const advanceTooltip = isFinalized
    ? 'Payroll month finalized'
    : advanceDisabled
    ? 'Advance limit reached'
    : undefined

  const settleDisabled = isFinalized || balance <= 0.01
  const settleTooltip = isFinalized
    ? 'Payroll month finalized'
    : balance <= 0.01
    ? 'Paid in full'
    : undefined

  return (
    <tr
      onClick={onRowClick}
      className={`border-b border-[#E5E9F2] hover:bg-slate-50/80 transition-colors cursor-pointer text-xs select-none ${
        isSelected ? 'bg-blue-50/40' : ''
      }`}
    >
      {/* 1. Checkbox */}
      <td
        className="w-10 px-3 py-2.5 text-center shrink-0"
        onClick={e => {
          e.stopPropagation()
          onToggleSelect(e)
        }}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          className="w-4 h-4 rounded border-slate-300 text-[#1A56DB] focus:ring-0 cursor-pointer"
        />
      </td>

      {/* 2. Employee */}
      <td className="px-3 py-2.5 min-w-[180px]">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${avatar.bg} ${avatar.text} ${avatar.border}`}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-slate-900 truncate">
              {record.employeeName || 'Unknown Employee'}
            </div>
            <div className="text-[11px] text-slate-500 truncate flex items-center gap-1">
              <span>{record.department || 'Operations'}</span>
              {/* Tablet secondary month display (hidden on desktop) */}
              <span className="lg:hidden text-slate-400">· {formatShortMonth(record.salaryMonth)}</span>
              {isFinalized && <Lock className="lg:hidden w-3 h-3 text-slate-400 shrink-0 inline" />}
              {record.designation && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>{record.designation}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* 3. Month Column (Positioned after Employee and before Salary, hidden on tablet) */}
      <td className="hidden lg:table-cell px-3 py-2.5 w-[110px] shrink-0">
        <div className="flex items-center gap-1.5 font-medium text-slate-900">
          <span>{formatShortMonth(record.salaryMonth)}</span>
          {isFinalized && (
            <span title="Finalized" className="inline-flex items-center text-slate-400 cursor-help">
              <Lock className="w-3 h-3 text-slate-500" />
            </span>
          )}
        </div>
      </td>

      {/* 4. Salary & Attendance */}
      <td className="px-3 py-2.5 min-w-[130px]">
        <div className="font-medium text-slate-900 font-mono">
          {formatINR(baseSalary)}
        </div>
        <div className="text-[11px] text-slate-500">
          {record.daysWorked || 0} / {record.workingDays || 30} days
          {earnedSalary !== baseSalary && (
            <span className="ml-1 text-slate-400 font-mono">
              (Earned {formatINR(earnedSalary)})
            </span>
          )}
        </div>
      </td>

      {/* 5. Payment */}
      <td className="px-3 py-2.5 min-w-[220px]">
        <div className="flex flex-col gap-1">
          {/* Line 1: Status Pill + Balance */}
          <div className="flex items-center justify-between gap-2">
            {isFullyPaid && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Fully Paid
              </span>
            )}
            {isPartiallyPaid && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Partially Paid
              </span>
            )}
            {isUnpaid && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Unpaid
              </span>
            )}

            {balance > 0 ? (
              <span className="font-mono font-semibold text-rose-600">
                Balance {formatINR(balance)}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400 font-medium">
                Paid in full
              </span>
            )}
          </div>

          {/* Line 2: 4px Progress Bar */}
          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isFullyPaid ? 'bg-emerald-500' : isPartiallyPaid ? 'bg-amber-500' : 'bg-transparent'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Line 3: Secondary Text */}
          <div className="text-[10px] text-slate-500 truncate font-mono">
            {paymentSubText}
          </div>
        </div>
      </td>

      {/* 6. Row Action Button */}
      <td
        className="px-3 py-2.5 text-right shrink-0"
        onClick={e => e.stopPropagation()}
      >
        {isFullyPaid ? (
          <button
            type="button"
            onClick={onOpenPayslip}
            className="h-[28px] px-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium rounded-lg text-xs transition-colors shadow-2xs inline-flex items-center gap-1"
          >
            Payslip
          </button>
        ) : isPartiallyPaid ? (
          <button
            type="button"
            onClick={onOpenSettle}
            disabled={settleDisabled}
            title={settleTooltip}
            className="h-[28px] px-2.5 bg-white border border-amber-300 text-amber-800 hover:bg-amber-50 font-medium rounded-lg text-xs transition-colors shadow-2xs inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Pay balance
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenSettle}
            disabled={settleDisabled}
            title={settleTooltip}
            className="h-[28px] px-2.5 bg-white border border-[#1A56DB] text-[#1A56DB] hover:bg-blue-50 font-medium rounded-lg text-xs transition-colors shadow-2xs inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Settle
          </button>
        )}
      </td>

      {/* 7. Row Menu (⋮) */}
      <td
        className="w-10 px-2 py-2.5 text-center shrink-0 relative"
        onClick={e => e.stopPropagation()}
        ref={menuRef}
      >
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="More actions"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-3 top-8 w-44 bg-white border border-slate-200 rounded-xl shadow-lg p-1 z-30 text-left animate-in fade-in zoom-in-95 duration-100">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                onRowClick()
              }}
              className="w-full px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-xs transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              <span>View details</span>
            </button>

            <button
              type="button"
              disabled={advanceDisabled}
              title={advanceTooltip}
              onClick={() => {
                if (advanceDisabled) return
                setMenuOpen(false)
                onOpenAdvance()
              }}
              className="w-full px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-amber-500" />
              <span>Salary advance</span>
            </button>

            {!isFullyPaid && (
              <button
                type="button"
                disabled={settleDisabled}
                title={settleTooltip}
                onClick={() => {
                  if (settleDisabled) return
                  setMenuOpen(false)
                  onOpenSettle()
                }}
                className="w-full px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Calculator className="w-3.5 h-3.5 text-[#1A56DB]" />
                <span>Settle salary</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                onOpenHistory()
              }}
              className="w-full px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-xs transition-colors"
            >
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Payment history</span>
            </button>

            <div className="my-1 border-t border-slate-100" />

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                onPrintPayslip()
              }}
              className="w-full px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              <span>Print payslip</span>
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

export default PayrollRow
