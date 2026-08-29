import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { payrollService } from '../../../services/payroll'
import type {
  MonthlySalaryDirectory,
  MonthlySalaryDetails,
  ProcessSalaryPaymentRequest,
  SalaryPaymentTransaction
} from '../../../services/payroll'
import { simpleAccountsService } from '../../../services/simpleAccounts'
import type { BankAccountDropdown, CashBookDropdown } from '../../../services/simpleAccounts'
import { useNotificationStore } from '../../../store/useNotificationStore'
import EnterpriseHeader from '../../../components/ui/EnterpriseHeader'
import EnterpriseCard from '../../../components/ui/EnterpriseCard'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import EnterpriseBadge from '../../../components/ui/EnterpriseBadge'
import EnterpriseModal from '../../../components/ui/EnterpriseModal'
import EnterpriseLoading from '../../../components/ui/EnterpriseLoading'
import { api } from '../../../services/api'
import { Search, Trash2, Printer, Landmark, Wallet, Receipt, DollarSign, AlertCircle, ArrowUpRight, Calculator, Loader2, CheckCircle2, MoreVertical, Eye, History, Clock, Lock, FileText, Users, Calendar, Download } from 'lucide-react'
import { PrintPreviewModal } from '../../../components/ui/PrintPreviewModal'
import { generateSalarySlipPDF, printSalarySlip, generateSalaryHistoryPDF, printSalaryHistory } from '../../../utils/salaryStatementPdfEngine'

