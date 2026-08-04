import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { payrollService } from '../../../services/payroll'
import type { SalaryPayment, SalaryPaymentDetails, CreateSalaryPaymentRequest } from '../../../services/payroll'
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
import { Plus, Search, Eye, Edit2, Trash2, Printer, Landmark, Wallet, Receipt, FileText, History } from 'lucide-react'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

export const PayrollPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { showToast } = useNotificationStore()

  // Table Page/Filter state
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize] = useState(10)
  const [searchTerm, setSearchTerm] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isSlipOpen, setIsSlipOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [historyItems, setHistoryItems] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [selectedSalaryNo, setSelectedSalaryNo] = useState('')

  const [selectedPayment, setSelectedPayment] = useState<SalaryPaymentDetails | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // Form State
  const [formData, setFormData] = useState({
    id: '', // for edit
    employeeId: '',
    employeeName: '',
    department: '',
    designation: '',
    currentSalary: 0,
    salaryMonth: new Date().toISOString().substring(0, 7), // YYYY-MM
    workingDays: 30 as number | string,
    daysWorked: 30 as number | string,
    bonus: 0 as number | string,
    advanceDeduction: 0 as number | string,
    otherDeduction: 0 as number | string,
    paymentMethod: 'BankAccount', // BankAccount, CashBook
    bankAccountId: '',
    cashBookId: '',
    remarks: ''
  })

  // Calculated fields (UI helper)
  const workingDaysNum = Number(formData.workingDays) || 0
  const daysWorkedNum = Number(formData.daysWorked) || 0
  const dailySalary = workingDaysNum > 0 ? Math.round((formData.currentSalary / workingDaysNum) * 100) / 100 : 0
  const grossSalary = Math.round((dailySalary * daysWorkedNum) * 100) / 100
  const netSalary = Math.round((grossSalary + (Number(formData.bonus) || 0) - (Number(formData.advanceDeduction) || 0) - (Number(formData.otherDeduction) || 0)) * 100) / 100

  // Dropdown data queries
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

  // Paginated list query
  const { data: payrollData, isLoading } = useQuery({
    queryKey: ['salaryPaymentsList', pageNumber, pageSize, searchTerm, monthFilter, employeeFilter],
    queryFn: () => payrollService.getSalaryPayments({
      pageNumber,
      pageSize,
      search: searchTerm || undefined,
      month: monthFilter || undefined,
      employeeId: employeeFilter || undefined
    })
  })

  // Mutations
  const createPaymentMutation = useMutation({
    mutationFn: (payload: CreateSalaryPaymentRequest) => payrollService.createSalaryPayment(payload),
    onSuccess: () => {
      showToast('Salary Payment generated successfully.', 'success')
      queryClient.invalidateQueries({ queryKey: ['salaryPaymentsList'] })
      // Invalidate balances
      queryClient.invalidateQueries({ queryKey: ['bankAccountDropdownList'] })
      queryClient.invalidateQueries({ queryKey: ['cashBookDropdownList'] })
      setIsCreateModalOpen(false)
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error generating salary payment.'
      setFormError(msg)
      showToast(msg, 'error')
    }
  })

  const updatePaymentMutation = useMutation({
    mutationFn: (payload: { id: string; data: CreateSalaryPaymentRequest }) => 
      payrollService.updateSalaryPayment(payload.id, payload.data),
    onSuccess: () => {
      showToast('Salary Payment updated successfully.', 'success')
      queryClient.invalidateQueries({ queryKey: ['salaryPaymentsList'] })
      queryClient.invalidateQueries({ queryKey: ['bankAccountDropdownList'] })
      queryClient.invalidateQueries({ queryKey: ['cashBookDropdownList'] })
      setIsEditModalOpen(false)
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error updating salary payment.'
      setFormError(msg)
      showToast(msg, 'error')
    }
  })

  const deletePaymentMutation = useMutation({
    mutationFn: (id: string) => payrollService.deleteSalaryPayment(id),
    onSuccess: () => {
      showToast('Salary Payment reversed and deleted successfully.', 'success')
      queryClient.invalidateQueries({ queryKey: ['salaryPaymentsList'] })
      queryClient.invalidateQueries({ queryKey: ['bankAccountDropdownList'] })
      queryClient.invalidateQueries({ queryKey: ['cashBookDropdownList'] })
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error deleting salary payment.'
      showToast(msg, 'error')
    }
  })

  // Handle employee change - auto fill details
  const handleEmployeeChange = (empId: string) => {
    const selectedEmp = employees.find(e => e.id === empId)
    if (selectedEmp) {
      setFormData(prev => ({
        ...prev,
        employeeId: empId,
        employeeName: selectedEmp.fullName,
        department: selectedEmp.department,
        designation: selectedEmp.roleName,
        currentSalary: selectedEmp.currentSalary || 0
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        employeeId: '',
        employeeName: '',
        department: '',
        designation: '',
        currentSalary: 0
      }))
    }
  }

  // Handle actions
  const openCreateModal = () => {
    setFormError(null)
    setFormData({
      id: '',
      employeeId: '',
      employeeName: '',
      department: '',
      designation: '',
      currentSalary: 0,
      salaryMonth: new Date().toISOString().substring(0, 7),
      workingDays: 30,
      daysWorked: 30,
      bonus: 0,
      advanceDeduction: 0,
      otherDeduction: 0,
      paymentMethod: 'BankAccount',
      bankAccountId: bankAccounts.length > 0 ? bankAccounts[0].id : '',
      cashBookId: cashBooks.length > 0 ? cashBooks[0].id : '',
      remarks: ''
    })
    setIsCreateModalOpen(true)
  }

  const openEditModal = async (paymentId: string) => {
    setFormError(null)
    try {
      const details = await payrollService.getSalaryPaymentById(paymentId)
      if (details) {
        setFormData({
          id: details.id,
          employeeId: details.employeeId,
          employeeName: details.employeeName,
          department: details.department,
          designation: details.designation,
          currentSalary: details.monthlySalary,
          salaryMonth: details.salaryMonth,
          workingDays: details.workingDays,
          daysWorked: details.daysWorked,
          bonus: details.bonus,
          advanceDeduction: details.advanceDeduction,
          otherDeduction: details.otherDeduction,
          paymentMethod: details.paymentMethod,
          bankAccountId: details.bankAccountId || '',
          cashBookId: details.cashBookId || '',
          remarks: details.remarks || ''
        })
        setIsEditModalOpen(true)
      }
    } catch (err) {
      showToast('Failed to load payment details.', 'error')
    }
  }

  const openViewModal = async (paymentId: string) => {
    try {
      const details = await payrollService.getSalaryPaymentById(paymentId)
      if (details) {
        setSelectedPayment(details)
        setIsViewModalOpen(true)
      }
    } catch (err) {
      showToast('Failed to load details.', 'error')
    }
  }

  const openSlipModal = async (paymentId: string) => {
    try {
      const details = await payrollService.getSalaryPaymentById(paymentId)
      if (details) {
        setSelectedPayment(details)
        setIsSlipOpen(true)
      }
    } catch (err) {
      showToast('Failed to load salary slip details.', 'error')
    }
  }

  const openHistoryModal = async (paymentId: string, salaryNo: string) => {
    setSelectedSalaryNo(salaryNo)
    setIsHistoryOpen(true)
    setLoadingHistory(true)
    try {
      const items = await payrollService.getSalaryPaymentHistory(paymentId)
      setHistoryItems(items || [])
    } catch (err: any) {
      showToast(err.message || 'Failed to load audit history', 'error')
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleDelete = (id: string, salaryNo: string) => {
    if (window.confirm(`Are you sure you want to delete and reverse salary payment "${salaryNo}"? This restores the deducted funds.`)) {
      deletePaymentMutation.mutate(id)
    }
  }

  const handleSubmit = (e: React.FormEvent, isEdit: boolean) => {
    e.preventDefault()
    setFormError(null)

    const workingDaysVal = Number(formData.workingDays) || 0
    const daysWorkedVal = Number(formData.daysWorked) || 0

    if (workingDaysVal <= 0) {
      setFormError('Working Days must be greater than zero.')
      return
    }

    if (daysWorkedVal < 0 || daysWorkedVal > workingDaysVal) {
      setFormError('Days Worked must be between 0 and Working Days.')
      return
    }

    if (netSalary < 0) {
      setFormError('Net Salary cannot become negative.')
      return
    }

    const payload: CreateSalaryPaymentRequest = {
      employeeId: formData.employeeId,
      salaryMonth: formData.salaryMonth,
      workingDays: workingDaysVal,
      daysWorked: daysWorkedVal,
      bonus: Number(formData.bonus) || 0,
      advanceDeduction: Number(formData.advanceDeduction) || 0,
      otherDeduction: Number(formData.otherDeduction) || 0,
      paymentMethod: formData.paymentMethod,
      bankAccountId: formData.paymentMethod === 'BankAccount' ? formData.bankAccountId : undefined,
      cashBookId: formData.paymentMethod === 'CashBook' ? formData.cashBookId : undefined,
      remarks: formData.remarks.trim() || undefined
    }

    // Verify balance limit locally before submission
    if (formData.paymentMethod === 'BankAccount') {
      const bank = bankAccounts.find(b => b.id === formData.bankAccountId)
      if (bank && bank.accountType !== 'OD' && bank.currentBalance < netSalary) {
        setFormError(`Insufficient balance. Selected bank balance is ₹${bank.currentBalance.toLocaleString('en-IN')}`)
        return
      }
    } else {
      const cash = cashBooks.find(c => c.id === formData.cashBookId)
      if (cash && cash.currentBalance < netSalary) {
        setFormError(`Insufficient balance. Selected cash book balance is ₹${cash.currentBalance.toLocaleString('en-IN')}`)
        return
      }
    }

    if (isEdit) {
      updatePaymentMutation.mutate({ id: formData.id, data: payload })
    } else {
      createPaymentMutation.mutate(payload)
    }
  }

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)

  const handleDownloadPdf = async () => {
    if (!selectedPayment) return
    setIsGeneratingPdf(true)
    try {
      const element = document.getElementById('print-section')
      if (!element) return

      // Take high-resolution screenshot of the payslip print element
      const canvas = await html2canvas(element, {
        scale: 3, // High DPI resolution for crisp text print
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const imgWidth = 210
      const pageHeight = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      // Center vertically if it fits perfectly on one page
      const yOffset = imgHeight < pageHeight ? (pageHeight - imgHeight) / 2 : 0

      pdf.addImage(imgData, 'PNG', 0, yOffset, imgWidth, imgHeight)
      pdf.save(`payslip-${selectedPayment.employeeName.toLowerCase().replace(/\s+/g, '-')}-${selectedPayment.salaryMonth}.pdf`)
      showToast('Payslip downloaded successfully', 'success')
    } catch (error) {
      console.error('Error generating PDF:', error)
      showToast('Failed to generate PDF payslip', 'error')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const handlePrintOnlySlip = async () => {
    if (!selectedPayment) return
    setIsPrinting(true)
    try {
      const element = document.getElementById('print-section')
      if (!element) return

      // Capture element as canvas
      const canvas = await html2canvas(element, {
        scale: 3, // High DPI
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      })

      const imgData = canvas.toDataURL('image/png')

      // Create a hidden iframe for print formatting
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      document.body.appendChild(iframe)

      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (doc) {
        doc.open()
        doc.write(`
          <html>
            <head>
              <title>Payslip - ${selectedPayment.salaryNo}</title>
              <style>
                body {
                  margin: 0;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  background-color: #ffffff;
                }
                img {
                  max-width: 100%;
                  max-height: 100%;
                  object-fit: contain;
                }
                @page {
                  size: A4;
                  margin: 0;
                }
              </style>
            </head>
            <body>
              <img src="${imgData}" onload="window.print();" />
            </body>
          </html>
        `)
        doc.close()

        // Wait for printing to trigger, then clean up
        await new Promise((resolve) => setTimeout(resolve, 1000))
        document.body.removeChild(iframe)
      }
    } catch (error) {
      console.error('Error printing payslip:', error)
      showToast('Failed to print payslip', 'error')
    } finally {
      setIsPrinting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">

      <EnterpriseHeader
        title="Payroll Directory"
        description="Process salary disbursements, generate payslips, and reconcile payroll general ledger records."
        actions={
          <EnterpriseButton onClick={openCreateModal} variant="primary">
            <Plus className="w-4 h-4 mr-2" />
            Generate Salary
          </EnterpriseButton>
        }
      />

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <EnterpriseCard className="border-l-4 border-l-blue-500">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-500 rounded-lg">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Disbursed This Month</span>
              <span className="text-2xl font-bold text-slate-800">
                ₹{(payrollData?.items?.filter(x => x.salaryMonth === new Date().toISOString().substring(0, 7)).reduce((acc, curr) => acc + curr.netSalary, 0) ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                ₹{(payrollData?.items?.filter(x => x.paymentMethod === 'BankAccount').reduce((acc, curr) => acc + curr.netSalary, 0) ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                ₹{(payrollData?.items?.filter(x => x.paymentMethod === 'CashBook').reduce((acc, curr) => acc + curr.netSalary, 0) ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
        ) : !payrollData?.items || payrollData.items.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">No payroll records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase select-none">
                  <th className="py-3 px-4">Salary No</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Month</th>
                  <th className="py-3 px-4 text-right">Basic Salary</th>
                  <th className="py-3 px-4 text-center">Days Worked</th>
                  <th className="py-3 px-4 text-right font-bold text-slate-500">Net Salary</th>
                  <th className="py-3 px-4">Paid From</th>
                  <th className="py-3 px-4">Payment Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {payrollData.items.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#1e293b]">{payment.salaryNo}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800">{payment.employeeName}</span>
                        <span className="text-[11px] text-slate-400">{payment.department} • {payment.designation || 'Staff'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{payment.salaryMonth}</td>
                    <td className="py-3.5 px-4 text-right text-slate-700">₹{payment.monthlySalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-3.5 px-4 text-center text-slate-700">{payment.daysWorked} / {payment.workingDays}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-blue-600">₹{payment.netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        {payment.paymentMethod === 'BankAccount' ? <Landmark className="w-3.5 h-3.5 text-slate-400" /> : <Wallet className="w-3.5 h-3.5 text-slate-400" />}
                        <span className="truncate max-w-[120px]" title={payment.paidFrom}>{payment.paidFrom}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{new Date(payment.paymentDate).toLocaleDateString()}</td>
                    <td className="py-3.5 px-4">
                      <EnterpriseBadge variant="success">{payment.status}</EnterpriseBadge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openViewModal(payment.id)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors" title="View Transaction"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => openHistoryModal(payment.id, payment.salaryNo)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors" title="View Audit History"><History className="w-4 h-4" /></button>
                        <button onClick={() => openSlipModal(payment.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors" title="Print Slip"><Printer className="w-4 h-4" /></button>
                        <button onClick={() => openEditModal(payment.id)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer transition-colors" title="Edit salary payment"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(payment.id, payment.salaryNo)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-colors" title="Delete & reverse"><Trash2 className="w-4 h-4" /></button>
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

      {/* Salary Generation / Create Modal */}
      <EnterpriseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Disburse Employee Salary"
        maxWidth="lg"
      >
        <form onSubmit={(e) => handleSubmit(e, false)} className="flex flex-col gap-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-lg text-left">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Employee Selection */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Employee *</label>
              <select
                className="h-[42px] px-3 border border-slate-200 rounded-[8px] text-sm focus:border-blue-500 focus:outline-none w-full"
                value={formData.employeeId}
                onChange={(e) => handleEmployeeChange(e.target.value)}
                required
              >
                <option value="">Select Employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.department})</option>
                ))}
              </select>
            </div>

            {/* Salary Month */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Salary Month *</label>
              <input
                type="month"
                className="h-[42px] px-3 border border-slate-200 rounded-[8px] text-sm focus:border-blue-500 focus:outline-none w-full"
                value={formData.salaryMonth}
                onChange={(e) => setFormData({ ...formData, salaryMonth: e.target.value })}
                required
              />
            </div>

            {/* Read-Only Current Salary */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Monthly Salary (Read Only)</label>
              <div className="h-[42px] px-3 border border-slate-100 bg-slate-50 rounded-[8px] text-sm flex items-center font-bold text-slate-800">
                ₹{formData.currentSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* Working Days */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Working Days In Month *</label>
              <input
                type="number"
                min="1"
                max="31"
                className="h-[42px] px-3 border border-slate-200 rounded-[8px] text-sm focus:border-blue-500 focus:outline-none w-full"
                value={formData.workingDays}
                onChange={(e) => setFormData({ ...formData, workingDays: e.target.value })}
                required
              />
            </div>

            {/* Days Worked */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Days Worked *</label>
              <input
                type="number"
                min="0"
                max="31"
                className="h-[42px] px-3 border border-slate-200 rounded-[8px] text-sm focus:border-blue-500 focus:outline-none w-full"
                value={formData.daysWorked}
                onChange={(e) => setFormData({ ...formData, daysWorked: e.target.value })}
                required
              />
            </div>

            {/* Read-Only Daily Salary */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Daily Salary (Read Only)</label>
              <div className="h-[42px] px-3 border border-slate-100 bg-slate-50 rounded-[8px] text-sm flex items-center text-slate-600">
                ₹{dailySalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* Read-Only Gross Salary */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Gross Salary (Read Only)</label>
              <div className="h-[42px] px-3 border border-slate-100 bg-slate-50 rounded-[8px] text-sm flex items-center text-slate-700 font-semibold">
                ₹{grossSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* Bonus */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Bonus (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="h-[42px] px-3 border border-slate-200 rounded-[8px] text-sm focus:border-blue-500 focus:outline-none w-full"
                value={formData.bonus}
                onChange={(e) => setFormData({ ...formData, bonus: e.target.value })}
              />
            </div>

            {/* Advance Deduction */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Advance Deduction (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="h-[42px] px-3 border border-slate-200 rounded-[8px] text-sm focus:border-blue-500 focus:outline-none w-full"
                value={formData.advanceDeduction}
                onChange={(e) => setFormData({ ...formData, advanceDeduction: e.target.value })}
              />
            </div>

            {/* Other Deduction */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Other Deduction (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="h-[42px] px-3 border border-slate-200 rounded-[8px] text-sm focus:border-blue-500 focus:outline-none w-full"
                value={formData.otherDeduction}
                onChange={(e) => setFormData({ ...formData, otherDeduction: e.target.value })}
              />
            </div>

            {/* Payment Method */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Payment Method</label>
              <div className="flex gap-6 items-center h-[42px]">
                <label className="flex items-center gap-2 text-sm text-slate-700 font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="BankAccount"
                    checked={formData.paymentMethod === 'BankAccount'}
                    onChange={() => setFormData({ ...formData, paymentMethod: 'BankAccount' })}
                  />
                  Bank Account
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="CashBook"
                    checked={formData.paymentMethod === 'CashBook'}
                    onChange={() => setFormData({ ...formData, paymentMethod: 'CashBook' })}
                  />
                  Cash Book
                </label>
              </div>
            </div>

            {/* Bank/Cash Account Selector */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Select Account *</label>
              {formData.paymentMethod === 'BankAccount' ? (
                <select
                  className="h-[42px] px-3 border border-slate-200 rounded-[8px] text-sm focus:border-blue-500 focus:outline-none w-full"
                  value={formData.bankAccountId}
                  onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                  required
                >
                  {bankAccounts.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} - {b.accountName} (Bal: ₹{b.currentBalance.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  className="h-[42px] px-3 border border-slate-200 rounded-[8px] text-sm focus:border-blue-500 focus:outline-none w-full"
                  value={formData.cashBookId}
                  onChange={(e) => setFormData({ ...formData, cashBookId: e.target.value })}
                  required
                >
                  {cashBooks.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Bal: ₹{c.currentBalance.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Remarks */}
            <div className="md:col-span-2 flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Remarks</label>
              <textarea
                className="px-3 py-2 border border-slate-200 rounded-[8px] text-sm focus:border-blue-500 focus:outline-none w-full h-[60px]"
                placeholder="Disbursement comments/notes..."
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              />
            </div>

            {/* Net Salary Summary Block */}
            <div className="md:col-span-2 bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex justify-between items-center mt-2">
              <span className="text-sm font-bold text-slate-600 uppercase tracking-wide">Net Salary Calculated:</span>
              <span className="text-xl font-black text-blue-600">₹{netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <EnterpriseButton type="button" onClick={() => setIsCreateModalOpen(false)} variant="secondary">
              Cancel
            </EnterpriseButton>
            <EnterpriseButton type="submit" loading={createPaymentMutation.isPending} variant="primary">
              Generate Salary
            </EnterpriseButton>
          </div>
        </form>
      </EnterpriseModal>

      {/* Edit Salary Modal */}
      <EnterpriseModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Adjust Salary Disbursement"
        maxWidth="lg"
      >
        <form onSubmit={(e) => handleSubmit(e, true)} className="flex flex-col gap-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-lg text-left">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Read-Only Employee name during edit */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Employee (Read Only)</label>
              <div className="h-[42px] px-3 border border-slate-100 bg-slate-50 rounded-[8px] text-sm flex items-center font-bold text-slate-800">
                {formData.employeeName}
              </div>
            </div>

            {/* Salary Month */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Salary Month *</label>
              <input
                type="month"
                className="h-[42px] px-3 border border-slate-200 rounded-[8px] text-sm focus:border-blue-500 focus:outline-none w-full"
                value={formData.salaryMonth}
                onChange={(e) => setFormData({ ...formData, salaryMonth: e.target.value })}
                required
              />
            </div>

            {/* Monthly Salary */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Monthly Salary (Read Only)</label>
              <div className="h-[42px] px-3 border border-slate-100 bg-slate-50 rounded-[8px] text-sm flex items-center font-bold text-slate-800">
                ₹{formData.currentSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* Working Days */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Working Days In Month *</label>
              <input
                type="number"
                min="1"
                max="31"
                className="h-[42px] px-3 border border-slate-200 rounded-[8px] text-sm focus:border-blue-500 focus:outline-none w-full"
                value={formData.workingDays}
                onChange={(e) => setFormData({ ...formData, workingDays: e.target.value })}
                required
              />
            </div>

            {/* Days Worked */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Days Worked *</label>
              <input
                type="number"
                min="0"
                max="31"
                className="h-[42px] px-3 border border-slate-200 rounded-[8px] text-sm focus:border-blue-500 focus:outline-none w-full"
                value={formData.daysWorked}
                onChange={(e) => setFormData({ ...formData, daysWorked: e.target.value })}
                required
              />
            </div>

            {/* Read-Only Daily Salary */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Daily Salary (Read Only)</label>
              <div className="h-[42px] px-3 border border-slate-100 bg-slate-50 rounded-[8px] text-sm flex items-center text-slate-600">
                ₹{dailySalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* Read-Only Gross Salary */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Gross Salary (Read Only)</label>
              <div className="h-[42px] px-3 border border-slate-100 bg-slate-50 rounded-[8px] text-sm flex items-center text-slate-700 font-semibold">
                ₹{grossSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* Bonus */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Bonus (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="h-[42px] px-3 border border-slate-200 rounded-[8px] text-sm focus:border-blue-500 focus:outline-none w-full"
                value={formData.bonus}
                onChange={(e) => setFormData({ ...formData, bonus: e.target.value })}
              />
            </div>

            {/* Advance Deduction */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Advance Deduction (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="h-[42px] px-3 border border-slate-200 rounded-[8px] text-sm focus:border-blue-500 focus:outline-none w-full"
                value={formData.advanceDeduction}
                onChange={(e) => setFormData({ ...formData, advanceDeduction: e.target.value })}
              />
            </div>

            {/* Other Deduction */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Other Deduction (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="h-[42px] px-3 border border-slate-200 rounded-[8px] text-sm focus:border-blue-500 focus:outline-none w-full"
                value={formData.otherDeduction}
                onChange={(e) => setFormData({ ...formData, otherDeduction: e.target.value })}
              />
            </div>

            {/* Payment Method */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Payment Method</label>
              <div className="flex gap-6 items-center h-[42px]">
                <label className="flex items-center gap-2 text-sm text-slate-700 font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="editPaymentMethod"
                    value="BankAccount"
                    checked={formData.paymentMethod === 'BankAccount'}
                    onChange={() => setFormData({ ...formData, paymentMethod: 'BankAccount' })}
                  />
                  Bank Account
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="editPaymentMethod"
                    value="CashBook"
                    checked={formData.paymentMethod === 'CashBook'}
                    onChange={() => setFormData({ ...formData, paymentMethod: 'CashBook' })}
                  />
                  Cash Book
                </label>
              </div>
            </div>

            {/* Account Selector */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Select Account *</label>
              {formData.paymentMethod === 'BankAccount' ? (
                <select
                  className="h-[42px] px-3 border border-slate-200 rounded-[8px] text-sm focus:border-blue-500 focus:outline-none w-full"
                  value={formData.bankAccountId}
                  onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                  required
                >
                  {bankAccounts.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} - {b.accountName} (Bal: ₹{b.currentBalance.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  className="h-[42px] px-3 border border-slate-200 rounded-[8px] text-sm focus:border-blue-500 focus:outline-none w-full"
                  value={formData.cashBookId}
                  onChange={(e) => setFormData({ ...formData, cashBookId: e.target.value })}
                  required
                >
                  {cashBooks.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Bal: ₹{c.currentBalance.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Remarks */}
            <div className="md:col-span-2 flex flex-col gap-1.5 text-left">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Remarks</label>
              <textarea
                className="px-3 py-2 border border-slate-200 rounded-[8px] text-sm focus:border-blue-500 focus:outline-none w-full h-[60px]"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              />
            </div>

            {/* Net Salary Summary Block */}
            <div className="md:col-span-2 bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex justify-between items-center mt-2">
              <span className="text-sm font-bold text-slate-600 uppercase tracking-wide">Net Salary Calculated:</span>
              <span className="text-xl font-black text-blue-600">₹{netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <EnterpriseButton type="button" onClick={() => setIsEditModalOpen(false)} variant="secondary">
              Cancel
            </EnterpriseButton>
            <EnterpriseButton type="submit" loading={updatePaymentMutation.isPending} variant="primary">
              Save Changes
            </EnterpriseButton>
          </div>
        </form>
      </EnterpriseModal>

      {/* View Details Modal */}
      <EnterpriseModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Payroll Transaction - ${selectedPayment?.salaryNo}`}
        maxWidth="md"
      >
        {selectedPayment && (
          <div className="flex flex-col gap-4 text-left">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-xs font-bold text-slate-400 block uppercase">Employee</span>
                <span className="text-sm font-bold text-slate-800">{selectedPayment.employeeName}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-xs font-bold text-slate-400 block uppercase">Role & Dept</span>
                <span className="text-sm text-slate-850 font-medium">{selectedPayment.department} • {selectedPayment.designation || 'Staff'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-xs font-bold text-slate-400 block uppercase">Salary Month</span>
                <span className="text-sm text-slate-800 font-semibold">{selectedPayment.salaryMonth}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-xs font-bold text-slate-400 block uppercase">Basic Salary</span>
                <span className="text-sm text-slate-800 font-semibold">₹{selectedPayment.monthlySalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-xs font-bold text-slate-400 block uppercase">Working / Worked Days</span>
                <span className="text-sm text-slate-800">{selectedPayment.daysWorked} Worked / {selectedPayment.workingDays} Total</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-xs font-bold text-slate-400 block uppercase">Daily Wage</span>
                <span className="text-sm text-slate-700">₹{selectedPayment.dailySalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-xs font-bold text-slate-400 block uppercase">Gross Salary</span>
                <span className="text-sm text-slate-700">₹{selectedPayment.grossSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-xs font-bold text-slate-400 block uppercase">Disbursement Date</span>
                <span className="text-sm text-slate-650">{new Date(selectedPayment.paymentDate).toLocaleString()}</span>
              </div>
            </div>

            <div className="border border-slate-100 rounded-lg p-3 space-y-2">
              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Payroll Adjustments</h5>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Bonus (+)</span>
                <span className="font-semibold text-green-600">+₹{selectedPayment.bonus.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Advance Deductions (-)</span>
                <span className="font-semibold text-red-500">-₹{selectedPayment.advanceDeduction.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Other Deductions (-)</span>
                <span className="font-semibold text-red-500">-₹{selectedPayment.otherDeduction.toLocaleString('en-IN')}</span>
              </div>
              <div className="border-t border-slate-100 pt-2 flex justify-between text-base font-bold">
                <span className="text-slate-800">Net Salary Paid</span>
                <span className="text-blue-600">₹{selectedPayment.netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {selectedPayment.remarks && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-xs font-bold text-slate-400 block uppercase">Remarks</span>
                <p className="text-sm text-slate-600 italic mt-1">{selectedPayment.remarks}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end mt-2">
              <EnterpriseButton onClick={() => setIsViewModalOpen(false)} variant="secondary">
                Close
              </EnterpriseButton>
              <EnterpriseButton onClick={() => {
                setIsViewModalOpen(false)
                openSlipModal(selectedPayment.id)
              }} variant="primary">
                <FileText className="w-4 h-4 mr-2" />
                View Pay Slip
              </EnterpriseButton>
            </div>
          </div>
        )}
      </EnterpriseModal>

      {/* Salary Slip Print Modal */}
      <EnterpriseModal
        isOpen={isSlipOpen}
        onClose={() => setIsSlipOpen(false)}
        title="Print Employee Salary Slip"
        maxWidth="lg"
      >
        {selectedPayment && (
          <div className="flex flex-col gap-6">
            {/* Centering and scroll wrapper for responsiveness */}
            <div className="overflow-x-auto w-full py-2 flex justify-center bg-slate-50 rounded-2xl" style={{ backgroundColor: '#f8fafc' }}>
              {/* Slip Printable area */}
              <div
                id="print-section"
                className="bg-white border rounded-2xl p-8 shadow-sm select-none font-sans text-left"
                style={{
                  width: '640px',
                  minWidth: '640px',
                  backgroundColor: '#ffffff',
                  color: '#1e293b',
                  borderColor: '#f1f5f9',
                  borderWidth: '1px'
                }}
              >
                {/* Premium Header */}
                <div className="flex justify-between items-start pb-5 mb-5" style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      {/* Visual Brand Mark */}
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-lg shadow-sm" style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)', color: '#ffffff' }}>
                        A
                      </div>
                      <div>
                        <h2 className="text-lg font-bold tracking-tight leading-none" style={{ color: '#0f172a' }}>Aquora ERP</h2>
                        <span className="text-[10px] font-bold uppercase tracking-widest leading-none block mt-1" style={{ color: '#94a3b8' }}>Aquora Technologies Pvt. Ltd.</span>
                      </div>
                    </div>
                    <p className="text-[10px] mt-2 font-medium" style={{ color: '#94a3b8' }}>
                      Corporate Office: Tech Park, Phase II, Bangalore, KA, India<br/>
                      Email: hr@aquora.io | Web: www.aquora.io
                    </p>
                  </div>
                  
                  <div className="text-right flex flex-col items-end gap-1.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #d1fae5' }}>
                      <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: '#10b981' }}></span>
                      PAID / DISBURSED
                    </span>
                    <div className="mt-2">
                      <span className="text-[9px] font-bold block uppercase tracking-wider" style={{ color: '#94a3b8' }}>Salary Statement</span>
                      <span className="font-mono font-bold text-xs" style={{ color: '#1e293b' }}>Ref: {selectedPayment.salaryNo}</span>
                    </div>
                  </div>
                </div>

                {/* Employee & Payment Grid Info */}
                <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-xs mb-5 pb-5 p-4 rounded-xl" style={{ backgroundColor: 'rgba(248, 250, 252, 0.7)', border: '1px solid #f1f5f9' }}>
                  <div>
                    <span className="font-bold block text-[9px] uppercase tracking-wider mb-0.5" style={{ color: '#94a3b8' }}>Employee Name</span>
                    <strong className="text-xs" style={{ color: '#1e293b' }}>{selectedPayment.employeeName}</strong>
                  </div>
                  <div>
                    <span className="font-bold block text-[9px] uppercase tracking-wider mb-0.5" style={{ color: '#94a3b8' }}>Salary Month</span>
                    <strong className="text-xs" style={{ color: '#1e293b' }}>{selectedPayment.salaryMonth}</strong>
                  </div>
                  <div>
                    <span className="font-bold block text-[9px] uppercase tracking-wider mb-0.5" style={{ color: '#94a3b8' }}>Department</span>
                    <span className="font-semibold" style={{ color: '#334155' }}>{selectedPayment.department}</span>
                  </div>
                  <div>
                    <span className="font-bold block text-[9px] uppercase tracking-wider mb-0.5" style={{ color: '#94a3b8' }}>Designation</span>
                    <span className="font-semibold" style={{ color: '#334155' }}>{selectedPayment.designation || 'Staff'}</span>
                  </div>
                  <div>
                    <span className="font-bold block text-[9px] uppercase tracking-wider mb-0.5" style={{ color: '#94a3b8' }}>Payment Method</span>
                    <span className="font-semibold" style={{ color: '#334155' }}>{selectedPayment.paymentMethod === 'BankAccount' ? 'Bank Transfer' : 'Cash Book'}</span>
                  </div>
                  <div>
                    <span className="font-bold block text-[9px] uppercase tracking-wider mb-0.5" style={{ color: '#94a3b8' }}>Payment Date</span>
                    <span className="font-semibold" style={{ color: '#334155' }}>{new Date(selectedPayment.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>

                {/* Attendance Details Table */}
                <div className="mb-5">
                  <h4 className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: '#94a3b8' }}>Attendance & Wage Details</h4>
                  <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #f1f5f9' }}>
                    <table className="w-full text-xs">
                      <thead className="font-bold uppercase tracking-wider" style={{ backgroundColor: '#f8fafc', color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>
                        <tr>
                          <th className="py-2.5 px-4 text-left font-bold">Base Monthly Salary</th>
                          <th className="py-2.5 px-4 text-center font-bold">Working Days</th>
                          <th className="py-2.5 px-4 text-center font-bold">Days Worked</th>
                          <th className="py-2.5 px-4 text-right font-bold">Daily Rate</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs font-medium" style={{ color: '#334155' }}>
                        <tr>
                          <td className="py-3 px-4 font-semibold" style={{ color: '#0f172a' }}>₹{selectedPayment.monthlySalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="py-3 px-4 text-center">{selectedPayment.workingDays} days</td>
                          <td className="py-3 px-4 text-center font-semibold" style={{ color: '#4f46e5' }}>{selectedPayment.daysWorked} days</td>
                          <td className="py-3 px-4 text-right font-semibold" style={{ color: '#0f172a' }}>₹{selectedPayment.dailySalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Earnings & Deductions Grid */}
                <div className="grid grid-cols-2 gap-5 mb-5">
                  {/* Earnings */}
                  <div className="rounded-xl p-4 shadow-sm" style={{ border: '1px solid #f1f5f9', backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
                    <h4 className="text-[9px] font-bold uppercase tracking-widest mb-3 pb-1.5 flex justify-between items-center" style={{ color: '#94a3b8', borderBottom: '1px solid #e2e8f0' }}>
                      <span>Earnings</span>
                      <span className="text-[8px] font-bold px-1.5 py-0.2 rounded" style={{ backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #d1fae5' }}>Additions</span>
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span style={{ color: '#64748b' }}>Gross Worked Salary</span>
                        <span className="font-semibold" style={{ color: '#1e293b' }}>₹{selectedPayment.grossSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: '#64748b' }}>Bonus</span>
                        <span className="font-bold" style={{ color: '#059669' }}>+₹{selectedPayment.bonus.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="pt-2 flex justify-between font-bold" style={{ borderTop: '1px solid #e2e8f0', color: '#0f172a' }}>
                        <span>Total Earnings</span>
                        <span>₹{(selectedPayment.grossSalary + selectedPayment.bonus).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Deductions */}
                  <div className="rounded-xl p-4 shadow-sm" style={{ border: '1px solid #f1f5f9', backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
                    <h4 className="text-[9px] font-bold uppercase tracking-widest mb-3 pb-1.5 flex justify-between items-center" style={{ color: '#94a3b8', borderBottom: '1px solid #e2e8f0' }}>
                      <span>Deductions</span>
                      <span className="text-[8px] font-bold px-1.5 py-0.2 rounded" style={{ backgroundColor: '#fff1f2', color: '#be123c', border: '1px solid #ffe4e6' }}>Subtractions</span>
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span style={{ color: '#64748b' }}>Advance Deductions</span>
                        <span className="font-semibold" style={{ color: '#1e293b' }}>-₹{selectedPayment.advanceDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: '#64748b' }}>Other Deductions</span>
                        <span className="font-semibold" style={{ color: '#f43f5e' }}>-₹{selectedPayment.otherDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="pt-2 flex justify-between font-bold" style={{ borderTop: '1px solid #e2e8f0', color: '#0f172a' }}>
                        <span>Total Deductions</span>
                        <span>₹{(selectedPayment.advanceDeduction + selectedPayment.otherDeduction).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Net Take-Home Statement */}
                <div className="rounded-xl p-4 flex justify-between items-center mb-6 shadow-sm" style={{ background: 'linear-gradient(to right, #2563eb, #4f46e5)', color: '#ffffff' }}>
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider block mb-0.5" style={{ opacity: 0.75 }}>Net Take-Home Salary</span>
                    <span className="text-[10px] font-medium" style={{ opacity: 0.9 }}>Disbursed successfully</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black">₹{selectedPayment.netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {selectedPayment.remarks && (
                  <div className="mb-5 p-3 rounded-xl" style={{ backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                    <span className="text-[8px] font-bold block uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>Remarks</span>
                    <p className="text-xs italic font-medium" style={{ color: '#475569' }}>"{selectedPayment.remarks}"</p>
                  </div>
                )}

                {/* Signature Area */}
                <div className="flex justify-between items-end pt-8" style={{ borderTop: '1px solid #f1f5f9' }}>
                  <div className="text-center w-36">
                    <div className="h-[1px] w-full mb-1.5" style={{ backgroundColor: '#e2e8f0' }}></div>
                    <span className="text-[8px] font-bold uppercase tracking-wider block" style={{ color: '#94a3b8' }}>Employee Signature</span>
                  </div>
                  <div className="text-center w-36">
                    <div className="flex justify-center mb-1.5">
                      <span className="text-[8px] font-serif italic font-bold" style={{ color: '#6366f1' }}>Aquora ERP Official</span>
                    </div>
                    <div className="h-[1px] w-full mb-1.5" style={{ backgroundColor: '#0f172a' }}></div>
                    <span className="text-[8px] font-bold uppercase tracking-wider block" style={{ color: '#0f172a' }}>Authorized Signatory</span>
                  </div>
                </div>

                {/* Computer Generated Disclaimer */}
                <div className="mt-6 text-center pt-3" style={{ borderTop: '1px solid #f8fafc' }}>
                  <p className="text-[8px] font-medium" style={{ color: '#94a3b8' }}>
                    This is a system-generated payslip generated on {new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}. No physical signature is required.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2 justify-end select-none">
              <EnterpriseButton onClick={() => setIsSlipOpen(false)} variant="secondary">
                Close
              </EnterpriseButton>
              <EnterpriseButton onClick={handlePrintOnlySlip} loading={isPrinting} variant="primary">
                <Printer className="w-4 h-4 mr-2" />
                Print Slip
              </EnterpriseButton>
              <EnterpriseButton onClick={handleDownloadPdf} loading={isGeneratingPdf} variant="primary">
                <FileText className="w-4 h-4 mr-2" />
                Download PDF
              </EnterpriseButton>
            </div>
          </div>
        )}
      </EnterpriseModal>

      {/* TRANSACTION AUDIT HISTORY MODAL */}
      {isHistoryOpen && (
        <EnterpriseModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          title={`Payroll Audit Trail - ${selectedSalaryNo}`}
        >
          <div className="space-y-4 text-xs">
            {loadingHistory ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 rounded-full border-3 border-slate-200 border-t-[#1A56DB] animate-spin"></div>
              </div>
            ) : historyItems.length === 0 ? (
              <p className="text-center py-6 text-slate-500">No audit history found for this payroll record.</p>
            ) : (
              <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-4">
                {historyItems.map((item) => {
                  const isCreated = item.action.toLowerCase() === 'created'
                  return (
                    <div key={item.id} className="relative">
                      <span className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border border-white ${
                        isCreated ? 'bg-emerald-500' : 'bg-blue-500'
                      }`}></span>
                      <div className="flex items-center justify-between font-bold text-slate-900 mb-0.5">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${
                          isCreated 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                            : 'bg-blue-50 text-blue-700 border border-blue-100'
                        }`}>
                          {item.action}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {new Date(item.changedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}{' '}
                          {new Date(item.changedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                        <div className="grid grid-cols-2 gap-2 text-[11px] mb-1.5">
                          <div>
                            <span className="text-slate-500">Net Salary:</span>{' '}
                            <span className="font-bold text-slate-800">
                              ₹{item.newAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                            {!isCreated && item.oldAmount > 0 && (
                              <span className="text-slate-400 line-through ml-1.5">
                                ₹{item.oldAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500">Updated By:</span>{' '}
                            <span className="font-medium text-slate-700">{item.changedBy || 'System'}</span>
                          </div>
                        </div>
                        {item.remarks && (
                          <div className="text-[10px] text-slate-600 bg-white px-2 py-1.5 rounded border border-slate-100 mt-1 italic">
                            <span className="font-semibold not-italic text-slate-500 mr-1">Remarks:</span>
                            {item.remarks}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 flex justify-end">
              <EnterpriseButton variant="secondary" onClick={() => setIsHistoryOpen(false)}>
                Close
              </EnterpriseButton>
            </div>
          </div>
        </EnterpriseModal>
      )}
    </div>
  )
}

export default PayrollPage
