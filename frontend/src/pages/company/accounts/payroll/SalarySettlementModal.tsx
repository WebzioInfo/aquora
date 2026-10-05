import React, { useState, useEffect, useMemo, useRef } from 'react'
import { X, AlertCircle, AlertTriangle, Lock, Info, Loader2, Plus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type {
  MonthlySalaryDirectory,
  MonthlySalaryDetails
} from '../../../../services/payroll'
import { payrollService } from '../../../../services/payroll'
import type { BankAccountDropdown, CashBookDropdown } from '../../../../services/simpleAccounts'
import type { EmployeeDto } from '../../../../services/employees'
import { QuickCreateEmployeeModal } from './QuickCreateEmployeeModal'
import {
  formatINR,
  formatMonthLabel,
  roundToCurrency
} from './payrollHelpers'

interface SalarySettlementModalProps {
  isOpen: boolean
  onClose: () => void
  prefilledRecord?: MonthlySalaryDirectory | null
  employees: any[]
  bankAccounts: BankAccountDropdown[]
  cashBooks: CashBookDropdown[]
  defaultMonth?: string
  onPaymentSuccess: () => void
  onViewPayslip?: (record: MonthlySalaryDirectory) => void
}

type EligibilityState = 'ELIGIBLE' | 'LOCKED' | 'NOTHING_PAYABLE'

export const SalarySettlementModal: React.FC<SalarySettlementModalProps> = ({
  isOpen,
  onClose,
  prefilledRecord,
  employees,
  bankAccounts,
  cashBooks,
  defaultMonth,
  onPaymentSuccess,
  onViewPayslip
}) => {
  const queryClient = useQueryClient()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const prevIsOpenRef = useRef(false)
  const prevPrefilledIdRef = useRef<string | null | undefined>(undefined)
  const latestRequestIdRef = useRef<number>(0)

  const [isCreateEmployeeOpen, setIsCreateEmployeeOpen] = useState(false)
  const [createdEmployees, setCreatedEmployees] = useState<any[]>([])

  const [employeeId, setEmployeeId] = useState<string>('')
  const [salaryMonth, setSalaryMonth] = useState<string>('')
  const [workingDays, setWorkingDays] = useState<number>(30)
  const [daysWorked, setDaysWorked] = useState<number>(30)
  const [baseSalary, setBaseSalary] = useState<number>(0)
  const [bonus, setBonus] = useState<number | string>(0)
  const [advanceDeduction, setAdvanceDeduction] = useState<number | string>(0)
  const [otherDeduction, setOtherDeduction] = useState<number | string>(0)
  const [showAdjustments, setShowAdjustments] = useState(false)

  const [totalPreviousPaid, setTotalPreviousPaid] = useState<number>(0)
  const [totalAdvances, setTotalAdvances] = useState<number>(0)
  const [remainingBalance, setRemainingBalance] = useState<number>(0)
  const [status, setStatus] = useState<string>('Unpaid')
  const [isFinalized, setIsFinalized] = useState<boolean>(false)
  const [monthlySalaryId, setMonthlySalaryId] = useState<string>('')

  const [amount, setAmount] = useState<string>('')
  const [isAmountCustomized, setIsAmountCustomized] = useState(false)
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState<'BankAccount' | 'CashBook'>('BankAccount')
  const [bankAccountId, setBankAccountId] = useState<string>('')
  const [cashBookId, setCashBookId] = useState<string>('')
  const [confirmFinalSettlement, setConfirmFinalSettlement] = useState(false)
  const [remarks, setRemarks] = useState<string>('')

  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [serverLockError, setServerLockError] = useState<string | null>(null)

  // Merge parent employees with any freshly created employees
  const allEmployees = useMemo(() => {
    const map = new Map<string, any>()
    for (const emp of employees) {
      if (emp && emp.id) map.set(emp.id, emp)
    }
    for (const emp of createdEmployees) {
      if (emp && emp.id) map.set(emp.id, emp)
    }
    return Array.from(map.values())
  }, [employees, createdEmployees])

  // Initialize or reset form on open
  useEffect(() => {
    if (!isOpen) {
      prevIsOpenRef.current = false
      return
    }

    const justOpened = !prevIsOpenRef.current
    const prefilledChanged = prefilledRecord?.id !== prevPrefilledIdRef.current
    prevIsOpenRef.current = true
    prevPrefilledIdRef.current = prefilledRecord?.id

    if (justOpened || prefilledChanged) {
      setErrorMessage(null)
      setServerLockError(null)
      setSubmitting(false)
      setShowAdjustments(false)
      setIsAmountCustomized(false)
      setPaymentDate(new Date().toISOString().slice(0, 10))
      setPaymentMethod('BankAccount')
      setConfirmFinalSettlement(false)
      setRemarks('')

      if (bankAccounts.length > 0) setBankAccountId(bankAccounts[0].id)
      if (cashBooks.length > 0) setCashBookId(cashBooks[0].id)

      if (prefilledRecord) {
        setEmployeeId(prefilledRecord.employeeId)
        setSalaryMonth(prefilledRecord.salaryMonth)
        setMonthlySalaryId(prefilledRecord.id)
        setWorkingDays(prefilledRecord.workingDays || 30)
        setDaysWorked(prefilledRecord.daysWorked ?? prefilledRecord.workingDays ?? 30)
        setBaseSalary(prefilledRecord.baseSalary || 0)
        setTotalPreviousPaid(prefilledRecord.totalPaid || 0)
        setTotalAdvances(prefilledRecord.totalAdvances || 0)
        setRemainingBalance(prefilledRecord.remainingBalance || 0)
        setStatus(prefilledRecord.status || 'Unpaid')
        setIsFinalized(Boolean(prefilledRecord.isFinalized))
        loadDetails(prefilledRecord.id)
      } else {
        const initMonth = defaultMonth || new Date().toISOString().slice(0, 7)
        setSalaryMonth(initMonth)
        if (allEmployees.length > 0) {
          const firstEmp = allEmployees[0]
          setEmployeeId(firstEmp.id)
          fetchEntitlement(firstEmp.id, initMonth)
        } else {
          setEmployeeId('')
          setBaseSalary(0)
          setWorkingDays(30)
          setDaysWorked(30)
          setTotalPreviousPaid(0)
          setTotalAdvances(0)
          setRemainingBalance(0)
          setStatus('Unpaid')
          setIsFinalized(false)
          setMonthlySalaryId('')
        }
      }
    } else {
      // Modal was already open; if employeeId was unset and employees became available, select first
      if (!employeeId && allEmployees.length > 0) {
        const firstEmp = allEmployees[0]
        setEmployeeId(firstEmp.id)
        fetchEntitlement(firstEmp.id, salaryMonth)
      }
    }
  }, [isOpen, prefilledRecord, defaultMonth, allEmployees, bankAccounts, cashBooks])

  const handleEmployeeCreated = (newEmp: EmployeeDto) => {
    setCreatedEmployees(prev => [newEmp, ...prev])
    setEmployeeId(newEmp.id)
    setIsAmountCustomized(false)
    queryClient.invalidateQueries({ queryKey: ['employeesListDropdown'] })
    queryClient.invalidateQueries({ queryKey: ['employeesList'] })
    setIsCreateEmployeeOpen(false)
    fetchEntitlement(newEmp.id, salaryMonth)
  }

  const loadDetails = async (id: string) => {
    try {
      setIsLoadingDetails(true)
      const details = await payrollService.getMonthlySalaryById(id)
      if (details) {
        setBonus(details.bonus || 0)
        setAdvanceDeduction(details.advanceDeduction || 0)
        setOtherDeduction(details.otherDeduction || 0)
        if (details.bonus || details.advanceDeduction || details.otherDeduction) {
          setShowAdjustments(true)
        }
        setTotalPreviousPaid(details.totalPaid || 0)
        setTotalAdvances(details.totalAdvances || 0)
        setRemainingBalance(details.remainingBalance || 0)
        setStatus(details.status || 'Unpaid')
        setIsFinalized(Boolean(details.isFinalized))
      }
    } catch {
      // Keep prefilled
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const fetchEntitlement = async (empId: string, mStr: string) => {
    if (!empId || !mStr) return
    const reqId = ++latestRequestIdRef.current
    try {
      setIsLoadingDetails(true)
      setErrorMessage(null)
      setServerLockError(null)
      const res = await payrollService.getOrCreateMonthlySalary({
        employeeId: empId,
        salaryMonth: mStr,
        workingDays: 30,
        daysWorked: 30,
        bonus: 0,
        advanceDeduction: 0,
        otherDeduction: 0
      })
      if (reqId !== latestRequestIdRef.current) return
      setMonthlySalaryId(res.id)
      setBaseSalary(res.baseSalary)
      setWorkingDays(res.workingDays || 30)
      setDaysWorked(res.daysWorked ?? res.workingDays ?? 30)
      setBonus(res.bonus || 0)
      setAdvanceDeduction(res.advanceDeduction || 0)
      setOtherDeduction(res.otherDeduction || 0)
      setTotalPreviousPaid(res.totalPaid || 0)
      setTotalAdvances(res.totalAdvances || 0)
      setRemainingBalance(res.remainingBalance || 0)
      setStatus(res.status || 'Unpaid')
      setIsFinalized(Boolean(res.isFinalized))
    } catch (err: any) {
      if (reqId !== latestRequestIdRef.current) return
      const msg = err.response?.data?.message || err.message || 'Unable to load salary entitlement for employee.'
      if (msg.includes('finalized and locked') || msg.includes('already finalized')) {
        setIsFinalized(true)
        setServerLockError(msg)
      } else {
        setErrorMessage(msg)
      }
    } finally {
      if (reqId === latestRequestIdRef.current) {
        setIsLoadingDetails(false)
      }
    }
  }

  // Live Settlement Computations
  const safeWorkingDays = workingDays > 0 ? workingDays : 30
  const safeDaysWorked = Math.max(0, daysWorked)
  const isAttendanceInvalid = safeDaysWorked > safeWorkingDays

  const earnedSalary =
    safeDaysWorked === safeWorkingDays
      ? baseSalary
      : roundToCurrency((baseSalary * safeDaysWorked) / safeWorkingDays)

  const finalPayable = roundToCurrency(
    earnedSalary + (Number(bonus) || 0) - (Number(advanceDeduction) || 0) - (Number(otherDeduction) || 0)
  )

  const settleDue = Math.max(0, roundToCurrency(finalPayable - totalPreviousPaid))

  // Eligibility Evaluation
  const eligibility: EligibilityState = useMemo(() => {
    if (isFinalized || serverLockError) {
      return 'LOCKED'
    }
    const statusLower = (status || '').toLowerCase()
    const isPaidInFull = (statusLower === 'fully paid' || statusLower === 'paid' || totalPreviousPaid >= earnedSalary) && settleDue <= 0.01 && baseSalary > 0
    if (isPaidInFull) {
      return 'NOTHING_PAYABLE'
    }
    return 'ELIGIBLE'
  }, [isFinalized, serverLockError, status, totalPreviousPaid, earnedSalary, settleDue, baseSalary])

  const isFormLocked = eligibility !== 'ELIGIBLE'

  // Focus close button on locked state
  useEffect(() => {
    if (isOpen && isFormLocked && closeButtonRef.current) {
      closeButtonRef.current.focus()
    }
  }, [isOpen, isFormLocked])

  // Sync default amount to pay
  useEffect(() => {
    if (!isAmountCustomized) {
      setAmount(settleDue > 0 ? settleDue.toFixed(2) : '0.00')
    }
  }, [settleDue, isAmountCustomized])

  const payNowNum = Number(amount) || 0
  const balanceAfter = Math.max(0, roundToCurrency(settleDue - payNowNum))
  const isPayExceeding = payNowNum > settleDue + 0.005

  // Account balance warning
  const selectedAccountBalance = useMemo(() => {
    if (paymentMethod === 'BankAccount') {
      const b = bankAccounts.find(x => x.id === bankAccountId)
      return b?.currentBalance ?? null
    } else {
      const c = cashBooks.find(x => x.id === cashBookId)
      return c?.currentBalance ?? null
    }
  }, [paymentMethod, bankAccountId, cashBookId, bankAccounts, cashBooks])

  const isLowAccountBalance =
    !isFormLocked &&
    selectedAccountBalance !== null &&
    payNowNum > 0 &&
    selectedAccountBalance < payNowNum

  // Handle Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting || isFormLocked) return
    setErrorMessage(null)

    if (isAttendanceInvalid) {
      setErrorMessage(`Days worked (${safeDaysWorked}) cannot exceed working days (${safeWorkingDays}).`)
      return
    }

    if (isPayExceeding) {
      setErrorMessage(`Payment amount cannot exceed the balance due of ${formatINR(settleDue)}.`)
      return
    }

    if (payNowNum <= 0 && !confirmFinalSettlement) {
      setErrorMessage('Please enter an amount to pay or check "Confirm final settlement".')
      return
    }

    try {
      setSubmitting(true)

      let targetId = monthlySalaryId
      if (!targetId) {
        const ent = await payrollService.getOrCreateMonthlySalary({
          employeeId,
          salaryMonth,
          workingDays: safeWorkingDays,
          daysWorked: safeDaysWorked,
          bonus: Number(bonus) || 0,
          advanceDeduction: Number(advanceDeduction) || 0,
          otherDeduction: Number(otherDeduction) || 0
        })
        targetId = ent.id
      }

      if (payNowNum <= 0.005 && confirmFinalSettlement) {
        await payrollService.finalizeMonthlySalary({
          monthlySalaryId: targetId,
          remarks: remarks.trim() || undefined
        })
      } else {
        await payrollService.processSalaryPayment({
          monthlySalaryId: targetId,
          paymentType: 'Salary Settlement',
          amount: payNowNum,
          paymentMethod,
          bankAccountId: paymentMethod === 'BankAccount' ? bankAccountId : undefined,
          cashBookId: paymentMethod === 'CashBook' ? cashBookId : undefined,
          workingDays: safeWorkingDays,
          daysWorked: safeDaysWorked,
          bonus: Number(bonus) || 0,
          advanceDeduction: Number(advanceDeduction) || 0,
          otherDeduction: Number(otherDeduction) || 0,
          paymentDate: paymentDate ? new Date(paymentDate).toISOString() : undefined,
          confirmFinalSettlement,
          remarks: remarks.trim() || undefined
        })
      }

      onPaymentSuccess()
      onClose()
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to record salary settlement.'
      if (msg.includes('finalized and locked') || msg.includes('already finalized')) {
        setIsFinalized(true)
        setServerLockError(msg)
      } else {
        setErrorMessage(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  const selectedEmp = allEmployees.find(e => e.id === employeeId)
  const empDisplayName = selectedEmp?.fullName || selectedEmp?.name || prefilledRecord?.employeeName || 'Employee'
  const monthDisplay = formatMonthLabel(salaryMonth)

  // Mock record for payslip view
  const currentRecordAsDirectory: MonthlySalaryDirectory = {
    id: monthlySalaryId,
    salaryNo: prefilledRecord?.salaryNo || '',
    employeeId,
    employeeName: empDisplayName,
    department: selectedEmp?.department || prefilledRecord?.department || 'Operations',
    designation: selectedEmp?.designation || prefilledRecord?.designation || '',
    salaryMonth,
    baseSalary,
    workingDays: safeWorkingDays,
    daysWorked: safeDaysWorked,
    earnedSalary,
    calculatedEntitlement: finalPayable,
    netSalaryEntitlement: finalPayable,
    totalAdvances,
    totalSettlements: totalPreviousPaid - totalAdvances,
    totalPaid: totalPreviousPaid,
    remainingBalance: settleDue,
    excessAdvance: 0,
    status,
    isFinalized,
    paymentsCount: 0
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden select-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-[640px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] animate-in fade-in zoom-in-95 duration-150 z-10 transition-all">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">Salary settlement</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Month-end final salary, calculated from attendance
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 text-xs">
          {/* ELIGIBILITY BANNERS AT THE VERY TOP */}
          {eligibility === 'LOCKED' && (
            <div
              role="alert"
              className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 animate-in fade-in"
            >
              <Lock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="font-bold text-xs">
                  {monthDisplay} is finalized and locked
                </div>
                <div className="text-[11px] text-rose-700 mt-0.5">
                  No further advances or settlements can be processed for this month.
                </div>
              </div>
            </div>
          )}

          {eligibility === 'NOTHING_PAYABLE' && (
            <div
              role="status"
              className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5 text-slate-800 animate-in fade-in"
            >
              <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="font-bold text-xs">
                  Nothing left to process for {empDisplayName} in {monthDisplay}
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  This salary is paid in full.
                </div>
              </div>
            </div>
          )}

          {/* Fallback Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Top Row: Employee Select & Month Select (ALWAYS ENABLED) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700">
                  Employee <span className="text-rose-500">*</span>
                </label>
                {!prefilledRecord && (
                  <button
                    type="button"
                    onClick={() => setIsCreateEmployeeOpen(true)}
                    className="text-xs text-[#1A56DB] hover:text-blue-700 hover:underline font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Employee</span>
                  </button>
                )}
              </div>
              <select
                value={employeeId}
                disabled={Boolean(prefilledRecord) || isLoadingDetails}
                onChange={e => {
                  const newId = e.target.value
                  setEmployeeId(newId)
                  setIsAmountCustomized(false)
                  fetchEntitlement(newId, salaryMonth)
                }}
                className="w-full h-[36px] px-3 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#1A56DB] disabled:bg-slate-100"
                required
              >
                {allEmployees.length === 0 ? (
                  <option value="">No employees found</option>
                ) : (
                  allEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName || emp.name} ({emp.department || 'Operations'})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Payroll Month <span className="text-rose-500">*</span>
              </label>
              <input
                type="month"
                value={salaryMonth}
                disabled={Boolean(prefilledRecord) || isLoadingDetails}
                onChange={e => {
                  const newMonth = e.target.value
                  setSalaryMonth(newMonth)
                  setIsAmountCustomized(false)
                  if (employeeId) fetchEntitlement(employeeId, newMonth)
                }}
                className="w-full h-[36px] px-3 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#1A56DB] disabled:bg-slate-100"
                required
              />
            </div>
          </div>

          {/* READ-ONLY SALARY BREAKDOWN CARD WHEN LOCKED/NOTHING PAYABLE */}
          {isFormLocked && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 animate-in fade-in">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-200">
                Salary breakdown · {monthDisplay}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Monthly Salary</span>
                  <span className="font-mono font-semibold text-slate-800">{formatINR(baseSalary)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Earned Salary</span>
                  <span className="font-mono font-semibold text-slate-800">{formatINR(earnedSalary)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Paid</span>
                  <span className="font-mono font-semibold text-slate-800">{formatINR(totalPreviousPaid)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Balance Due</span>
                  <span
                    className={`font-mono font-bold ${
                      settleDue <= 0.01 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {formatINR(settleDue)}{' '}
                    {settleDue <= 0.01 ? '(Paid in full)' : '(Locked)'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TWO-COLUMN SETTLEMENT GRID (DISABLED/DIMMED WHEN LOCKED) */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 ${isFormLocked ? 'opacity-40 pointer-events-none' : ''}`}>
            {/* Left Inputs */}
            <div className="space-y-3">
              {/* Attendance: Days Worked */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Days Worked (out of {safeWorkingDays})
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max={safeWorkingDays}
                    step="0.5"
                    value={daysWorked}
                    disabled={isFormLocked}
                    tabIndex={isFormLocked ? -1 : 0}
                    aria-disabled={isFormLocked}
                    onChange={e => setDaysWorked(Number(e.target.value))}
                    className="w-24 h-[36px] px-3 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#1A56DB] disabled:bg-slate-100"
                    required={!isFormLocked}
                  />
                  <span className="text-slate-500 font-medium">/ {safeWorkingDays} days</span>
                </div>
                {isAttendanceInvalid && !isFormLocked && (
                  <p className="text-[11px] text-rose-600 mt-1">
                    Cannot exceed {safeWorkingDays} working days.
                  </p>
                )}
              </div>

              {/* Amount to Pay Now */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">
                    Amount to Pay Now <span className="text-rose-500">*</span>
                  </label>
                  {!isFormLocked && settleDue > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setAmount(settleDue.toFixed(2))
                        setIsAmountCustomized(false)
                      }}
                      className="text-[11px] text-[#1A56DB] hover:underline font-semibold"
                    >
                      Pay full balance
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">₹</span>
                  <input
                    type="number"
                    min="0"
                    max={settleDue}
                    step="0.01"
                    value={amount}
                    disabled={isFormLocked}
                    tabIndex={isFormLocked ? -1 : 0}
                    aria-disabled={isFormLocked}
                    onChange={e => {
                      setAmount(e.target.value)
                      setIsAmountCustomized(true)
                    }}
                    placeholder="0.00"
                    className="w-full h-[36px] pl-7 pr-3 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-medium focus:outline-none focus:border-[#1A56DB] disabled:bg-slate-100"
                    required={!isFormLocked}
                  />
                </div>
              </div>

              {/* Payment Date */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Payment Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  disabled={isFormLocked}
                  tabIndex={isFormLocked ? -1 : 0}
                  aria-disabled={isFormLocked}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="w-full h-[36px] px-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#1A56DB] disabled:bg-slate-100"
                  required={!isFormLocked}
                />
              </div>

              {/* Paid via (Bank / Cash) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Paid Via</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isFormLocked}
                    tabIndex={isFormLocked ? -1 : 0}
                    onClick={() => setPaymentMethod('BankAccount')}
                    className={`flex-1 h-[34px] rounded-lg font-medium border text-xs transition-all ${
                      paymentMethod === 'BankAccount'
                        ? 'bg-blue-50 border-[#1A56DB] text-[#1A56DB] font-semibold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Bank Account
                  </button>
                  <button
                    type="button"
                    disabled={isFormLocked}
                    tabIndex={isFormLocked ? -1 : 0}
                    onClick={() => setPaymentMethod('CashBook')}
                    className={`flex-1 h-[34px] rounded-lg font-medium border text-xs transition-all ${
                      paymentMethod === 'CashBook'
                        ? 'bg-blue-50 border-[#1A56DB] text-[#1A56DB] font-semibold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Cash Register
                  </button>
                </div>
              </div>

              {/* Account Dropdown */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {paymentMethod === 'BankAccount' ? 'Bank Account' : 'Cash Book'}
                </label>
                {paymentMethod === 'BankAccount' ? (
                  <select
                    value={bankAccountId}
                    disabled={isFormLocked}
                    tabIndex={isFormLocked ? -1 : 0}
                    aria-disabled={isFormLocked}
                    onChange={e => setBankAccountId(e.target.value)}
                    className="w-full h-[36px] px-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#1A56DB] disabled:bg-slate-100"
                    required={!isFormLocked}
                  >
                    {bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} - {b.accountNumber} (Bal: {formatINR(b.currentBalance)})
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={cashBookId}
                    disabled={isFormLocked}
                    tabIndex={isFormLocked ? -1 : 0}
                    aria-disabled={isFormLocked}
                    onChange={e => setCashBookId(e.target.value)}
                    className="w-full h-[36px] px-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#1A56DB] disabled:bg-slate-100"
                    required={!isFormLocked}
                  >
                    {cashBooks.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Bal: {formatINR(c.currentBalance)})
                      </option>
                    ))}
                  </select>
                )}

                {/* Account balance warning */}
                {isLowAccountBalance && (
                  <div className="mt-1.5 p-2 rounded-md bg-amber-50 border border-amber-200 flex items-center gap-1.5 text-[11px] text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>
                      Warning: Amount exceeds selected account balance ({formatINR(selectedAccountBalance)}).
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Settlement Summary Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-200">
                  Settlement Summary
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Monthly Salary:</span>
                  <span className="font-mono font-medium text-slate-800">{formatINR(baseSalary)}</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Attendance:</span>
                  <span className="font-medium text-slate-800">
                    {safeDaysWorked} / {safeWorkingDays} days
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Earned Salary:</span>
                  <span className="font-mono font-semibold text-slate-900">{formatINR(earnedSalary)}</span>
                </div>

                {/* Add bonus or deduction toggle */}
                {!isFormLocked && (
                  <div className="pt-1">
                    {!showAdjustments ? (
                      <button
                        type="button"
                        onClick={() => setShowAdjustments(true)}
                        className="text-[11px] text-[#1A56DB] hover:underline font-medium"
                      >
                        + Add bonus or deduction
                      </button>
                    ) : (
                      <div className="space-y-1.5 p-2 bg-white rounded-lg border border-slate-200 mt-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-500">Bonus (+):</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={bonus}
                            onChange={e => setBonus(e.target.value)}
                            className="w-20 h-6 px-1.5 text-right font-mono border border-slate-200 rounded"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-500">Adv Deduction (-):</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={advanceDeduction}
                            onChange={e => setAdvanceDeduction(e.target.value)}
                            className="w-20 h-6 px-1.5 text-right font-mono border border-slate-200 rounded"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-500">Other Deduction (-):</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={otherDeduction}
                            onChange={e => setOtherDeduction(e.target.value)}
                            className="w-20 h-6 px-1.5 text-right font-mono border border-slate-200 rounded"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Paid So Far:</span>
                  <span className="font-mono font-medium text-slate-600">-{formatINR(totalPreviousPaid)}</span>
                </div>

                <div className="pt-1.5 border-t border-slate-200 flex justify-between items-center text-xs font-semibold">
                  <span className="text-slate-800">Balance Due:</span>
                  <span className={`font-mono ${settleDue > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                    {formatINR(settleDue)}
                  </span>
                </div>

                {!isFormLocked && (
                  <>
                    <div className="flex justify-between items-center text-xs pt-1">
                      <span className="text-slate-500">Paying Now:</span>
                      <span className="font-mono font-semibold text-[#1A56DB]">{formatINR(payNowNum)}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs pt-1 border-t border-dashed border-slate-200">
                      <span className="text-slate-800 font-medium">Balance After:</span>
                      <span
                        className={`font-mono font-bold ${
                          balanceAfter <= 0.01 ? 'text-emerald-600' : 'text-slate-800'
                        }`}
                      >
                        {formatINR(balanceAfter)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Status Outcome */}
              {!isFormLocked && (
                <div className="mt-3 pt-2 border-t border-slate-200">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      balanceAfter <= 0.01
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        balanceAfter <= 0.01 ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    {balanceAfter <= 0.01
                      ? 'Status becomes fully paid'
                      : 'Status becomes partially paid'}
                  </span>

                  {/* Finalize checkbox */}
                  <label className="flex items-center gap-2 mt-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmFinalSettlement}
                      onChange={e => setConfirmFinalSettlement(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-[#1A56DB] focus:ring-0"
                    />
                    <span className="text-[11px] text-slate-700">
                      Confirm final settlement (closes month)
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2.5 shrink-0">
          <div>
            {isFormLocked && onViewPayslip && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onViewPayslip(currentRecordAsDirectory)
                }}
                className="text-xs text-[#1A56DB] hover:underline font-semibold"
              >
                View payslip
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-[34px] px-3.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-medium text-xs transition-colors"
            >
              {isFormLocked ? 'Close' : 'Cancel'}
            </button>

            {!isFormLocked && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || isAttendanceInvalid || isPayExceeding}
                className="h-[34px] px-4 bg-[#1A56DB] hover:bg-blue-700 text-white font-medium rounded-lg text-xs shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Pay {formatINR(payNowNum)}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Create Employee Modal */}
      <QuickCreateEmployeeModal
        isOpen={isCreateEmployeeOpen}
        onClose={() => setIsCreateEmployeeOpen(false)}
        onSuccess={handleEmployeeCreated}
      />
    </div>
  )
}

export default SalarySettlementModal