export const PayrollPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { showToast } = useNotificationStore()

  // Table Page/Filter state
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize] = useState(10)
  const [searchTerm, setSearchTerm] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')

  // Scoped Action Loading Key to prevent double-clicks & show instant feedback
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null)

  // Modals state
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false)
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isUnpaidWarningModalOpen, setIsUnpaidWarningModalOpen] = useState(false)
  const [confirmFinalSettlement, setConfirmFinalSettlement] = useState(false)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  // Settlement Modal Modes & Dynamic Engine State
  const [settlementMode, setSettlementMode] = useState<'create' | 'contextual'>('create')
  const [isSettlementLoading, setIsSettlementLoading] = useState(false)
  const [settleEntitlement, setSettleEntitlement] = useState<MonthlySalaryDetails | null>(null)

  // Advance Modal Modes & Dynamic Engine State
  const [advanceMode, setAdvanceMode] = useState<'create' | 'contextual'>('create')
  const [isAdvanceLoading, setIsAdvanceLoading] = useState(false)

  // Selected Entitlement & Details
  const [selectedEntitlement, setSelectedEntitlement] = useState<MonthlySalaryDetails | null>(null)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [isPrintingDoc, setIsPrintingDoc] = useState(false)

  // Print Preview Modal States
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [printDocData, setPrintDocData] = useState<any>(null)

  const [formError, setFormError] = useState<string | null>(null)

  // 1. Advance Form State
  const [advanceForm, setAdvanceForm] = useState({
    monthlySalaryId: '',
    employeeId: '',
    employeeName: '',
    department: '',
    designation: '',
    salaryMonth: new Date().toISOString().substring(0, 7),
    monthlySalary: 0,
    alreadyAdvanced: 0,
    amount: '' as number | string,
    paymentMethod: 'BankAccount',
    bankAccountId: '',
    cashBookId: '',
    paymentDate: new Date().toISOString().substring(0, 10),
    remarks: ''
  })

  // 2. Settlement Form State
  const [settleForm, setSettleForm] = useState({
    monthlySalaryId: '',
    employeeId: '',
    employeeName: '',
    department: '',
    designation: '',
    salaryMonth: new Date().toISOString().substring(0, 7),
    monthlySalary: 0,
    workingDays: 30 as number | string,
    daysWorked: 30 as number | string,
    bonus: 0 as number | string,
    advanceDeduction: 0 as number | string,
    otherDeduction: 0 as number | string,
    totalAdvancesPaid: 0,
    previousSettlementsPaid: 0,
    amount: '' as number | string,
    paymentMethod: 'BankAccount',
    bankAccountId: '',
    cashBookId: '',
    paymentDate: new Date().toISOString().substring(0, 10),
    remarks: ''
  })

  const roundToCurrency = (val: number | string): number => {
    const num = typeof val === 'number' ? val : parseFloat(String(val))
    if (isNaN(num)) return 0
    return Math.round((num + Number.EPSILON) * 100) / 100
  }

  // Settlement Calculations
  const settleWorkingDaysNum = Number(settleForm.workingDays) || 30
  const settleDaysWorkedNum = Number(settleForm.daysWorked) >= 0 ? Number(settleForm.daysWorked) : 0
  const settleUnworkedDays = Math.max(0, settleWorkingDaysNum - settleDaysWorkedNum)
  const isAttendanceInvalid = settleDaysWorkedNum > settleWorkingDaysNum

  const settleDailyRate = settleWorkingDaysNum > 0 ? roundToCurrency(settleForm.monthlySalary / settleWorkingDaysNum) : 0
  const settleEarnedSalary = (settleDaysWorkedNum === settleWorkingDaysNum) ? roundToCurrency(settleForm.monthlySalary) : roundToCurrency((settleForm.monthlySalary * settleDaysWorkedNum) / settleWorkingDaysNum)
  const settleFinalPayable = roundToCurrency(settleEarnedSalary + (Number(settleForm.bonus) || 0) - (Number(settleForm.advanceDeduction) || 0) - (Number(settleForm.otherDeduction) || 0))
  const settleTotalPreviousPaid = roundToCurrency(settleForm.totalAdvancesPaid + settleForm.previousSettlementsPaid)
  const settleDueRaw = roundToCurrency(settleFinalPayable - settleTotalPreviousPaid)
  const settleDue = Math.max(0, settleDueRaw)
  const excessAdvance = settleDueRaw < 0 ? roundToCurrency(Math.abs(settleDueRaw)) : 0

  const payNowAmountNum = roundToCurrency(settleForm.amount)
  const remainingAfterPayment = Math.max(0, roundToCurrency(settleDue - payNowAmountNum))
  const isPayNowExceeding = payNowAmountNum > (settleDue + 0.005)

  const [isAmountCustomized, setIsAmountCustomized] = useState(false)

  // Auto-sync amount to pay when attendance or settlement parameters change
  useEffect(() => {
    if (!isSettlementModalOpen) return
    if (!isAmountCustomized) {
      setSettleForm(prev => ({
        ...prev,
        amount: settleDue > 0 ? settleDue : ''
      }))
    } else {
      const currentAmt = Number(settleForm.amount) || 0
      if (currentAmt > settleDue) {
        setSettleForm(prev => ({
          ...prev,
          amount: settleDue > 0 ? settleDue : ''
        }))
        setIsAmountCustomized(false)
      }
    }
  }, [settleDue, isSettlementModalOpen, isAmountCustomized])

  // Queries
  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ['employeesListDropdown'],
    queryFn: async () => {
      const res = await api.get('/api/v1/employees')
      return res.data.data
    }
  })

  const { data: bankAccounts = [] } = useQuery<BankAccountDropdown[]>({
    queryKey: ['bankAccountDropdownList'],
    queryFn: () => simpleAccountsService.getBankAccountDropdown()
  })

  const { data: cashBooks = [] } = useQuery<CashBookDropdown[]>({
    queryKey: ['cashBookDropdownList'],
    queryFn: () => simpleAccountsService.getCashBookDropdown()
  })

  const { data: payrollMetrics } = useQuery({
    queryKey: ['payrollMetrics', monthFilter],
    queryFn: () => payrollService.getPayrollMetrics(monthFilter || undefined)
  })

  const { data: payrollData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['salaryPaymentsList', pageNumber, pageSize, searchTerm, monthFilter, employeeFilter],
    queryFn: () => payrollService.getMonthlySalaries({
      pageNumber,
      pageSize,
      search: searchTerm || undefined,
      month: monthFilter || undefined,
      employeeId: employeeFilter || undefined
    })
  })

  // Mutations
  const processPaymentMutation = useMutation({
    mutationFn: (req: ProcessSalaryPaymentRequest) => payrollService.processSalaryPayment(req),
    onSuccess: () => {
      showToast('Salary payment processed successfully.', 'success')
      setIsAdvanceModalOpen(false)
      setIsSettlementModalOpen(false)
      setIsUnpaidWarningModalOpen(false)
      setConfirmFinalSettlement(false)
      queryClient.invalidateQueries({ queryKey: ['salaryPaymentsList'] })
      queryClient.invalidateQueries({ queryKey: ['payrollMetrics'] })
      queryClient.invalidateQueries({ queryKey: ['bankAccountDropdownList'] })
      queryClient.invalidateQueries({ queryKey: ['cashBookDropdownList'] })
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Error processing salary payment.'
      setFormError(msg)
      showToast(msg, 'error')
    }
  })

  const finalizeMutation = useMutation({
    mutationFn: (req: { monthlySalaryId: string; forceFinalizeWithUnpaid?: boolean; remarks?: string }) =>
      payrollService.finalizeMonthlySalary(req),
    onSuccess: () => {
      showToast('Payroll month finalized and closed successfully.', 'success')
      setIsSettlementModalOpen(false)
      setIsUnpaidWarningModalOpen(false)
      setConfirmFinalSettlement(false)
      queryClient.invalidateQueries({ queryKey: ['salaryPaymentsList'] })
      queryClient.invalidateQueries({ queryKey: ['payrollMetrics'] })
      queryClient.invalidateQueries({ queryKey: ['bankAccountDropdownList'] })
      queryClient.invalidateQueries({ queryKey: ['cashBookDropdownList'] })
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Error finalizing payroll month.'
      setFormError(msg)
      showToast(msg, 'error')
    }
  })

  const reverseTransactionMutation = useMutation({
    mutationFn: (transactionId: string) => payrollService.reverseSalaryTransaction(transactionId),
    onSuccess: async () => {
      showToast('Payment transaction reversed successfully.', 'success')
      queryClient.invalidateQueries({ queryKey: ['salaryPaymentsList'] })
      queryClient.invalidateQueries({ queryKey: ['payrollMetrics'] })
      queryClient.invalidateQueries({ queryKey: ['bankAccountDropdownList'] })
      queryClient.invalidateQueries({ queryKey: ['cashBookDropdownList'] })
      if (selectedEntitlement) {
        const updated = await payrollService.getMonthlySalaryById(selectedEntitlement.id)
        if (updated) setSelectedEntitlement(updated)
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error reversing payment.'
      showToast(msg, 'error')
    }
  })

  // ==========================================
  // MODAL OPEN HANDLERS WITH DOUBLE-CLICK GUARD & INSTANT LOADING
  // ==========================================

  // A1. OPEN GLOBAL SALARY ADVANCE MODAL (MODE A - FRESH CREATION)
  const openGlobalAdvanceModal = () => {
    setAdvanceMode('create')
    setFormError(null)
    setAdvanceForm({
      monthlySalaryId: '',
      employeeId: '',
      employeeName: '',
      department: '',
      designation: '',
      salaryMonth: monthFilter || new Date().toISOString().substring(0, 7),
      monthlySalary: 0,
      alreadyAdvanced: 0,
      amount: '',
      paymentMethod: 'BankAccount',
      bankAccountId: bankAccounts.length > 0 ? bankAccounts[0].id : '',
      cashBookId: cashBooks.length > 0 ? cashBooks[0].id : '',
      paymentDate: new Date().toISOString().substring(0, 10),
      remarks: ''
    })
    setIsAdvanceModalOpen(true)
  }

  // A2. OPEN ROW SALARY ADVANCE MODAL (MODE B - CONTEXTUAL)
  const openRowAdvanceModal = async (item: MonthlySalaryDirectory) => {
    setAdvanceMode('contextual')
    setFormError(null)
    const actionKey = `advance-${item.id}`
    if (actionLoadingKey !== null) return // Logic-level double click guard
    setActionLoadingKey(actionKey) // Instant UI feedback

    try {
      const details = await payrollService.getMonthlySalaryById(item.id)
      const alreadyAdv = details ? (details.totalAdvances || 0) : (item.totalAdvances || 0)

      setAdvanceForm({
        monthlySalaryId: item.id,
        employeeId: item.employeeId,
        employeeName: item.employeeName,
        department: item.department,
        designation: item.designation || '',
        salaryMonth: item.salaryMonth,
        monthlySalary: item.baseSalary,
        alreadyAdvanced: alreadyAdv,
        amount: '',
        paymentMethod: 'BankAccount',
        bankAccountId: bankAccounts.length > 0 ? bankAccounts[0].id : '',
        cashBookId: cashBooks.length > 0 ? cashBooks[0].id : '',
        paymentDate: new Date().toISOString().substring(0, 10),
        remarks: ''
      })
      setIsAdvanceModalOpen(true)
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Unable to load advance data.', 'error')
    } finally {
      setActionLoadingKey(null)
    }
  }

  // A3. DYNAMIC DATA LOADER FOR ADVANCE MODAL
  const loadAdvanceData = async (employeeId: string, month: string) => {
    if (!employeeId || !month) {
      setAdvanceForm(prev => ({
        ...prev,
        monthlySalaryId: '',
        employeeId: '',
        employeeName: '',
        department: '',
        designation: '',
        monthlySalary: 0,
        alreadyAdvanced: 0,
        amount: ''
      }))
      return
    }

    setIsAdvanceLoading(true)
    setFormError(null)

    const emp = employees.find(e => e.id === employeeId)

    try {
      const details = await payrollService.getOrCreateMonthlySalary({
        employeeId,
        salaryMonth: month,
        workingDays: 30,
        daysWorked: 30,
        bonus: 0,
        advanceDeduction: 0,
        otherDeduction: 0
      })

      setAdvanceForm(prev => ({
        ...prev,
        monthlySalaryId: details.id,
        employeeId,
        employeeName: details.employeeName || emp?.fullName || '',
        department: details.department || emp?.department || 'Staff',
        designation: details.designation || emp?.designation || '',
        salaryMonth: month,
        monthlySalary: details.baseSalary,
        alreadyAdvanced: details.totalAdvances || 0
      }))
    } catch {
      setAdvanceForm(prev => ({
        ...prev,
        employeeId,
        employeeName: emp?.fullName || '',
        department: emp?.department || 'Staff',
        designation: emp?.designation || '',
        salaryMonth: month,
        monthlySalary: emp?.currentSalary || 0,
        alreadyAdvanced: 0
      }))
    } finally {
      setIsAdvanceLoading(false)
    }
  }

  // Handle employee selection change in Advance modal (MODE A)
  const handleAdvanceEmployeeChange = async (empId: string) => {
    setAdvanceForm(prev => ({ ...prev, employeeId: empId, amount: '' }))
    await loadAdvanceData(empId, advanceForm.salaryMonth)
  }

  // Handle month selection change in Advance modal (MODE A)
  const handleAdvanceMonthChange = async (newMonth: string) => {
    setAdvanceForm(prev => ({ ...prev, salaryMonth: newMonth, amount: '' }))
    if (advanceForm.employeeId) {
      await loadAdvanceData(advanceForm.employeeId, newMonth)
    }
  }

  // B. DYNAMIC SALARY SETTLEMENT ENGINE
  const loadSettlementData = async (employeeId: string, month: string, targetId?: string) => {
    if (!employeeId || !month) {
      setSettleForm(prev => ({
        ...prev,
        monthlySalaryId: '',
        employeeId: '',
        employeeName: '',
        department: '',
        designation: '',
        monthlySalary: 0,
        workingDays: 30,
        daysWorked: 30,
        bonus: 0,
        advanceDeduction: 0,
        otherDeduction: 0,
        totalAdvancesPaid: 0,
        previousSettlementsPaid: 0,
        amount: ''
      }))
      setSettleEntitlement(null)
      return
    }

    setIsSettlementLoading(true)
    setFormError(null)

    try {
      const selectedEmp = employees.find(e => e.id === employeeId)
      let details: MonthlySalaryDetails | null = null

      if (targetId) {
        details = await payrollService.getMonthlySalaryById(targetId)
      } else {
        const entitlementRecord = await payrollService.getOrCreateMonthlySalary({
          employeeId: employeeId,
          salaryMonth: month,
          workingDays: 30,
          daysWorked: 30,
          bonus: 0,
          advanceDeduction: 0,
          otherDeduction: 0
        })
        details = await payrollService.getMonthlySalaryById(entitlementRecord.id)
      }

      if (details) {
        setSettleEntitlement(details)
        setSelectedEntitlement(details)

        const totalAdv = details.totalAdvances || 0
        const totalSet = details.totalSettlements || 0
        const wDays = details.workingDays > 0 ? details.workingDays : 30
        const dWorked = details.daysWorked >= 0 ? details.daysWorked : wDays
        const baseSal = details.baseSalary

        const dailyRate = wDays > 0 ? Math.round((baseSal / wDays) * 100) / 100 : 0
        const earnedGross = dWorked === wDays ? baseSal : Math.round(((baseSal * dWorked) / wDays) * 100) / 100
        const finalPayable = Math.round((earnedGross + details.bonus - details.advanceDeduction - details.otherDeduction) * 100) / 100
        const totalPrevPaid = totalAdv + totalSet
        const due = Math.max(0, finalPayable - totalPrevPaid)

        setSettleForm({
          monthlySalaryId: details.id,
          employeeId: details.employeeId,
          employeeName: details.employeeName || selectedEmp?.fullName || 'Employee',
          department: details.department || selectedEmp?.department || 'Staff',
          designation: details.designation || selectedEmp?.designation || '',
          salaryMonth: details.salaryMonth,
          monthlySalary: baseSal,
          workingDays: wDays,
          daysWorked: dWorked,
          bonus: details.bonus || 0,
          advanceDeduction: details.advanceDeduction || 0,
          otherDeduction: details.otherDeduction || 0,
          totalAdvancesPaid: totalAdv,
          previousSettlementsPaid: totalSet,
          amount: due > 0 ? due : '',
          paymentMethod: 'BankAccount',
          bankAccountId: bankAccounts.length > 0 ? bankAccounts[0].id : '',
          cashBookId: cashBooks.length > 0 ? cashBooks[0].id : '',
          paymentDate: new Date().toISOString().substring(0, 10),
          remarks: ''
        })
        setConfirmFinalSettlement(details.isFinalized || false)
        setIsAmountCustomized(false)
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Unable to load settlement details for selected employee.')
    } finally {
      setIsSettlementLoading(false)
    }
  }

  // B1. OPEN FRESH SALARY SETTLEMENT MODAL (MODE A - CREATE)
  const openFreshSettlementModal = () => {
    if (actionLoadingKey !== null) return
    setFormError(null)
    setSettlementMode('create')
    setSettleEntitlement(null)
    setConfirmFinalSettlement(false)
    setIsAmountCustomized(false)

    const currentMonth = new Date().toISOString().substring(0, 7)
    const initialMonth = monthFilter || currentMonth

    setSettleForm({
      monthlySalaryId: '',
      employeeId: '',
      employeeName: '',
      department: '',
      designation: '',
      salaryMonth: initialMonth,
      monthlySalary: 0,
      workingDays: 30,
      daysWorked: 30,
      bonus: 0,
      advanceDeduction: 0,
      otherDeduction: 0,
      totalAdvancesPaid: 0,
      previousSettlementsPaid: 0,
      amount: '',
      paymentMethod: 'BankAccount',
      bankAccountId: bankAccounts.length > 0 ? bankAccounts[0].id : '',
      cashBookId: cashBooks.length > 0 ? cashBooks[0].id : '',
      paymentDate: new Date().toISOString().substring(0, 10),
      remarks: ''
    })

    setIsSettlementModalOpen(true)
  }

  // B2. OPEN ROW SALARY SETTLEMENT MODAL (MODE B - CONTEXTUAL)
  const openRowSettlementModal = async (item: MonthlySalaryDirectory) => {
    const actionKey = `settle-${item.id}`
    if (actionLoadingKey !== null) return
    setActionLoadingKey(actionKey)
    setFormError(null)
    setSettlementMode('contextual')
    setIsAmountCustomized(false)

    try {
      await loadSettlementData(item.employeeId, item.salaryMonth, item.id)
      setIsSettlementModalOpen(true)
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Unable to load row settlement details.', 'error')
    } finally {
      setActionLoadingKey(null)
    }
  }

  // B3. HANDLE EMPLOYEE SELECTION CHANGE (MODE A)
  const handleSettlementEmployeeChange = async (empId: string) => {
    if (!empId) {
      setSettleForm(prev => ({
        ...prev,
        monthlySalaryId: '',
        employeeId: '',
        employeeName: '',
        department: '',
        designation: '',
        monthlySalary: 0,
        workingDays: 30,
        daysWorked: 30,
        bonus: 0,
        advanceDeduction: 0,
        otherDeduction: 0,
        totalAdvancesPaid: 0,
        previousSettlementsPaid: 0,
        amount: ''
      }))
      setSettleEntitlement(null)
      return
    }

    setSettleForm(prev => ({ ...prev, employeeId: empId }))
    await loadSettlementData(empId, settleForm.salaryMonth)
  }

  // B4. HANDLE MONTH SELECTION CHANGE (MODE A)
  const handleSettlementMonthChange = async (newMonth: string) => {
    setSettleForm(prev => ({ ...prev, salaryMonth: newMonth }))
    if (settleForm.employeeId) {
      await loadSettlementData(settleForm.employeeId, newMonth)
    }
  }

  // C. VIEW STATEMENT
  const openViewModal = async (id: string) => {
    const actionKey = `view-${id}`
    if (actionLoadingKey !== null) return // Logic-level double click guard
    setActionLoadingKey(actionKey) // Instant UI feedback
    try {
      const details = await payrollService.getMonthlySalaryById(id)
      if (details) {
        setSelectedEntitlement(details)
        setIsViewModalOpen(true)
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Unable to load statement details. Please try again.', 'error')
    } finally {
      setActionLoadingKey(null)
    }
  }

  // D. PAYMENT HISTORY
  const openHistoryModal = async (item: MonthlySalaryDirectory) => {
    const actionKey = `history-${item.id}`
    if (actionLoadingKey !== null) return // Logic-level double click guard
    setActionLoadingKey(actionKey) // Instant UI feedback
    try {
      const details = await payrollService.getMonthlySalaryById(item.id)
      if (details) {
        setSelectedEntitlement(details)
        setIsHistoryOpen(true)
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Unable to load payment history. Please try again.', 'error')
    } finally {
      setActionLoadingKey(null)
    }
  }

  const handleDownloadSalarySlip = async (details: MonthlySalaryDetails | null) => {
    if (!details || !details.employeeId) {
      showToast('Employee information is missing.', 'error')
      return
    }

    try {
      setIsExportingPdf(true)
      const report = await payrollService.getEmployeeSalaryStatement(details.employeeId, details.salaryMonth)
      if (!report) {
        showToast('Unable to load salary slip details.', 'error')
        return
      }

      const pdf = generateSalarySlipPDF(report)
      const sanitizedName = (report.employee.fullName || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_')
      const sanitizedMonth = (report.currentStatement.salaryMonth || 'Slip').replace(/[^a-zA-Z0-9_-]/g, '_')
      pdf.save(`Aquzio_Salary_Slip_${sanitizedName}_${sanitizedMonth}.pdf`)
      showToast(`Salary slip for ${report.employee.fullName} downloaded successfully.`, 'success')
    } catch (err: any) {
      console.error('Failed to generate salary slip PDF:', err)
      showToast(err.response?.data?.message || 'Failed to generate salary slip PDF.', 'error')
    } finally {
      setIsExportingPdf(false)
    }
  }

  const handlePrintSalarySlip = async (details: MonthlySalaryDetails | null) => {
    if (!details || !details.employeeId) {
      showToast('Employee information is missing.', 'error')
      return
    }

    try {
      setIsPrintingDoc(true)
      const report = await payrollService.getEmployeeSalaryStatement(details.employeeId, details.salaryMonth)
      if (!report) {
        showToast('Unable to load salary slip details.', 'error')
        return
      }

      printSalarySlip(report)
    } catch (err: any) {
      console.error('Failed to prepare salary slip for printing:', err)
      showToast(err.response?.data?.message || 'Failed to prepare print document.', 'error')
    } finally {
      setIsPrintingDoc(false)
    }
  }

  const handleDownloadSalaryHistory = async (details: MonthlySalaryDetails | null) => {
    if (!details || !details.employeeId) {
      showToast('Employee information is missing.', 'error')
      return
    }

    try {
      setIsExportingPdf(true)
      const report = await payrollService.getEmployeeSalaryStatement(details.employeeId, details.salaryMonth)
      if (!report) {
        showToast('Unable to load employee salary history.', 'error')
        return
      }

      const pdf = generateSalaryHistoryPDF(report)
      const sanitizedName = (report.employee.fullName || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_')
      pdf.save(`Aquzio_Salary_History_${sanitizedName}.pdf`)
      showToast(`Complete salary history for ${report.employee.fullName} downloaded successfully.`, 'success')
    } catch (err: any) {
      console.error('Failed to generate salary history PDF:', err)
      showToast(err.response?.data?.message || 'Failed to generate salary history PDF.', 'error')
    } finally {
      setIsExportingPdf(false)
    }
  }

  const handlePrintPayslip = async (details: MonthlySalaryDetails, _transaction?: SalaryPaymentTransaction) => {
    await handlePrintSalarySlip(details)
  }

  // SUBMIT ADVANCE FORM
  const handleAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (processPaymentMutation.isPending) return
    setFormError(null)

    if (!advanceForm.employeeId) {
      setFormError('Please select an employee.')
      return
    }

    if (!advanceForm.salaryMonth) {
      setFormError('Please select a payroll month.')
      return
    }

    const amountNum = roundToCurrency(advanceForm.amount)
    if (amountNum <= 0) {
      setFormError('Advance amount must be greater than zero.')
      return
    }

    const maxAllowed = Math.max(0, roundToCurrency(advanceForm.monthlySalary - advanceForm.alreadyAdvanced))
    if (amountNum > (maxAllowed + 0.005)) {
      setFormError(`Total advances (₹${(advanceForm.alreadyAdvanced + amountNum).toLocaleString('en-IN', { minimumFractionDigits: 2 })}) cannot exceed the employee's monthly base salary of ₹${advanceForm.monthlySalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`)
      return
    }

    let targetId = advanceForm.monthlySalaryId
    if (!targetId) {
      try {
        const created = await payrollService.getOrCreateMonthlySalary({
          employeeId: advanceForm.employeeId,
          salaryMonth: advanceForm.salaryMonth,
          workingDays: 30,
          daysWorked: 30,
          bonus: 0,
          advanceDeduction: 0,
          otherDeduction: 0
        })
        targetId = created.id
      } catch (err: any) {
        setFormError(err.response?.data?.message || 'Failed to initialize salary ledger for advance.')
        return
      }
    }

    // Account Balance Verification
    if (advanceForm.paymentMethod === 'BankAccount') {
      const bank = bankAccounts.find(b => b.id === advanceForm.bankAccountId)
      if (bank && bank.accountType !== 'OD' && bank.currentBalance < amountNum) {
        setFormError(`Insufficient balance in selected bank account. Current balance: ₹${bank.currentBalance.toLocaleString('en-IN')}`)
        return
      }
    } else {
      const cash = cashBooks.find(c => c.id === advanceForm.cashBookId)
      if (cash && cash.currentBalance < amountNum) {
        setFormError(`Insufficient balance in selected cash book. Current balance: ₹${cash.currentBalance.toLocaleString('en-IN')}`)
        return
      }
    }

    processPaymentMutation.mutate({
      monthlySalaryId: targetId,
      paymentType: 'Salary Advance',
      amount: amountNum,
      paymentMethod: advanceForm.paymentMethod,
      bankAccountId: advanceForm.paymentMethod === 'BankAccount' ? advanceForm.bankAccountId : undefined,
      cashBookId: advanceForm.paymentMethod === 'CashBook' ? advanceForm.cashBookId : undefined,
      paymentDate: advanceForm.paymentDate ? new Date(advanceForm.paymentDate).toISOString() : undefined,
      remarks: advanceForm.remarks.trim() || undefined
    })
  }

  // SUBMIT SETTLEMENT FORM
  const handleSettlementSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (processPaymentMutation.isPending || finalizeMutation.isPending) return
    setFormError(null)

    if (isAttendanceInvalid) {
      setFormError(`Days worked (${settleDaysWorkedNum}) cannot be greater than working days in month (${settleWorkingDaysNum}). Please correct attendance before proceeding.`)
      return
    }

    const amountNum = roundToCurrency(settleForm.amount)

    // CASE A: Financially Fully Paid (Pending <= ₹0.01) or zero amount with finalization check
    if (settleDue <= 0.005 || (amountNum <= 0.005 && confirmFinalSettlement)) {
      if (!confirmFinalSettlement) {
        setFormError('Salary is already fully paid. Check "Confirm final settlement" to close this payroll month.')
        return
      }
      finalizeMutation.mutate({
        monthlySalaryId: settleForm.monthlySalaryId,
        remarks: settleForm.remarks.trim() || undefined
      })
      return
    }

    if (amountNum < 0) {
      setFormError('Settlement amount cannot be negative.')
      return
    }

    if (amountNum > (settleDue + 0.005)) {
      setFormError(`Amount cannot exceed the remaining salary of ₹${settleDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`)
      return
    }

    if (amountNum === 0 && !confirmFinalSettlement) {
      setFormError('Enter a payment amount or check "Confirm final settlement" to close this payroll month.')
      return
    }

    // Account Balance Verification (only if paying cash > 0)
    if (amountNum > 0) {
      if (settleForm.paymentMethod === 'BankAccount') {
        const bank = bankAccounts.find(b => b.id === settleForm.bankAccountId)
        if (bank && bank.accountType !== 'OD' && bank.currentBalance < amountNum) {
          setFormError(`Insufficient balance in selected bank account. Current balance: ₹${bank.currentBalance.toLocaleString('en-IN')}`)
          return
        }
      } else {
        const cash = cashBooks.find(c => c.id === settleForm.cashBookId)
        if (cash && cash.currentBalance < amountNum) {
          setFormError(`Insufficient balance in selected cash book. Current balance: ₹${cash.currentBalance.toLocaleString('en-IN')}`)
          return
        }
      }
    }

    const remainingUnpaidAfterThis = Math.max(0, roundToCurrency(settleDue - amountNum))
    if (confirmFinalSettlement && remainingUnpaidAfterThis > 0.005) {
      setIsUnpaidWarningModalOpen(true)
      return
    }

    executeSettlePayment(confirmFinalSettlement, false)
  }

  const executeSettlePayment = (isFinalizing: boolean, forceWithUnpaid: boolean) => {
    const amountNum = roundToCurrency(settleForm.amount)
    if (amountNum <= 0.005 && isFinalizing) {
      finalizeMutation.mutate({
        monthlySalaryId: settleForm.monthlySalaryId,
        forceFinalizeWithUnpaid: forceWithUnpaid,
        remarks: settleForm.remarks.trim() || undefined
      })
      return
    }

    processPaymentMutation.mutate({
      monthlySalaryId: settleForm.monthlySalaryId,
      paymentType: 'Salary Settlement',
      amount: amountNum,
      paymentMethod: settleForm.paymentMethod,
      bankAccountId: settleForm.paymentMethod === 'BankAccount' ? (settleForm.bankAccountId || undefined) : undefined,
      cashBookId: settleForm.paymentMethod === 'CashBook' ? (settleForm.cashBookId || undefined) : undefined,
      workingDays: settleWorkingDaysNum,
      daysWorked: settleDaysWorkedNum,
      bonus: Number(settleForm.bonus) || 0,
      advanceDeduction: Number(settleForm.advanceDeduction) || 0,
      otherDeduction: Number(settleForm.otherDeduction) || 0,
      paymentDate: settleForm.paymentDate ? new Date(settleForm.paymentDate).toISOString() : undefined,
      confirmFinalSettlement: isFinalizing,
      forceFinalizeWithUnpaid: forceWithUnpaid,
      remarks: settleForm.remarks.trim() || undefined
    })
  }

  const getStatusBadge = (status: string, isFinalized?: boolean) => {
    if (isFinalized || status === 'Fully Paid') {
      return <EnterpriseBadge variant="success">Fully Paid</EnterpriseBadge>
    }
    switch (status) {
      case 'Paid':
        return <EnterpriseBadge variant="success">Paid</EnterpriseBadge>
      case 'Overpaid':
        return <EnterpriseBadge variant="danger">Overpaid</EnterpriseBadge>
      case 'Partially Paid':
        return <EnterpriseBadge variant="warning">Partially Paid</EnterpriseBadge>
      default:
        return <EnterpriseBadge variant="gray">Unpaid</EnterpriseBadge>
    }
  }

  const formatMonthLabel = (monthStr: string) => {
    if (!monthStr) return ''
    const parts = monthStr.split('-')
    if (parts.length !== 2) return monthStr
    const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, 1)
    return dateObj.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  }

  return (
    <div className="flex flex-col gap-6">
      <EnterpriseHeader
        title="Payroll Directory & Settlement System"
        description="Disburse mid-month salary advances and calculate attendance-based month-end final salary settlements."
        actions={
          <div className="flex gap-3">
            <EnterpriseButton
              onClick={() => openGlobalAdvanceModal()}
              variant="secondary"
              disabled={actionLoadingKey !== null}
            >
              {actionLoadingKey === 'header-advance' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin text-amber-500" />
                  Loading...
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-4 h-4 mr-1 text-amber-500" />
                  Salary Advance
                </>
              )}
            </EnterpriseButton>
            <EnterpriseButton
              onClick={() => openFreshSettlementModal()}
              variant="primary"
              disabled={actionLoadingKey !== null}
            >
              {actionLoadingKey === 'header-settlement' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4 mr-1" />
                  Salary Settlement
                </>
              )}
            </EnterpriseButton>
          </div>
        }
      />

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <EnterpriseCard className="border-l-4 border-l-blue-500">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-500 rounded-lg">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Disbursed This Month</span>
              <span className="text-2xl font-bold text-slate-800">
                ₹{(payrollMetrics?.disbursedThisMonth ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="border-l-4 border-l-green-500">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 text-green-500 rounded-lg">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Paid Via Bank</span>
              <span className="text-2xl font-bold text-slate-800">
                ₹{(payrollMetrics?.paidViaBankThisMonth ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="border-l-4 border-l-amber-500">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-500 rounded-lg">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Paid Via Cash</span>
              <span className="text-2xl font-bold text-slate-800">
                ₹{(payrollMetrics?.paidViaCashThisMonth ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="border-l-4 border-l-rose-500">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-50 text-rose-500 rounded-lg">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Pending Salary Balance</span>
              <span className="text-2xl font-bold text-rose-700">
                ₹{(payrollMetrics?.totalPendingBalanceThisMonth ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </EnterpriseCard>
      </div>

      {/* Filter and Table Card */}
      <EnterpriseCard className="p-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
          <div className="flex-1 relative w-full">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Salary No or Employee Name..."
              className="pl-9 w-full h-[40px] border border-slate-200 rounded-[10px] text-sm focus:border-blue-500 focus:outline-none transition-all placeholder:text-slate-400"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPageNumber(1)
              }}
            />
          </div>

          <div className="flex flex-wrap gap-4 w-full md:w-auto">
            {/* Month Filter */}
            <input
              type="month"
              className="h-[40px] px-3 border border-slate-200 rounded-[10px] text-sm focus:border-blue-500 focus:outline-none"
              value={monthFilter}
              onChange={(e) => {
                setMonthFilter(e.target.value)
                setPageNumber(1)
              }}
            />

            {/* Employee Filter */}
            <select
              className="h-[40px] px-3 border border-slate-200 rounded-[10px] text-sm focus:border-blue-500 focus:outline-none"
              value={employeeFilter}
              onChange={(e) => {
                setEmployeeFilter(e.target.value)
                setPageNumber(1)
              }}
            >
              <option value="">All Employees</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.fullName}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Listing */}
        {isLoading ? (
          <EnterpriseLoading />
        ) : isError ? (
          <div className="p-6 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center justify-between my-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-sm">Unable to load monthly payroll records</h4>
                <p className="text-xs text-rose-600">{(error as any)?.response?.data?.message || (error as any)?.message || 'A database or network error occurred.'}</p>
              </div>
            </div>
            <EnterpriseButton size="sm" variant="secondary" onClick={() => refetch()}>
              Retry
            </EnterpriseButton>
          </div>
        ) : !payrollData?.items || payrollData.items.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">No monthly payroll records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase select-none">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Month</th>
                  <th className="py-3 px-4 text-right">Monthly Salary</th>
                  <th className="py-3 px-4 text-right">Earned Salary</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Balance</th>
                  <th className="py-3 px-4 text-center">Days Worked</th>
                  <th className="py-3 px-4">Last Payment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {payrollData.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800">{item.employeeName}</span>
                        <span className="text-[11px] text-slate-400">{item.department} • {item.designation || 'Staff'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">{item.salaryMonth}</td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-800">
                      ₹{(item.baseSalary ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-700">
                      ₹{(item.earnedSalary ?? item.calculatedEntitlement ?? item.baseSalary ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-green-600">
                      ₹{(item.totalPaid ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex flex-col items-end">
                        {(item.excessAdvance ?? 0) > 0 ? (
                          <>
                            <span className="font-bold text-amber-600">₹0.00</span>
                            <span className="text-[10px] text-amber-600 font-semibold">Excess: ₹{(item.excessAdvance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </>
                        ) : (
                          <>
                            <span className={`font-bold ${(item.remainingBalance ?? 0) > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                              ₹{(item.remainingBalance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {(item.remainingBalance ?? 0) > 0 ? 'Remaining' : 'Paid in Full'}
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-700">{item.daysWorked} / {item.workingDays}</td>
                    <td className="py-3.5 px-4 text-slate-500 text-xs">
                      {item.lastPaymentDate ? new Date(item.lastPaymentDate).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(item.status, item.isFinalized)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex gap-1.5 justify-end items-center">
                        {/* 1. VIEW ACTION */}
                        <button
                          type="button"
                          disabled={actionLoadingKey !== null}
                          onClick={() => openViewModal(item.id)}
                          className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-800 hover:bg-slate-100 hover:border-slate-300 transition-colors cursor-pointer disabled:opacity-50"
                          title="View Details"
                          aria-label={`View details for ${item.employeeName}`}
                        >
                          {actionLoadingKey === `view-${item.id}` ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>

                        {/* 2. ADVANCE ACTION (Only when NOT finalized AND remaining balance > 0) */}
                        {!item.isFinalized && item.status !== 'Fully Paid' && item.remainingBalance > 0.005 && (
                          <button
                            type="button"
                            disabled={actionLoadingKey !== null}
                            onClick={() => openRowAdvanceModal(item)}
                            className="p-1.5 border border-amber-200 bg-amber-50/50 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-100 hover:border-amber-300 transition-colors cursor-pointer disabled:opacity-50"
                            title="Salary Advance"
                            aria-label={`Grant salary advance for ${item.employeeName}`}
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </button>
                        )}

                        {/* 3. SETTLEMENT ACTION (Available whenever NOT finalized) */}
                        {!item.isFinalized && (
                          <button
                            type="button"
                            disabled={actionLoadingKey !== null}
                            onClick={() => openRowSettlementModal(item)}
                            className="p-1.5 border border-blue-200 bg-blue-50/50 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors cursor-pointer disabled:opacity-50"
                            title={item.status === 'Fully Paid' ? "Finalize Salary Settlement" : "Salary Settlement"}
                            aria-label={`Process salary settlement for ${item.employeeName}`}
                          >
                            {actionLoadingKey === `settle-${item.id}` ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Calculator className="w-4 h-4" />
                            )}
                          </button>
                        )}

                        {/* 4. HISTORY ACTION */}
                        <button
                          type="button"
                          disabled={actionLoadingKey !== null}
                          onClick={() => openHistoryModal(item)}
                          className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-800 hover:bg-slate-100 hover:border-slate-300 transition-colors cursor-pointer disabled:opacity-50"
                          title="Payment History"
                          aria-label={`View payment history for ${item.employeeName}`}
                        >
                          {actionLoadingKey === `history-${item.id}` ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Clock className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {payrollData && payrollData.totalCount > pageSize && (
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100 select-none">
            <span className="text-xs text-slate-500">Showing page {pageNumber} of {Math.ceil(payrollData.totalCount / pageSize)}</span>
            <div className="flex gap-2">
              <EnterpriseButton
                variant="secondary"
                disabled={pageNumber === 1}
                onClick={() => setPageNumber(p => p - 1)}
              >
                Previous
              </EnterpriseButton>
              <EnterpriseButton
                variant="secondary"
                disabled={pageNumber * pageSize >= payrollData.totalCount}
                onClick={() => setPageNumber(p => p + 1)}
              >
                Next
              </EnterpriseButton>
            </div>
          </div>
        )}
      </EnterpriseCard>

      {/* ==========================================
          1. REDESIGNED SALARY ADVANCE MODAL
          ========================================== */}
      <EnterpriseModal
        isOpen={isAdvanceModalOpen}
        onClose={() => {
          if (processPaymentMutation.isPending) return
          setIsAdvanceModalOpen(false)
        }}
        title="Salary Advance"
        subtitle="Give money to the employee before final month-end salary settlement."
        maxWidth="lg"
      >
        <form onSubmit={handleAdvanceSubmit} className="flex flex-col gap-5">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* TOP ROW: EMPLOYEE & PAYROLL MONTH SELECTION / CONTEXT */}
          {advanceMode === 'create' ? (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-[12px] grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Employee *</label>
                <select
                  required
                  disabled={isAdvanceLoading || processPaymentMutation.isPending}
                  className="w-full h-[38px] px-3 border border-slate-300 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                  value={advanceForm.employeeId}
                  onChange={(e) => handleAdvanceEmployeeChange(e.target.value)}
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.fullName} ({e.department || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payroll Month *</label>
                <input
                  type="month"
                  required
                  disabled={isAdvanceLoading || processPaymentMutation.isPending}
                  className="w-full h-[38px] px-3 border border-slate-300 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                  value={advanceForm.salaryMonth}
                  onChange={(e) => handleAdvanceMonthChange(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-[12px] grid grid-cols-2 gap-4 text-left">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">EMPLOYEE</span>
                <span className="text-sm font-bold text-slate-800 block mt-0.5">{advanceForm.employeeName}</span>
                <span className="text-xs text-slate-500">{advanceForm.department} {advanceForm.designation ? `• ${advanceForm.designation}` : ''}</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">PAYROLL MONTH</span>
                <span className="text-sm font-bold text-slate-800 block mt-0.5">{formatMonthLabel(advanceForm.salaryMonth)}</span>
                <span className="text-xs text-slate-500 font-medium text-amber-600">Contextual Advance</span>
              </div>
            </div>
          )}

          {/* EMPTY STATE FOR CREATION MODE BEFORE EMPLOYEE SELECTION */}
          {advanceMode === 'create' && !advanceForm.employeeId ? (
            <div className="p-8 text-center bg-slate-50/60 border-2 border-dashed border-slate-200 rounded-[12px] my-2">
              <Users className="w-9 h-9 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-700">Select an Employee & Payroll Month</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Choose an employee from the dropdown above to load their monthly base salary and previous advance history.
              </p>
            </div>
          ) : isAdvanceLoading ? (
            <div className="p-10 text-center bg-slate-50 border border-slate-200 rounded-[12px] my-2">
              <Loader2 className="w-8 h-8 text-amber-600 animate-spin mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-800">Loading Advance Data...</h4>
              <p className="text-xs text-slate-500 mt-1">Fetching monthly base salary and existing advance history...</p>
            </div>
          ) : (
            <>
              {/* 2-COLUMN HORIZONTAL GRID FOR ADVANCE AMOUNT & PAYMENT DETAILS */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* LEFT: ADVANCE AMOUNT & BASE SALARY (5 Cols) */}
                <div className="lg:col-span-5 flex flex-col justify-between gap-4 p-4 bg-amber-50/50 border border-amber-200 rounded-[12px]">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 block uppercase">Monthly Base</span>
                      <span className="text-sm font-bold text-slate-800">₹{advanceForm.monthlySalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-amber-700 block uppercase">Already Advanced</span>
                      <span className="text-sm font-bold text-amber-900">₹{advanceForm.alreadyAdvanced.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                      Advance Amount to Give (₹) *
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      max={Math.max(0, advanceForm.monthlySalary - advanceForm.alreadyAdvanced)}
                      step="0.01"
                      required
                      disabled={processPaymentMutation.isPending}
                      placeholder="Enter advance amount..."
                      className="w-full h-[40px] px-3 border border-amber-300 rounded-[8px] text-base font-bold text-amber-800 bg-white focus:border-amber-500 focus:outline-none disabled:bg-slate-50"
                      value={advanceForm.amount}
                      onChange={(e) => setAdvanceForm(prev => ({ ...prev, amount: e.target.value }))}
                    />
                    <span className="text-[10px] text-amber-700 mt-1 block font-medium">
                      Max allowed: ₹{Math.max(0, advanceForm.monthlySalary - advanceForm.alreadyAdvanced).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* RIGHT: PAYMENT DETAILS (7 Cols) */}
                <div className="lg:col-span-7 p-4 bg-slate-50 border border-slate-200 rounded-[12px] flex flex-col justify-between gap-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1.5">
                    Payment Details
                  </h4>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Payment Method *</label>
                      <select
                        required
                        disabled={processPaymentMutation.isPending}
                        className="w-full h-[36px] px-2.5 border border-slate-200 rounded-[8px] text-xs bg-white focus:border-blue-500 focus:outline-none"
                        value={advanceForm.paymentMethod}
                        onChange={(e) => setAdvanceForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                      >
                        <option value="BankAccount">Bank Account</option>
                        <option value="CashBook">Cash</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Pay From Account *</label>
                      {advanceForm.paymentMethod === 'BankAccount' ? (
                        <select
                          required
                          disabled={processPaymentMutation.isPending}
                          className="w-full h-[36px] px-2.5 border border-slate-200 rounded-[8px] text-xs bg-white focus:border-blue-500 focus:outline-none"
                          value={advanceForm.bankAccountId}
                          onChange={(e) => setAdvanceForm(prev => ({ ...prev, bankAccountId: e.target.value }))}
                        >
                          <option value="">Select Bank Account</option>
                          {bankAccounts.map(b => (
                            <option key={b.id} value={b.id}>
                              {b.bankName} - {b.accountName} (Bal: ₹{b.currentBalance.toLocaleString('en-IN')})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          required
                          disabled={processPaymentMutation.isPending}
                          className="w-full h-[36px] px-2.5 border border-slate-200 rounded-[8px] text-xs bg-white focus:border-blue-500 focus:outline-none"
                          value={advanceForm.cashBookId}
                          onChange={(e) => setAdvanceForm(prev => ({ ...prev, cashBookId: e.target.value }))}
                        >
                          <option value="">Select Cash Book</option>
                          {cashBooks.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name} (Bal: ₹{c.currentBalance.toLocaleString('en-IN')})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Payment Date *</label>
                      <input
                        type="date"
                        required
                        disabled={processPaymentMutation.isPending}
                        className="w-full h-[36px] px-2.5 border border-slate-200 rounded-[8px] text-xs bg-white focus:border-blue-500 focus:outline-none"
                        value={advanceForm.paymentDate}
                        onChange={(e) => setAdvanceForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Reference</label>
                      <input
                        type="text"
                        disabled={processPaymentMutation.isPending}
                        placeholder="Optional reference..."
                        className="w-full h-[36px] px-2.5 border border-slate-200 rounded-[8px] text-xs bg-white focus:border-blue-500 focus:outline-none"
                        value={advanceForm.remarks}
                        onChange={(e) => setAdvanceForm(prev => ({ ...prev, remarks: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <EnterpriseButton
              variant="secondary"
              type="button"
              disabled={processPaymentMutation.isPending}
              onClick={() => setIsAdvanceModalOpen(false)}
            >
              Cancel
            </EnterpriseButton>
            <EnterpriseButton
              variant="primary"
              type="submit"
              disabled={processPaymentMutation.isPending || isAdvanceLoading || !advanceForm.employeeId || Number(advanceForm.amount) <= 0}
            >
              {processPaymentMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin inline-block" />
                  Processing...
                </>
              ) : (
                `Give ₹${(Number(advanceForm.amount) || 0).toLocaleString('en-IN')} Advance`
              )}
            </EnterpriseButton>
          </div>
        </form>
      </EnterpriseModal>

      {/* ==========================================
          2. REDESIGNED SALARY SETTLEMENT MODAL (WIDE LAYOUT)
          ========================================== */}
      <EnterpriseModal
        isOpen={isSettlementModalOpen}
        onClose={() => {
          if (processPaymentMutation.isPending) return
          setIsSettlementModalOpen(false)
        }}
        title="Salary Settlement"
        subtitle="Calculate the employee's final salary for this month and pay the remaining amount."
        maxWidth="xl"
      >
        <form onSubmit={handleSettlementSubmit} className="flex flex-col gap-5">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* TOP ROW: EMPLOYEE & PAYROLL MONTH SELECTION / CONTEXT */}
          {settlementMode === 'create' ? (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-[12px] grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Employee *</label>
                <select
                  required
                  disabled={isSettlementLoading || processPaymentMutation.isPending}
                  className="w-full h-[38px] px-3 border border-slate-300 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                  value={settleForm.employeeId}
                  onChange={(e) => handleSettlementEmployeeChange(e.target.value)}
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.fullName} ({e.department || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payroll Month *</label>
                <input
                  type="month"
                  required
                  disabled={isSettlementLoading || processPaymentMutation.isPending}
                  className="w-full h-[38px] px-3 border border-slate-300 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                  value={settleForm.salaryMonth}
                  onChange={(e) => handleSettlementMonthChange(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-[12px] grid grid-cols-2 gap-4 text-left">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">EMPLOYEE</span>
                <span className="text-sm font-bold text-slate-800 block mt-0.5">{settleForm.employeeName}</span>
                <span className="text-xs text-slate-500">{settleForm.department} {settleForm.designation ? `• ${settleForm.designation}` : ''}</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">PAYROLL MONTH</span>
                <span className="text-sm font-bold text-slate-800 block mt-0.5">{formatMonthLabel(settleForm.salaryMonth)}</span>
                <span className="text-xs text-slate-500 font-medium text-blue-600">Contextual Settlement</span>
              </div>
            </div>
          )}

          {/* EMPTY STATE FOR CREATION MODE BEFORE EMPLOYEE SELECTION */}
          {settlementMode === 'create' && !settleForm.employeeId ? (
            <div className="p-8 text-center bg-slate-50/60 border-2 border-dashed border-slate-200 rounded-[12px] my-2">
              <Users className="w-9 h-9 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-700">Select an Employee & Payroll Month</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Choose an employee from the dropdown above to load their attendance, monthly base salary, and previous payment history for calculation.
              </p>
            </div>
          ) : isSettlementLoading ? (
            <div className="p-10 text-center bg-slate-50 border border-slate-200 rounded-[12px] my-2">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-800">Loading Payroll Data...</h4>
              <p className="text-xs text-slate-500 mt-1">Fetching salary entitlement, attendance records, and payment history...</p>
            </div>
          ) : (
            <>

              {/* MAIN 2-COLUMN GRID FOR CALCULATION & MONEY ALREADY PAID */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* LEFT COLUMN: HOW THIS MONTH'S SALARY IS CALCULATED */}
                <div className="p-4 bg-white border border-slate-200 rounded-[12px] flex flex-col justify-between gap-3">
                  <div className="border-b border-slate-100 pb-2">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Salary Calculation
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Based on actual days worked.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block font-semibold text-[11px]">Monthly Base</span>
                      <span className="text-sm font-bold text-slate-800 block py-1">
                        ₹{settleForm.monthlySalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <label className="text-slate-500 block font-semibold text-[11px]">Working Days *</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        required
                        disabled={processPaymentMutation.isPending}
                        className="w-full h-[32px] px-2 border border-slate-200 rounded text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none"
                        value={settleForm.workingDays}
                        onChange={(e) => setSettleForm(prev => ({ ...prev, workingDays: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block font-semibold text-[11px]">Days Worked *</label>
                      <input
                        type="number"
                        min="0"
                        max={settleWorkingDaysNum}
                        required
                        disabled={processPaymentMutation.isPending}
                        className={`w-full h-[32px] px-2 border rounded text-xs font-bold focus:outline-none ${isAttendanceInvalid ? 'border-rose-500 text-rose-600 bg-rose-50' : 'border-slate-200 text-blue-700 focus:border-blue-500'
                          }`}
                        value={settleForm.daysWorked}
                        onChange={(e) => setSettleForm(prev => ({ ...prev, daysWorked: e.target.value }))}
                      />
                    </div>
                  </div>

                  {isAttendanceInvalid ? (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold rounded-lg flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <span>Days worked cannot be greater than working days.</span>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-[10px] flex justify-between items-center">
                      <div>
                        <span className="text-[11px] font-bold text-slate-600 uppercase block">Salary Earned</span>
                        <span className="text-[10px] text-slate-400">
                          ₹{settleForm.monthlySalary.toLocaleString('en-IN')} ÷ {settleWorkingDaysNum}d = ₹{settleDailyRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}/d
                        </span>
                      </div>
                      <span className="text-lg font-bold text-slate-800">
                        ₹{settleEarnedSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                    <div>
                      <label className="text-slate-500 block font-semibold text-[11px]">Bonus / Allowances (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={processPaymentMutation.isPending}
                        className="w-full h-[32px] px-2 border border-slate-200 rounded text-xs text-green-700 font-bold focus:outline-none"
                        value={settleForm.bonus}
                        onChange={(e) => setSettleForm(prev => ({ ...prev, bonus: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block font-semibold text-[11px]">Other Deductions / LOP (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={processPaymentMutation.isPending}
                        className="w-full h-[32px] px-2 border border-slate-200 rounded text-xs text-rose-700 font-bold focus:outline-none"
                        value={settleForm.otherDeduction}
                        onChange={(e) => setSettleForm(prev => ({ ...prev, otherDeduction: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: MONEY ALREADY PAID & REMAINING SUMMARY */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-[12px] flex flex-col justify-between gap-3">
                  <div className="border-b border-slate-200 pb-2">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Money Already Paid & Balance
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Deductions from this month's earned salary.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-[8px]">
                      <span className="text-amber-800 block font-bold text-[11px]">Already Paid Advance</span>
                      <span className="text-base font-bold text-amber-900 mt-0.5 block">
                        ₹{settleForm.totalAdvancesPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="p-2.5 bg-blue-50/80 border border-blue-200 rounded-[8px]">
                      <span className="text-blue-800 block font-bold text-[11px]">Previous Settlements</span>
                      <span className="text-base font-bold text-blue-900 mt-0.5 block">
                        ₹{settleForm.previousSettlementsPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Ledger Balance Summary Box */}
                  <div className="p-3 bg-white border border-slate-200 rounded-[10px] text-xs font-mono">
                    <div className="flex justify-between py-0.5 text-slate-600">
                      <span>Salary Earned</span>
                      <span className="font-bold text-slate-800">₹{settleEarnedSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between py-0.5 text-amber-700">
                      <span>Already Paid</span>
                      <span className="font-bold">- ₹{settleForm.totalAdvancesPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between py-0.5 text-blue-700">
                      <span>Previous Settlements</span>
                      <span className="font-bold">- ₹{settleForm.previousSettlementsPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="border-t border-slate-200 my-1 pt-1 flex justify-between text-xs font-bold text-slate-800 font-sans">
                      <span>Remaining Salary</span>
                      <span className={excessAdvance > 0 ? 'text-amber-600' : settleDue > 0 ? 'text-rose-700' : 'text-slate-500'}>
                        {excessAdvance > 0 ? `Excess: ₹${excessAdvance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : `₹${settleDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ATTENDANCE & UNWORKED DAYS NOTICE */}
              {settleUnworkedDays > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-[10px] text-xs flex items-center justify-between text-slate-600">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <span>
                      <strong>{settleUnworkedDays} unworked days</strong> ({settleWorkingDaysNum} working - {settleDaysWorkedNum} worked). Unworked days reduce earned salary and are not an unpaid balance liability.
                    </span>
                  </div>
                </div>
              )}

              {/* FINAL SETTLEMENT CONFIRMATION BOX (SECTION 10) */}
              <div className={`p-4 rounded-[12px] border transition-all ${confirmFinalSettlement
                ? 'bg-emerald-50/90 border-emerald-300 ring-2 ring-emerald-400/20'
                : 'bg-slate-50 border-slate-200'
                }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg mt-0.5 ${confirmFinalSettlement ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className={`text-xs font-bold uppercase tracking-wider ${confirmFinalSettlement ? 'text-emerald-900' : 'text-slate-800'}`}>
                        Final Settlement Confirmation
                      </h4>
                      {confirmFinalSettlement && (
                        <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-md">
                          ✓ Final Settlement Selected
                        </span>
                      )}
                    </div>

                    <label className="flex items-start gap-2.5 mt-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="w-4 h-4 mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        checked={confirmFinalSettlement}
                        onChange={(e) => setConfirmFinalSettlement(e.target.checked)}
                      />
                      <div className="text-xs">
                        <span className="font-bold text-slate-800 block">
                          Confirm final settlement for {formatMonthLabel(settleForm.salaryMonth)}
                        </span>
                        <span className="text-[11px] text-slate-500 block mt-0.5 leading-normal">
                          Confirm this when the employee's salary for this payroll month is fully settled.
                          {settleUnworkedDays > 0 && (
                            <span className="font-semibold text-amber-700">
                              {' '}Any {settleUnworkedDays} unworked days will be treated as attendance-based non-payable days.
                            </span>
                          )}
                        </span>
                      </div>
                    </label>

                    {confirmFinalSettlement && (
                      <div className="mt-2.5 pt-2 border-t border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>This payroll month will be closed and locked after saving.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* UNPAID SALARY WARNING ALERT */}
              {confirmFinalSettlement && remainingAfterPayment > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-[10px] text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-amber-900">
                      ⚠️ ₹{remainingAfterPayment.toLocaleString('en-IN', { minimumFractionDigits: 2 })} is still unpaid.
                    </span>
                    <span className="text-[11px] text-amber-800 block mt-0.5">
                      Confirming final settlement will close this payroll month without paying the remaining amount. A confirmation popup will be required before closing.
                    </span>
                  </div>
                </div>
              )}

              {/* BOTTOM ROW: AMOUNT TO PAY NOW & PAYMENT DETAILS */}
              {settleDue <= 0.005 ? (
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-[12px] flex items-start gap-3 text-emerald-900 shadow-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-xs uppercase tracking-wider text-emerald-900">✓ Salary Fully Paid</h4>
                      <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded">No Payment Pending</span>
                    </div>
                    <p className="text-xs text-emerald-800 mt-1 font-semibold">
                      Earned Salary: ₹{settleEarnedSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })} •
                      Already Paid: ₹{settleTotalPreviousPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })} •
                      Remaining: ₹0.00
                    </p>
                    <p className="text-[11px] text-emerald-700 mt-1 leading-normal">
                      All earned salary for this employee/month has already been paid. Check <strong>"Confirm final settlement"</strong> above to finalize and close this payroll month. No additional payment will be processed.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* AMOUNT TO PAY NOW (5 Columns) */}
                  <div className="lg:col-span-5 p-4 bg-gradient-to-br from-blue-50 via-indigo-50/40 to-blue-50/90 border-2 border-blue-300 rounded-[12px] flex flex-col justify-between gap-2 shadow-sm">
                    <div>
                      <span className="text-[11px] font-extrabold text-blue-800 uppercase tracking-wider block">
                        AMOUNT TO PAY NOW
                      </span>
                      <span className="text-2xl font-extrabold text-blue-900 block mt-0.5">
                        ₹{payNowAmountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Amount to Pay (₹) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={settleDue}
                        step="0.01"
                        required={!confirmFinalSettlement}
                        disabled={processPaymentMutation.isPending}
                        className={`w-full h-[38px] px-3 border rounded-[8px] text-base font-bold bg-white focus:outline-none ${isPayNowExceeding ? 'border-rose-500 text-rose-600' : 'border-blue-300 text-blue-800 focus:border-blue-600'
                          }`}
                        value={settleForm.amount}
                        onChange={(e) => {
                          setIsAmountCustomized(true)
                          setSettleForm(prev => ({ ...prev, amount: e.target.value }))
                        }}
                      />
                      <div className="flex justify-between items-center mt-1 text-[10px]">
                        <span className="text-slate-500">Max: ₹{settleDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        {payNowAmountNum > 0 && !isPayNowExceeding && (
                          <span className="text-blue-700 font-bold">
                            After: ₹{remainingAfterPayment.toLocaleString('en-IN', { minimumFractionDigits: 2 })} left
                          </span>
                        )}
                      </div>
                    </div>

                    {isPayNowExceeding && (
                      <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold rounded-md">
                        Amount cannot exceed remaining salary of ₹{settleDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.
                      </div>
                    )}
                  </div>

                  {/* PAYMENT DETAILS (7 Columns) */}
                  <div className="lg:col-span-7 p-4 bg-slate-50 border border-slate-200 rounded-[12px] flex flex-col justify-between gap-3">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1.5">
                      Payment Details
                    </h4>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">Payment Method *</label>
                        <select
                          required={payNowAmountNum > 0}
                          disabled={processPaymentMutation.isPending}
                          className="w-full h-[36px] px-2.5 border border-slate-200 rounded-[8px] text-xs bg-white focus:border-blue-500 focus:outline-none"
                          value={settleForm.paymentMethod}
                          onChange={(e) => setSettleForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                        >
                          <option value="BankAccount">Bank Account</option>
                          <option value="CashBook">Cash</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">Pay From Account *</label>
                        {settleForm.paymentMethod === 'BankAccount' ? (
                          <select
                            required={payNowAmountNum > 0}
                            disabled={processPaymentMutation.isPending}
                            className="w-full h-[36px] px-2.5 border border-slate-200 rounded-[8px] text-xs bg-white focus:border-blue-500 focus:outline-none"
                            value={settleForm.bankAccountId}
                            onChange={(e) => setSettleForm(prev => ({ ...prev, bankAccountId: e.target.value }))}
                          >
                            <option value="">Select Bank Account</option>
                            {bankAccounts.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.bankName} - {b.accountName} (Bal: ₹{b.currentBalance.toLocaleString('en-IN')})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            required={payNowAmountNum > 0}
                            disabled={processPaymentMutation.isPending}
                            className="w-full h-[36px] px-2.5 border border-slate-200 rounded-[8px] text-xs bg-white focus:border-blue-500 focus:outline-none"
                            value={settleForm.cashBookId}
                            onChange={(e) => setSettleForm(prev => ({ ...prev, cashBookId: e.target.value }))}
                          >
                            <option value="">Select Cash Book</option>
                            {cashBooks.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.name} (Bal: ₹{c.currentBalance.toLocaleString('en-IN')})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">Payment Date *</label>
                        <input
                          type="date"
                          required
                          disabled={processPaymentMutation.isPending}
                          className="w-full h-[36px] px-2.5 border border-slate-200 rounded-[8px] text-xs bg-white focus:border-blue-500 focus:outline-none"
                          value={settleForm.paymentDate}
                          onChange={(e) => setSettleForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">Reference</label>
                        <input
                          type="text"
                          disabled={processPaymentMutation.isPending}
                          placeholder="Optional reference..."
                          className="w-full h-[36px] px-2.5 border border-slate-200 rounded-[8px] text-xs bg-white focus:border-blue-500 focus:outline-none"
                          value={settleForm.remarks}
                          onChange={(e) => setSettleForm(prev => ({ ...prev, remarks: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <EnterpriseButton
              variant="secondary"
              type="button"
              disabled={processPaymentMutation.isPending}
              onClick={() => setIsSettlementModalOpen(false)}
            >
              Cancel
            </EnterpriseButton>
            <EnterpriseButton
              variant={confirmFinalSettlement ? 'success' : 'primary'}
              type="submit"
              disabled={
                processPaymentMutation.isPending ||
                isSettlementLoading ||
                !settleForm.employeeId ||
                settleEntitlement?.isFinalized ||
                isAttendanceInvalid ||
                isPayNowExceeding ||
                (payNowAmountNum <= 0 && !confirmFinalSettlement)
              }
            >
              {processPaymentMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin inline-block" />
                  Processing...
                </>
              ) : confirmFinalSettlement ? (
                payNowAmountNum > 0
                  ? `Pay ₹${payNowAmountNum.toLocaleString('en-IN')} & Finalize`
                  : 'Confirm & Close Payroll'
              ) : (
                `Pay ₹${payNowAmountNum.toLocaleString('en-IN')}`
              )}
            </EnterpriseButton>
          </div>
        </form>
      </EnterpriseModal>

      {/* UNPAID SETTLEMENT WARNING CONFIRMATION MODAL */}
      <EnterpriseModal
        isOpen={isUnpaidWarningModalOpen}
        onClose={() => setIsUnpaidWarningModalOpen(false)}
        title="Confirm Final Settlement with Unpaid Balance"
        maxWidth="md"
      >
        <div className="p-4 space-y-4">
          <div className="p-3.5 bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-amber-900">Closing Payroll Month with Unpaid Salary</h4>
              <p className="mt-1 text-amber-800">
                ₹{remainingAfterPayment.toLocaleString('en-IN', { minimumFractionDigits: 2 })} is still unpaid for {settleForm.employeeName} ({formatMonthLabel(settleForm.salaryMonth)}).
              </p>
              <p className="mt-2 font-semibold text-amber-900">
                Are you sure you want to close this payroll month with ₹{remainingAfterPayment.toLocaleString('en-IN', { minimumFractionDigits: 2 })} unpaid?
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <EnterpriseButton variant="secondary" onClick={() => setIsUnpaidWarningModalOpen(false)}>
              Cancel
            </EnterpriseButton>
            <EnterpriseButton
              variant="danger"
              disabled={processPaymentMutation.isPending}
              onClick={() => {
                setIsUnpaidWarningModalOpen(false)
                executeSettlePayment(true, true)
              }}
            >
              {processPaymentMutation.isPending ? 'Closing Payroll...' : 'Close Payroll Anyway'}
            </EnterpriseButton>
          </div>
        </div>
      </EnterpriseModal>

      {/* 3. VIEW SALARY STATEMENT MODAL */}
      <EnterpriseModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Salary Statement — ${selectedEntitlement?.employeeName}`}
        maxWidth="xl"
      >
        {selectedEntitlement && (
          <div className="flex flex-col gap-5">
            {selectedEntitlement.isFinalized && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-lg flex items-center justify-between font-semibold">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>
                    Payroll Month Finalized on {selectedEntitlement.finalizedAt ? new Date(selectedEntitlement.finalizedAt).toLocaleDateString('en-IN') : 'Record Date'} by {selectedEntitlement.finalizedBy || 'Company Admin'}
                  </span>
                </div>
                <span className="px-2.5 py-0.5 bg-emerald-200/60 text-emerald-900 rounded font-bold text-[10px] uppercase tracking-wider">
                  Locked
                </span>
              </div>
            )}

            {/* Header Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-[10px] text-center">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block uppercase">Monthly Salary</span>
                <span className="text-lg font-bold text-slate-800">₹{(selectedEntitlement.baseSalary ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block uppercase">Earned Salary</span>
                <span className="text-lg font-bold text-slate-800">₹{(selectedEntitlement.earnedSalary ?? selectedEntitlement.grossSalary ?? selectedEntitlement.calculatedEntitlement ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block uppercase">Total Paid</span>
                <span className="text-lg font-bold text-green-600">₹{(selectedEntitlement.totalPaid ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block uppercase">Remaining</span>
                <span className="text-lg font-bold text-rose-600">₹{(selectedEntitlement.remainingBalance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-white border border-slate-100 rounded-lg">
                <span className="text-slate-400 block font-semibold">Days Worked</span>
                <span className="text-sm font-bold text-slate-700">{selectedEntitlement.daysWorked} / {selectedEntitlement.workingDays}</span>
              </div>
              <div className="p-3 bg-white border border-slate-100 rounded-lg">
                <span className="text-slate-400 block font-semibold">Already Paid as Advance</span>
                <span className="text-sm font-bold text-amber-600">₹{(selectedEntitlement.totalAdvances ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="p-3 bg-white border border-slate-100 rounded-lg">
                <span className="text-slate-400 block font-semibold">Total Settlements Paid</span>
                <span className="text-sm font-bold text-blue-600">₹{(selectedEntitlement.totalSettlements ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="p-3 bg-white border border-slate-100 rounded-lg">
                <span className="text-slate-400 block font-semibold">Bonus</span>
                <span className="text-sm font-bold text-green-600">+₹{(selectedEntitlement.bonus ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="p-3 bg-white border border-slate-100 rounded-lg">
                <span className="text-slate-400 block font-semibold">Advance Deductions</span>
                <span className="text-sm font-bold text-amber-600">-₹{(selectedEntitlement.advanceDeduction ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="p-3 bg-white border border-slate-100 rounded-lg">
                <span className="text-slate-400 block font-semibold">Other Deductions</span>
                <span className="text-sm font-bold text-rose-600">-₹{(selectedEntitlement.otherDeduction ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Payment Transactions List */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-bold text-slate-800">Payment Transactions</h4>
              </div>

              {!selectedEntitlement.payments || selectedEntitlement.payments.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs bg-slate-50 border border-slate-100 rounded-lg">
                  No payment transactions recorded yet for this month.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3">Disbursed From</th>
                        <th className="py-2.5 px-3">Remarks</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedEntitlement.payments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-medium text-slate-600">
                            {new Date(p.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.paymentType === 'Salary Advance' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                              {p.paymentType}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-green-700">
                            ₹{(p.amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{p.paidFrom || p.paymentMethod}</td>
                          <td className="py-2.5 px-3 text-slate-400 max-w-[150px] truncate" title={p.remarks || ''}>
                            {p.remarks || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => handlePrintPayslip(selectedEntitlement, p)}
                                className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                title="Print Payslip"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to reverse this ${p.paymentType} of ₹${p.amount}?`)) {
                                    reverseTransactionMutation.mutate(p.id)
                                  }
                                }}
                                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title="Reverse Payment Transaction"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <EnterpriseButton
                  variant="primary"
                  size="sm"
                  disabled={isExportingPdf || isPrintingDoc}
                  onClick={() => handleDownloadSalarySlip(selectedEntitlement)}
                >
                  {isExportingPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin inline-block" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-1.5 inline-block" />
                      Download Salary Slip
                    </>
                  )}
                </EnterpriseButton>
                <EnterpriseButton
                  variant="secondary"
                  size="sm"
                  disabled={isExportingPdf || isPrintingDoc}
                  onClick={() => handlePrintSalarySlip(selectedEntitlement)}
                >
                  {isPrintingDoc ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin inline-block" />
                      Preparing...
                    </>
                  ) : (
                    <>
                      <Printer className="w-4 h-4 mr-1.5 inline-block" />
                      Print
                    </>
                  )}
                </EnterpriseButton>
                <EnterpriseButton
                  variant="secondary"
                  size="sm"
                  disabled={isExportingPdf || isPrintingDoc}
                  onClick={() => handleDownloadSalaryHistory(selectedEntitlement)}
                  title="Export complete salary and payment history across all periods"
                >
                  <History className="w-3.5 h-3.5 mr-1 inline-block text-slate-500" />
                  Salary History
                </EnterpriseButton>
              </div>
              <EnterpriseButton variant="secondary" onClick={() => setIsViewModalOpen(false)}>
                Close
              </EnterpriseButton>
            </div>
          </div>
        )}
      </EnterpriseModal>

      {/* 4. PAYMENT HISTORY LEDGER MODAL */}
      <EnterpriseModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title={`Payment History — ${selectedEntitlement?.employeeName} (${selectedEntitlement?.salaryMonth})`}
        maxWidth="xl"
      >
        {selectedEntitlement && (
          <div className="flex flex-col gap-5">
            {selectedEntitlement.isFinalized && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-lg flex items-center justify-between font-semibold">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>
                    Payroll Month Finalized on {selectedEntitlement.finalizedAt ? new Date(selectedEntitlement.finalizedAt).toLocaleDateString('en-IN') : 'Record Date'} by {selectedEntitlement.finalizedBy || 'Company Admin'}
                  </span>
                </div>
                <span className="px-2.5 py-0.5 bg-emerald-200/60 text-emerald-900 rounded font-bold text-[10px] uppercase tracking-wider">
                  Closed & Locked
                </span>
              </div>
            )}

            {/* Header Ledger Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-[10px] text-center">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block uppercase">Monthly Salary</span>
                <span className="text-lg font-bold text-slate-800">₹{(selectedEntitlement.baseSalary ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block uppercase">Earned Salary</span>
                <span className="text-lg font-bold text-slate-800">₹{(selectedEntitlement.earnedSalary ?? selectedEntitlement.grossSalary ?? selectedEntitlement.calculatedEntitlement ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block uppercase">Total Paid</span>
                <span className="text-lg font-bold text-green-600">₹{(selectedEntitlement.totalPaid ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block uppercase">Remaining</span>
                <span className="text-lg font-bold text-rose-600">₹{(selectedEntitlement.remainingBalance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Payment Transactions Table */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-bold text-slate-800">Payment Transactions History</h4>
              </div>

              {!selectedEntitlement.payments || selectedEntitlement.payments.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs bg-slate-50 border border-slate-100 rounded-lg">
                  No payment transactions recorded yet for this month.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3">Disbursed From</th>
                        <th className="py-2.5 px-3">Reference / Remarks</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedEntitlement.payments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-medium text-slate-600">
                            {new Date(p.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.paymentType === 'Salary Advance' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                              {p.paymentType}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-green-700">
                            ₹{(p.amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{p.paidFrom || p.paymentMethod}</td>
                          <td className="py-2.5 px-3 text-slate-400 max-w-[150px] truncate" title={p.remarks || ''}>
                            {p.remarks || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => handlePrintPayslip(selectedEntitlement, p)}
                                className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                title="Print Transaction Slip"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to reverse this ${p.paymentType} of ₹${p.amount}?`)) {
                                    reverseTransactionMutation.mutate(p.id)
                                  }
                                }}
                                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title="Reverse Payment Transaction"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                      <tr>
                        <td colSpan={2} className="py-2.5 px-3 text-slate-600">
                          Total Advances: ₹{(selectedEntitlement.totalAdvances ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} | Total Settlements: ₹{(selectedEntitlement.totalSettlements ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right text-green-700">Total Paid: ₹{(selectedEntitlement.totalPaid ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td colSpan={3} className="py-2.5 px-3 text-right text-slate-600">Remaining Settlement: ₹{(selectedEntitlement.remainingBalance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <EnterpriseButton
                  variant="primary"
                  size="sm"
                  disabled={isExportingPdf || isPrintingDoc}
                  onClick={() => handleDownloadSalarySlip(selectedEntitlement)}
                >
                  {isExportingPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin inline-block" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-1.5 inline-block" />
                      Download Salary Slip
                    </>
                  )}
                </EnterpriseButton>
                <EnterpriseButton
                  variant="secondary"
                  size="sm"
                  disabled={isExportingPdf || isPrintingDoc}
                  onClick={() => handlePrintSalarySlip(selectedEntitlement)}
                >
                  {isPrintingDoc ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin inline-block" />
                      Preparing...
                    </>
                  ) : (
                    <>
                      <Printer className="w-4 h-4 mr-1.5 inline-block" />
                      Print
                    </>
                  )}
                </EnterpriseButton>
                <EnterpriseButton
                  variant="secondary"
                  size="sm"
                  disabled={isExportingPdf || isPrintingDoc}
                  onClick={() => handleDownloadSalaryHistory(selectedEntitlement)}
                  title="Export complete salary and payment history across all periods"
                >
                  <History className="w-3.5 h-3.5 mr-1 inline-block text-slate-500" />
                  Salary History
                </EnterpriseButton>
              </div>
              <EnterpriseButton variant="secondary" onClick={() => setIsHistoryOpen(false)}>
                Close
              </EnterpriseButton>
            </div>
          </div>
        )}
      </EnterpriseModal>

      {/* PRINT PREVIEW MODAL */}
      {printModalOpen && (
        <PrintPreviewModal
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          documentData={printDocData}
        />
      )}
    </div>
  )
}

export default PayrollPage
