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

interface PayrollCardMobileProps {
  record: MonthlySalaryDirectory
  isSelected: boolean
  onToggleSelect: (e: React.MouseEvent) => void
  onCardClick: () => void
  onOpenAdvance: () => void
  onOpenSettle: () => void
  onOpenHistory: () => void
  onOpenPayslip: () => void
  onPrintPayslip: () => void
}

export const PayrollCardMobile: React.FC<PayrollCardMobileProps> = ({
  record,
  isSelected,
  onToggleSelect,
  onCardClick,
  onOpenAdvance,
  onOpenSettle,
  onOpenHistory,
  onOpenPayslip,
  onPrintPayslip
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

  const statusLower = (record.status || '').toLowerCase()
  const isFullyPaid =
    isFinalized ||
    statusLower === 'fully paid' ||
    statusLower === 'paid' ||
    (earnedSalary > 0 && balance <= 0.01)

  const isPartiallyPaid = !isFullyPaid && (statusLower === 'partially paid' || (totalPaid > 0 && balance > 0.01))
  const isUnpaid = !isFullyPaid && !isPartiallyPaid

  const pct = earnedSalary > 0 ? Math.min(100, Math.round((totalPaid / earnedSalary) * 100)) : 0

  // Disable conditions
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
    <div
      onClick={onCardClick}
      className={`p-3.5 bg-white border border-[#E5E9F2] rounded-xl shadow-2xs space-y-3 cursor-pointer text-xs select-none transition-colors ${
        isSelected ? 'bg-blue-50/30 border-blue-300' : 'hover:border-slate-300'
      }`}
    >
      {/* Top Header Row: Checkbox, Avatar, Name & ⋮ */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            onClick={e => {
              e.stopPropagation()
              onToggleSelect(e)
            }}
            className="p-1"
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}}
              className="w-4 h-4 rounded border-slate-300 text-[#1A56DB] focus:ring-0 cursor-pointer"
            />
          </div>

          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${avatar.bg} ${avatar.text} ${avatar.border}`}
          >
            {initials}
          </div>

          <div className="min-w-0">
            <h4 className="font-semibold text-slate-900 truncate">
              {record.employeeName || 'Unknown Employee'}
            </h4>
            <div className="text-[11px] text-slate-500 truncate flex items-center gap-1">
              <span>{record.department || 'Operations'}</span>
              <span className="text-slate-300">·</span>
              <span>{formatShortMonth(record.salaryMonth)}</span>
              {isFinalized && <Lock className="w-3 h-3 text-slate-400 shrink-0 inline" />}
              {record.designation && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>{record.designation}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status Pill & Row Menu */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          {isFullyPaid && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Paid
            </span>
          )}
          {isPartiallyPaid && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Partial
            </span>
          )}
          {isUnpaid && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Unpaid
            </span>
          )}

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-8 w-44 bg-white border border-slate-200 rounded-xl shadow-lg p-1 z-30 text-left animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onCardClick()
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-xs"
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
                  className="w-full px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="w-full px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="w-full px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-xs"
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
                  className="w-full px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-xs"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-400" />
                  <span>Print payslip</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Middle Row: Salary & Attendance */}
      <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 rounded-lg text-[11px]">
        <div>
          <span className="text-slate-500 block">Monthly Salary</span>
          <span className="font-semibold text-slate-900 font-mono text-xs">{formatINR(baseSalary)}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Attendance</span>
          <span className="font-medium text-slate-700">
            {record.daysWorked || 0} of {record.workingDays || 30} days
          </span>
        </div>
      </div>

      {/* Progress & Balance */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500">
            Paid {formatINR(totalPaid)} of {formatINR(earnedSalary)}
          </span>
          {balance > 0 ? (
            <span className="font-mono font-bold text-rose-600">
              Bal {formatINR(balance)}
            </span>
          ) : (
            <span className="text-slate-400 font-medium">Settled</span>
          )}
        </div>
        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              isFullyPaid ? 'bg-emerald-500' : isPartiallyPaid ? 'bg-amber-500' : 'bg-transparent'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Footer Action Button */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between" onClick={e => e.stopPropagation()}>
        <span className="text-[10px] text-slate-400 font-mono">
          {record.lastPaymentDate ? `Last: ${formatDisplayDate(record.lastPaymentDate, false)}` : 'No payments yet'}
        </span>

        {isFullyPaid ? (
          <button
            type="button"
            onClick={onOpenPayslip}
            className="h-[30px] px-3 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg text-xs"
          >
            Payslip
          </button>
        ) : isPartiallyPaid ? (
          <button
            type="button"
            onClick={onOpenSettle}
            disabled={settleDisabled}
            title={settleTooltip}
            className="h-[30px] px-3 bg-white border border-amber-300 text-amber-800 font-medium rounded-lg text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Pay balance
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenSettle}
            disabled={settleDisabled}
            title={settleTooltip}
            className="h-[30px] px-3 bg-white border border-[#1A56DB] text-[#1A56DB] font-medium rounded-lg text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Settle
          </button>
        )}
      </div>
    </div>
  )
}

export default PayrollCardMobile
