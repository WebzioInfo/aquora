import React, { useState, useEffect } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Printer,
  ArrowUpRight,
  Calculator,
  Calendar,
  CreditCard,
  Building,
  UserCheck,
  Clock,
  Receipt,
  RotateCcw
} from 'lucide-react'
import type { MonthlySalaryDirectory, MonthlySalaryDetails, SalaryPaymentTransaction } from '../../../../services/payroll'
import { payrollService } from '../../../../services/payroll'
import {
  formatINR,
  getEmployeeInitials,
  getAvatarColor,
  formatMonthLabel,
  formatDisplayDate
} from './payrollHelpers'

interface PayrollDetailDrawerProps {
  isOpen: boolean
  onClose: () => void
  record: MonthlySalaryDirectory | null
  allRecords: MonthlySalaryDirectory[]
  onSelectRecord: (r: MonthlySalaryDirectory) => void
  initialTab?: 'payslip' | 'payments' | 'advances'
  onOpenSettle: (r: MonthlySalaryDirectory) => void
  onOpenAdvance: (r: MonthlySalaryDirectory) => void
  onPrintPayslip: (r: MonthlySalaryDirectory) => void
}

export const PayrollDetailDrawer: React.FC<PayrollDetailDrawerProps> = ({
  isOpen,
  onClose,
  record,
  allRecords,
  onSelectRecord,
  initialTab = 'payslip',
  onOpenSettle,
  onOpenAdvance,
  onPrintPayslip
}) => {
  const [activeTab, setActiveTab] = useState<'payslip' | 'payments' | 'advances'>(initialTab)
  const [details, setDetails] = useState<MonthlySalaryDetails | null>(null)
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false)

  // Sync initial tab when changed externally
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
    }
  }, [isOpen, initialTab])

  // Fetch full details when record changes
  useEffect(() => {
    if (isOpen && record) {
      fetchDetails(record.id)
    } else {
      setDetails(null)
    }
  }, [isOpen, record?.id])

  const fetchDetails = async (id: string) => {
    try {
      setLoadingDetails(true)
      const data = await payrollService.getMonthlySalaryById(id)
      setDetails(data)
    } catch {
      // Fallback to record
    } finally {
      setLoadingDetails(false)
    }
  }

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !record) return null

  // Navigation indices
  const currentIndex = allRecords.findIndex(r => r.id === record.id)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < allRecords.length - 1

  const handlePrev = () => {
    if (hasPrev) onSelectRecord(allRecords[currentIndex - 1])
  }

  const handleNext = () => {
    if (hasNext) onSelectRecord(allRecords[currentIndex + 1])
  }

  const avatar = getAvatarColor(record.employeeName)
  const initials = getEmployeeInitials(record.employeeName)

  const baseSalary = Number(record.baseSalary || 0)
  const earnedSalary = Number(record.earnedSalary ?? record.netSalaryEntitlement ?? baseSalary)
  const totalPaid = Number(record.totalPaid || 0)
  const balance = Number(record.remainingBalance || 0)

  const statusLower = (record.status || '').toLowerCase()
  const isFullyPaid =
    record.isFinalized ||
    statusLower === 'fully paid' ||
    statusLower === 'paid' ||
    (earnedSalary > 0 && balance <= 0.01)

  const isPartiallyPaid = !isFullyPaid && (statusLower === 'partially paid' || (totalPaid > 0 && balance > 0.01))
  const isUnpaid = !isFullyPaid && !isPartiallyPaid

  const pct = earnedSalary > 0 ? Math.min(100, Math.round((totalPaid / earnedSalary) * 100)) : 0

  const paymentsList = details?.payments || []
  const advancesList = paymentsList.filter(p =>
    (p.paymentType || '').toLowerCase().includes('advance')
  )

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-2xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md sm:max-w-[480px] bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${avatar.bg} ${avatar.text} ${avatar.border}`}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 truncate text-sm">
                    {record.employeeName}
                  </h3>
                  {isFullyPaid && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Paid
                    </span>
                  )}
                  {isPartiallyPaid && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      Partial
                    </span>
                  )}
                  {isUnpaid && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                      Unpaid
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1">
                  <span>{record.department || 'Operations'}</span>
                  <span className="text-slate-300">·</span>
                  <span>{formatMonthLabel(record.salaryMonth)}</span>
                </div>
              </div>
            </div>

            {/* Prev/Next arrows & close */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrev}
                disabled={!hasPrev}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 disabled:opacity-30 transition-colors"
                title="Previous record"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!hasNext}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 disabled:opacity-30 transition-colors"
                title="Next record"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Highlight Block: Outstanding Balance */}
          <div className="p-4 bg-slate-50/50 border-b border-slate-200 shrink-0">
            <div className="flex items-end justify-between mb-1.5">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Remaining Balance
                </span>
                <span
                  className={`text-2xl font-bold font-mono leading-none ${
                    balance > 0 ? 'text-rose-600' : 'text-slate-900'
                  }`}
                >
                  {formatINR(balance)}
                </span>
              </div>
              <div className="text-right text-[11px] text-slate-500 font-mono">
                Paid {formatINR(totalPaid)} of {formatINR(earnedSalary)}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isFullyPaid ? 'bg-emerald-500' : isPartiallyPaid ? 'bg-amber-500' : 'bg-transparent'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Segmented Switcher */}
          <div className="px-5 pt-3 border-b border-slate-200 bg-white shrink-0">
            <div className="flex gap-4 text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('payslip')}
                className={`pb-2.5 border-b-2 transition-all ${
                  activeTab === 'payslip'
                    ? 'border-[#1A56DB] text-[#1A56DB] font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Payslip
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('payments')}
                className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'payments'
                    ? 'border-[#1A56DB] text-[#1A56DB] font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Payments</span>
                <span className="px-1.5 py-0.2 bg-slate-100 rounded-full text-[10px] text-slate-600 font-mono">
                  {paymentsList.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('advances')}
                className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'advances'
                    ? 'border-[#1A56DB] text-[#1A56DB] font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Advances</span>
                {advancesList.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-amber-100 rounded-full text-[10px] text-amber-800 font-mono">
                    {advancesList.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Tab Content Body */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5 text-xs space-y-4">
            {/* TAB 1: PAYSLIP */}
            {activeTab === 'payslip' && (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-200">
                    Salary & Attendance Computation
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Base Monthly Salary:</span>
                    <span className="font-mono font-medium text-slate-800">{formatINR(baseSalary)}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Attendance:</span>
                    <span className="font-medium text-slate-800">
                      {record.daysWorked || 0} of {record.workingDays || 30} days worked
                    </span>
                  </div>

                  {details?.dailySalary !== undefined && details.dailySalary > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Daily Salary Rate:</span>
                      <span className="font-mono text-slate-700">{formatINR(details.dailySalary)}/day</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                    <span className="text-slate-700 font-medium">Earned Gross Salary:</span>
                    <span className="font-mono font-bold text-slate-900">{formatINR(earnedSalary)}</span>
                  </div>

                  {details?.bonus !== undefined && details.bonus > 0 && (
                    <div className="flex justify-between items-center text-emerald-700">
                      <span>Bonus / Additions:</span>
                      <span className="font-mono font-medium">+{formatINR(details.bonus)}</span>
                    </div>
                  )}

                  {details?.advanceDeduction !== undefined && details.advanceDeduction > 0 && (
                    <div className="flex justify-between items-center text-amber-700">
                      <span>Advance Deduction:</span>
                      <span className="font-mono font-medium">-{formatINR(details.advanceDeduction)}</span>
                    </div>
                  )}

                  {details?.otherDeduction !== undefined && details.otherDeduction > 0 && (
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Other Deductions:</span>
                      <span className="font-mono font-medium">-{formatINR(details.otherDeduction)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 font-semibold">
                    <span className="text-slate-900">Total Paid Amount:</span>
                    <span className="font-mono text-slate-900">{formatINR(totalPaid)}</span>
                  </div>

                  <div className="flex justify-between items-center pt-1 border-t border-dashed border-slate-200 font-bold">
                    <span className="text-slate-900">Net Balance Due:</span>
                    <span className={`font-mono ${balance > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {formatINR(balance)}
                    </span>
                  </div>
                </div>

                {/* Print Payslip Quick Button */}
                <button
                  type="button"
                  onClick={() => onPrintPayslip(record)}
                  className="w-full h-[36px] bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-xl flex items-center justify-center gap-2 transition-colors shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Download / Print Salary Slip PDF</span>
                </button>
              </div>
            )}

            {/* TAB 2: PAYMENTS */}
            {activeTab === 'payments' && (
              <div className="space-y-3">
                {paymentsList.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400">
                    <Clock className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    <p className="font-medium text-xs">No payments recorded for this month</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {paymentsList.map(p => (
                      <div
                        key={p.id}
                        className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              p.paymentType?.includes('Advance')
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-blue-50 text-[#1A56DB] border border-blue-200'
                            }`}
                          >
                            {p.paymentType || 'Salary Settlement'}
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            {formatINR(p.amount)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>{p.paidFrom || p.paymentMethod || 'Bank'}</span>
                          <span>{formatDisplayDate(p.paymentDate)}</span>
                        </div>

                        {p.remarks && (
                          <div className="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded-md mt-1">
                            {p.remarks}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: ADVANCES */}
            {activeTab === 'advances' && (
              <div className="space-y-3">
                {advancesList.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400">
                    <ArrowUpRight className="w-6 h-6 mx-auto mb-2 opacity-50 text-amber-500" />
                    <p className="font-medium text-xs">No salary advances given in this cycle</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {advancesList.map(a => (
                      <div
                        key={a.id}
                        className="p-3 bg-white border border-amber-200/80 rounded-xl space-y-1 shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-amber-900">Salary Advance</span>
                          <span className="font-mono font-bold text-slate-900">{formatINR(a.amount)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>Disbursed via {a.paidFrom || a.paymentMethod}</span>
                          <span>{formatDisplayDate(a.paymentDate)}</span>
                        </div>
                        <div className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-1 font-medium">
                          Recovered in monthly settlement
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              {!isFullyPaid && (
                <button
                  type="button"
                  onClick={() => onOpenSettle(record)}
                  className="h-[34px] px-3.5 bg-[#1A56DB] hover:bg-blue-700 text-white font-medium rounded-lg text-xs shadow-2xs transition-colors flex items-center gap-1.5"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>{isPartiallyPaid ? 'Pay balance' : 'Settle salary'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onOpenAdvance(record)}
                className="h-[34px] px-3 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium rounded-lg text-xs transition-colors flex items-center gap-1.5"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-500" />
                <span>Salary advance</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => onPrintPayslip(record)}
              className="h-[34px] px-2.5 text-slate-600 hover:text-slate-900 font-medium text-xs flex items-center gap-1"
              title="Print payslip"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PayrollDetailDrawer
