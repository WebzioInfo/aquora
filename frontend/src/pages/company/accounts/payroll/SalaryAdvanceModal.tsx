import React, { useState, useEffect, useMemo, useRef } from 'react'
import { X, AlertCircle, AlertTriangle, Lock, Info, Loader2, Plus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { MonthlySalaryDirectory } from '../../../../services/payroll'
import { payrollService } from '../../../../services/payroll'
import type { BankAccountDropdown, CashBookDropdown } from '../../../../services/simpleAccounts'
import type { EmployeeDto } from '../../../../services/employees'
import { QuickCreateEmployeeModal } from './QuickCreateEmployeeModal'
import {
  formatINR,
  formatMonthLabel,
  roundToCurrency
} from './payrollHelpers'

interface SalaryAdvanceModalProps {
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

type EligibilityState = 'ELIGIBLE' | 'LOCKED' | 'NOTHING_PAYABLE' | 'ADVANCE_LIMIT_REACHED'

export const SalaryAdvanceModal: React.FC<SalaryAdvanceModalProps> = ({
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

  const [isCreateEmployeeOpen, setIsCreateEmployeeOpen] = useState(false)
  const [createdEmployees, setCreatedEmployees] = useState<any[]>([])

  const [employeeId, setEmployeeId] = useState<string>('')
  const [salaryMonth, setSalaryMonth] = useState<string>('')
  const [monthlySalaryId, setMonthlySalaryId] = useState<string>('')
  const [monthlySalary, setMonthlySalary] = useState<number>(0)
  const [alreadyAdvanced, setAlreadyAdvanced] = useState<number>(0)
  const [totalPaid, setTotalPaid] = useState<number>(0)
  const [remainingBalance, setRemainingBalance] = useState<number>(0)
  const [status, setStatus] = useState<string>('Unpaid')
  const [isFinalized, setIsFinalized] = useState<boolean>(false)

  const [amount, setAmount] = useState<string>('')
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState<'BankAccount' | 'CashBook'>('BankAccount')
  const [bankAccountId, setBankAccountId] = useState<string>('')
  const [cashBookId, setCashBookId] = useState<string>('')
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
      setAmount('')
      setPaymentDate(new Date().toISOString().slice(0, 10))
      setPaymentMethod('BankAccount')
      setRemarks('')

      if (bankAccounts.length > 0) setBankAccountId(bankAccounts[0].id)
      if (cashBooks.length > 0) setCashBookId(cashBooks[0].id)

      if (prefilledRecord) {
        setEmployeeId(prefilledRecord.employeeId)
        setSalaryMonth(prefilledRecord.salaryMonth)
        setMonthlySalaryId(prefilledRecord.id)
        setMonthlySalary(prefilledRecord.baseSalary || 0)
        setAlreadyAdvanced(prefilledRecord.totalAdvances || 0)
        setTotalPaid(prefilledRecord.totalPaid || 0)
        setRemainingBalance(prefilledRecord.remainingBalance || 0)
        setStatus(prefilledRecord.status || 'Unpaid')
        setIsFinalized(Boolean(prefilledRecord.isFinalized))
        loadAdvanceData(prefilledRecord.id)
      } else {
        const initMonth = defaultMonth || new Date().toISOString().slice(0, 7)
        setSalaryMonth(initMonth)
        if (allEmployees.length > 0) {
          const firstEmp = allEmployees[0]
          setEmployeeId(firstEmp.id)
          fetchEntitlement(firstEmp.id, initMonth)
        } else {
          setEmployeeId('')
          setMonthlySalary(0)
          setAlreadyAdvanced(0)
          setTotalPaid(0)
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
    queryClient.invalidateQueries({ queryKey: ['employeesListDropdown'] })
    queryClient.invalidateQueries({ queryKey: ['employeesList'] })
    setIsCreateEmployeeOpen(false)
    fetchEntitlement(newEmp.id, salaryMonth)
  }

  const loadAdvanceData = async (id: string) => {
    try {
      setIsLoadingDetails(true)
      const details = await payrollService.getMonthlySalaryById(id)
      if (details) {
        setMonthlySalary(details.baseSalary || 0)
        setAlreadyAdvanced(details.totalAdvances || 0)
        setTotalPaid(details.totalPaid || 0)
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
      setMonthlySalaryId(res.id)
      setMonthlySalary(res.baseSalary || 0)
      setAlreadyAdvanced(res.totalAdvances || 0)
      setTotalPaid(res.totalPaid || 0)
      setRemainingBalance(res.remainingBalance || 0)
      setStatus(res.status || 'Unpaid')
      setIsFinalized(Boolean(res.isFinalized))
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Unable to load employee salary info.'
      if (msg.includes('finalized and locked') || msg.includes('already finalized')) {
        setIsFinalized(true)
        setServerLockError(msg)
      } else {
        setErrorMessage(msg)
      }
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const amountNum = Number(amount) || 0
  const maxAdvanceAllowed = Math.max(0, roundToCurrency(monthlySalary - alreadyAdvanced))
  const remainingAfterAdvance = Math.max(0, roundToCurrency(monthlySalary - (alreadyAdvanced + amountNum)))
  const isAdvanceExceeding = amountNum > maxAdvanceAllowed + 0.005

  // Eligibility Evaluation
  const eligibility: EligibilityState = useMemo(() => {
    if (isFinalized || serverLockError) {
      return 'LOCKED'
    }
    const statusLower = (status || '').toLowerCase()
    const isPaidInFull = (statusLower === 'fully paid' || statusLower === 'paid' || totalPaid >= monthlySalary) && remainingBalance <= 0.01 && monthlySalary > 0
    if (isPaidInFull) {
      return 'NOTHING_PAYABLE'
    }
    if (maxAdvanceAllowed <= 0.01 && monthlySalary > 0) {
      return 'ADVANCE_LIMIT_REACHED'
    }
    return 'ELIGIBLE'
  }, [isFinalized, serverLockError, status, totalPaid, monthlySalary, remainingBalance, maxAdvanceAllowed])

  const isFormLocked = eligibility !== 'ELIGIBLE'

  // Focus close button on locked state
  useEffect(() => {
    if (isOpen && isFormLocked && closeButtonRef.current) {
      closeButtonRef.current.focus()
    }
  }, [isOpen, isFormLocked])

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
    amountNum > 0 &&
    selectedAccountBalance < amountNum

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting || isFormLocked) return
    setErrorMessage(null)

    if (amountNum <= 0) {
      setErrorMessage('Advance amount must be greater than zero.')
      return
    }

    if (isAdvanceExceeding) {
      setErrorMessage(
        `Total advances (${formatINR(alreadyAdvanced + amountNum)}) cannot exceed monthly base salary of ${formatINR(
          monthlySalary
        )}.`
      )
      return
    }

    try {
      setSubmitting(true)

      let targetId = monthlySalaryId
      if (!targetId) {
        const res = await payrollService.getOrCreateMonthlySalary({
          employeeId,
          salaryMonth,
          workingDays: 30,
          daysWorked: 30,
          bonus: 0,
          advanceDeduction: 0,
          otherDeduction: 0
        })
        targetId = res.id
      }

      await payrollService.processSalaryPayment({
        monthlySalaryId: targetId,
        paymentType: 'Salary Advance',
        amount: amountNum,
        paymentMethod,
        bankAccountId: paymentMethod === 'BankAccount' ? bankAccountId : undefined,
        cashBookId: paymentMethod === 'CashBook' ? cashBookId : undefined,
        paymentDate: paymentDate ? new Date(paymentDate).toISOString() : undefined,
        remarks: remarks.trim() || undefined
      })

      onPaymentSuccess()
      onClose()
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to disburse salary advance.'
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

  // Preset percentage chips
  const presets = [
    { label: '15%', val: Math.round(monthlySalary * 0.15) },
    { label: '30%', val: Math.round(monthlySalary * 0.30) },
    { label: '50%', val: Math.round(monthlySalary * 0.50) },
    { label: 'Max', val: maxAdvanceAllowed }
  ]

  // Mock record for payslip view
  const currentRecordAsDirectory: MonthlySalaryDirectory = {
    id: monthlySalaryId,
    salaryNo: prefilledRecord?.salaryNo || '',
    employeeId,
    employeeName: empDisplayName,
    department: selectedEmp?.department || prefilledRecord?.department || 'Operations',
    designation: selectedEmp?.designation || prefilledRecord?.designation || '',
    salaryMonth,
    baseSalary: monthlySalary,
    workingDays: 30,
    daysWorked: 30,
    earnedSalary: monthlySalary,
    calculatedEntitlement: monthlySalary,
    netSalaryEntitlement: monthlySalary,
    totalAdvances: alreadyAdvanced,
    totalSettlements: totalPaid - alreadyAdvanced,
    totalPaid,
    remainingBalance,
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
      <div className="relative w-full max-w-[460px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] animate-in fade-in zoom-in-95 duration-150 z-10 transition-all">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">Salary advance</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Mid-month payment, recovered at month-end settlement
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
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3.5 text-xs">
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

          {eligibility === 'ADVANCE_LIMIT_REACHED' && (
            <div
              role="alert"
              className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900 animate-in fade-in"
            >
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="font-bold text-xs">Advance limit reached</div>
                <div className="text-[11px] text-amber-800 mt-0.5">
                  {empDisplayName} has already received the maximum advance for {monthDisplay}.
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

          {/* Employee & Month Select (ALWAYS ENABLED) */}
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
                  setEmployeeId(e.target.value)
                  fetchEntitlement(e.target.value, salaryMonth)
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
                Target Payroll Month <span className="text-rose-500">*</span>
              </label>
              <input
                type="month"
                value={salaryMonth}
                disabled={Boolean(prefilledRecord) || isLoadingDetails}
                onChange={e => {
                  setSalaryMonth(e.target.value)
                  if (employeeId) fetchEntitlement(employeeId, e.target.value)
                }}
                className="w-full h-[36px] px-3 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#1A56DB] disabled:bg-slate-100"
                required
              />
            </div>
          </div>

          {/* READ-ONLY SALARY BREAKDOWN CARD IN LOCKED/NOTHING PAYABLE/LIMIT REACHED STATES */}
          {isFormLocked ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-in fade-in">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-200">
                Salary breakdown · {monthDisplay}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Monthly Salary:</span>
                  <span className="font-mono font-semibold text-slate-800">{formatINR(monthlySalary)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Advances Taken:</span>
                  <span className="font-mono font-semibold text-amber-700">{formatINR(alreadyAdvanced)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Paid:</span>
                  <span className="font-mono font-semibold text-slate-800">{formatINR(totalPaid)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Balance:</span>
                  <span
                    className={`font-mono font-bold ${
                      remainingBalance <= 0.01 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {formatINR(remainingBalance)}{' '}
                    {remainingBalance <= 0.01 ? '(Paid in full)' : '(Locked)'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Three Info Tiles when eligible */
            <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Monthly Salary</span>
                <span className="font-mono font-bold text-slate-800 text-xs mt-0.5 block">{formatINR(monthlySalary)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Already Adv.</span>
                <span className="font-mono font-bold text-amber-700 text-xs mt-0.5 block">{formatINR(alreadyAdvanced)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">After Advance</span>
                <span className="font-mono font-bold text-slate-800 text-xs mt-0.5 block">{formatINR(remainingAfterAdvance)}</span>
              </div>
            </div>
          )}

          {/* ADVANCE INPUTS (RENDERED BUT DISABLED/DIMMED WHEN LOCKED) */}
          <div className={isFormLocked ? 'opacity-40 pointer-events-none space-y-3.5' : 'space-y-3.5'}>
            {/* Advance Amount with Quick Preset Chips */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700">
                  Advance Amount <span className="text-rose-500">*</span>
                </label>
                {!isFormLocked && (
                  <span className="text-[11px] text-slate-400">
                    Max: {formatINR(maxAdvanceAllowed)}
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">₹</span>
                <input
                  type="number"
                  min="1"
                  max={maxAdvanceAllowed}
                  step="0.01"
                  value={amount}
                  disabled={isFormLocked}
                  tabIndex={isFormLocked ? -1 : 0}
                  aria-disabled={isFormLocked}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-[36px] pl-7 pr-3 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-medium focus:outline-none focus:border-[#1A56DB] disabled:bg-slate-100"
                  required={!isFormLocked}
                />
              </div>

              {/* Chips (hidden when locked) */}
              {!isFormLocked && monthlySalary > 0 && maxAdvanceAllowed > 0 && (
                <div className="flex items-center gap-1.5 mt-2">
                  {presets.map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setAmount(String(p.val))}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-medium transition-colors"
                    >
                      {p.label} ({formatINR(p.val)})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Date & Method */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Date <span className="text-rose-500">*</span></label>
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
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Paid Via</label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={isFormLocked}
                    tabIndex={isFormLocked ? -1 : 0}
                    onClick={() => setPaymentMethod('BankAccount')}
                    className={`flex-1 h-[36px] rounded-lg font-medium border text-xs transition-all ${
                      paymentMethod === 'BankAccount'
                        ? 'bg-blue-50 border-[#1A56DB] text-[#1A56DB] font-semibold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Bank
                  </button>
                  <button
                    type="button"
                    disabled={isFormLocked}
                    tabIndex={isFormLocked ? -1 : 0}
                    onClick={() => setPaymentMethod('CashBook')}
                    className={`flex-1 h-[36px] rounded-lg font-medium border text-xs transition-all ${
                      paymentMethod === 'CashBook'
                        ? 'bg-blue-50 border-[#1A56DB] text-[#1A56DB] font-semibold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Cash
                  </button>
                </div>
              </div>
            </div>

            {/* Account Selection */}
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

              {isLowAccountBalance && (
                <div className="mt-1.5 p-2 rounded-md bg-amber-50 border border-amber-200 flex items-center gap-1.5 text-[11px] text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>
                    Warning: Amount exceeds selected account balance ({formatINR(selectedAccountBalance)}).
                  </span>
                </div>
              )}
            </div>

            {/* Remarks */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Notes / Remarks (Optional)</label>
              <input
                type="text"
                value={remarks}
                disabled={isFormLocked}
                tabIndex={isFormLocked ? -1 : 0}
                aria-disabled={isFormLocked}
                onChange={e => setRemarks(e.target.value)}
                placeholder="e.g. Festival advance, emergency request..."
                className="w-full h-[36px] px-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#1A56DB] disabled:bg-slate-100"
              />
            </div>
          </div>

          {/* Info Line (Only shown when form is eligible) */}
          {!isFormLocked && (
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200/70 text-blue-800 text-[11px] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
              <span>
                This will be deducted automatically in the{' '}
                <strong>{monthDisplay}</strong> settlement.
              </span>
            </div>
          )}
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
                disabled={submitting || isAdvanceExceeding || amountNum <= 0}
                className="h-[34px] px-4 bg-[#1A56DB] hover:bg-blue-700 text-white font-medium rounded-lg text-xs shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Give advance {formatINR(amountNum)}</span>
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

export default SalaryAdvanceModal
