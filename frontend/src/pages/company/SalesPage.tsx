import PageContainer from '../../components/ui/layout/PageContainer';
import PageHeader from '../../components/ui/layout/PageHeader';
import FilterBar from '../../components/ui/layout/FilterBar';
import React, { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Search, Plus, Eye, Edit2, Trash2, X, AlertTriangle,
  User as UserIcon, Calendar, ArrowUpDown, Filter, ChevronLeft, ChevronRight, CheckCircle2,
  Package, ShoppingCart, Info, Phone, Tag, FileSpreadsheet, FileText, Landmark, Printer, Download, ArrowLeft, Send
} from 'lucide-react'
import { api } from '../../services/api'
import { salesService } from '../../services/sales'
import type { SalesTransaction, CreateSalesTransactionRequest } from '../../services/sales'
import { productsService } from '../../services/products'
import { customersService } from '../../services/customers'
import { simpleAccountsService } from '../../services/simpleAccounts'
import { useAuthStore } from '../../store/useAuthStore'
import { generateERPDocumentPDF } from '../../utils/pdfTemplateEngine'
import EnterpriseBadge from '../../components/ui/EnterpriseBadge'
import EnterpriseButton from '../../components/ui/EnterpriseButton'
import EnterpriseNumberInput from '../../components/ui/EnterpriseNumberInput'

const PremiumLabel: React.FC<{ label: string; required?: boolean }> = ({ label, required }) => {
  const hasAsterisk = required || label.endsWith('*');
  const cleanLabel = hasAsterisk ? label.replace('*', '').trim() : label;
  return (
    <label className="text-[13px] font-semibold text-gray-700 select-none mb-1.5 flex items-center">
      <span>{cleanLabel}</span>
      {hasAsterisk && <span className="text-red-500 ml-1 font-bold text-xs select-none">*</span>}
    </label>
  );
};

export const SalesPage: React.FC<{ canWrite: boolean; showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void }> = ({ canWrite, showToast }) => {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()

  // Table parameters
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [productIdFilter, setProductIdFilter] = useState('')
  const [customerIdFilter, setCustomerIdFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')
  const [sortOrder, setSortOrder] = useState('newest')

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  // Selected records (Full screen details layout when viewing)
  const [selectedTxn, setSelectedTxn] = useState<SalesTransaction | null>(null)
  const [isViewingDetails, setIsViewingDetails] = useState(false)

  // Dynamic Form State Variables
  const [formType, setFormType] = useState('Sales Dispatch')
  const [formProductId, setFormProductId] = useState('')
  const [formCustomerId, setFormCustomerId] = useState('')
  const [formCases, setFormCases] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().substring(0, 10))
  const [formRef, setFormRef] = useState('')
  const [formRemarks, setFormRemarks] = useState('')

  // New ERP Form State Variables
  const [formUnitPrice, setFormUnitPrice] = useState('')
  const [formDiscount, setFormDiscount] = useState('')
  const [isGstEnabled, setIsGstEnabled] = useState(false)
  const [formPaymentMethod, setFormPaymentMethod] = useState('Cash')
  const [formBankAccountId, setFormBankAccountId] = useState('')
  const [formCashBookId, setFormCashBookId] = useState('')

  // Return specific fields
  const [formOriginalInvoice, setFormOriginalInvoice] = useState('')
  const [formReturnReason, setFormReturnReason] = useState('')
  const [formReturnCondition, setFormReturnCondition] = useState('Good')
  const [formRefundMethod, setFormRefundMethod] = useState('Credit Note')

  // Damage specific fields
  const [formWarehouse, setFormWarehouse] = useState('Main Warehouse')
  const [formDamageType, setFormDamageType] = useState('Broken')
  const [formApprovedBy, setFormApprovedBy] = useState('')

  // Consumption specific fields
  const [formDepartment, setFormDepartment] = useState('')
  const [formPurpose, setFormPurpose] = useState('')

  // Free Sample specific fields
  const [formMarketingCampaign, setFormMarketingCampaign] = useState('')
  const [formSalesPerson, setFormSalesPerson] = useState('')

  // Stock Adjustment specific fields
  const [formAdjustmentReason, setFormAdjustmentReason] = useState('Correction')
  const [formAdjustmentMode, setFormAdjustmentMode] = useState('Increase')

  // Searchable customer dropdown UI state
  const [customerSearch, setCustomerSearch] = useState('')
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false)

  // Queries
  const { data: txnsData, isLoading: isTxnsLoading } = useQuery({
    queryKey: ['salesTransactionsList', page, search, productIdFilter, customerIdFilter, typeFilter, statusFilter, startDateFilter, endDateFilter, sortOrder],
    queryFn: () => salesService.getTransactions(
      page, 10, search, productIdFilter, customerIdFilter, typeFilter, statusFilter, startDateFilter, endDateFilter, sortOrder
    )
  })

  const transactions = txnsData?.data?.items || []
  const pagination = txnsData?.data

  // Fetch all active products
  const { data: productsData } = useQuery({
    queryKey: ['activeProductsForSales'],
    queryFn: async () => {
      const res = await productsService.getProducts(1, 100, '')
      return res.data?.items.filter(p => p.isActive) || []
    }
  })
  const products = productsData || []

  // Fetch all active customers
  const { data: customersData, refetch: refetchCustomers } = useQuery({
    queryKey: ['activeCustomersForSales'],
    queryFn: async () => {
      const res = await customersService.getCustomers(1, 100, '', '', 'Active')
      return res.data?.items.filter(c => c.isActive) || []
    }
  })
  const customers = customersData || []

  // Fetch Bank Accounts and Cash Books
  const { data: bankAccounts } = useQuery({
    queryKey: ['bankAccountsDropdown'],
    queryFn: () => simpleAccountsService.getBankAccountDropdown()
  })
  const banks = bankAccounts || []

  const { data: cashBooks } = useQuery({
    queryKey: ['cashBooksDropdown'],
    queryFn: () => simpleAccountsService.getCashBookDropdown()
  })
  const cashRegisters = cashBooks || []

  // Fetch Company Settings for PDF details
  const { data: companySettings } = useQuery({
    queryKey: ['companySettings'],
    queryFn: async () => {
      const res = await api.get('/api/v1/company/settings')
      return res.data?.data
    }
  })

  // Quick Customer Creation navigation
  const handleQuickCreateCustomer = () => {
    if (!canWrite) {
      showToast('You do not have write permissions.', 'warning')
      return
    }
    const salesForm = {
      formType,
      formProductId,
      formCustomerId,
      formCases,
      formDate,
      formRef,
      formRemarks,
      isCreateOpen: true
    }
    navigate('/company/customers', {
      state: {
        fromSales: true,
        salesForm
      }
    })
  }

  // Restore state after customer creation
  useEffect(() => {
    if (location.state?.fromCustomerCreation) {
      const { salesForm, newCreatedCustomerId } = location.state
      if (salesForm) {
        if (salesForm.formType !== undefined) setFormType(salesForm.formType)
        if (salesForm.formProductId !== undefined) setFormProductId(salesForm.formProductId)
        if (salesForm.formCases !== undefined) setFormCases(salesForm.formCases)
        if (salesForm.formDate !== undefined) setFormDate(salesForm.formDate)
        if (salesForm.formRef !== undefined) setFormRef(salesForm.formRef)
        if (salesForm.formRemarks !== undefined) setFormRemarks(salesForm.formRemarks)
        if (salesForm.isCreateOpen) setIsCreateOpen(true)
      }

      navigate(location.pathname, { replace: true, state: {} })
      queryClient.invalidateQueries({ queryKey: ['activeCustomersForSales'] })
      refetchCustomers().then((res) => {
        const fetched = res.data || []
        const createdCustomer = fetched.find(c => c.id === newCreatedCustomerId)
        if (createdCustomer) {
          setFormCustomerId(createdCustomer.id)
          setCustomerSearch(createdCustomer.customerName)
        }
      })
    }
  }, [location.state])

  // Computed properties
  const selectedProductInForm = useMemo(() => {
    return products.find(p => p.id === formProductId)
  }, [products, formProductId])

  // Auto-populate unit price on product selection
  useEffect(() => {
    if (selectedProductInForm && selectedProductInForm.sellingPrice !== undefined && selectedProductInForm.sellingPrice > 0) {
      setFormUnitPrice(selectedProductInForm.sellingPrice.toString())
    }
  }, [formProductId, selectedProductInForm])

  const selectedCustomerInForm = useMemo(() => {
    return customers.find(c => c.id === formCustomerId)
  }, [customers, formCustomerId])

  const filteredCustomersForForm = useMemo(() => {
    if (!customerSearch) return customers
    const s = customerSearch.toLowerCase()
    return customers.filter(c =>
      c.customerName.toLowerCase().includes(s) ||
      c.customerCode.toLowerCase().includes(s)
    )
  }, [customers, customerSearch])

  // Live Accounting preview calculations
  const accountingImpactPreview = useMemo(() => {
    if (!selectedProductInForm || !formCases) return []
    const cases = parseFloat(formCases) || 0
    if (cases <= 0 && formType !== 'Stock Adjustment') return []

    const costPrice = selectedProductInForm.costPrice || 0
    const sellingPrice = parseFloat(formUnitPrice) || selectedProductInForm.sellingPrice || 0
    const discount = parseFloat(formDiscount) || 0

    const subtotal = cases * sellingPrice - discount
    let cgst = 0, sgst = 0, igst = 0
    if (isGstEnabled) {
      cgst = subtotal * 0.09
      sgst = subtotal * 0.09
    }
    const taxAmount = cgst + sgst + igst
    const grandTotal = subtotal + taxAmount
    const costValue = Math.abs(cases) * costPrice

    if (formType === 'Sales Dispatch') {
      let debitAccount = 'Accounts Receivable'
      if (formPaymentMethod === 'Cash') debitAccount = 'Cash'
      else if (['Bank', 'UPI', 'Cheque'].includes(formPaymentMethod)) debitAccount = 'Bank Account'

      return [
        { type: 'Debit', account: debitAccount, amount: grandTotal },
        { type: 'Credit', account: 'Sales Revenue', amount: subtotal },
        ...(taxAmount > 0 ? [
          { type: 'Credit', account: 'CGST Output Tax', amount: cgst },
          { type: 'Credit', account: 'SGST Output Tax', amount: sgst }
        ] : []),
        ...(costValue > 0 ? [
          { type: 'Debit', account: 'Cost of Goods Sold', amount: costValue },
          { type: 'Credit', account: 'Finished Goods Inventory', amount: costValue }
        ] : [])
      ]
    } else if (formType === 'Customer Return') {
      let creditAccount = 'Accounts Receivable'
      if (formRefundMethod === 'Cash') creditAccount = 'Cash'
      else if (formRefundMethod === 'Bank') creditAccount = 'Bank Account'

      return [
        { type: 'Debit', account: 'Sales Return', amount: grandTotal },
        { type: 'Credit', account: creditAccount, amount: grandTotal },
        ...(costValue > 0 ? [
          { type: 'Debit', account: 'Finished Goods Inventory', amount: costValue },
          { type: 'Credit', account: 'Cost of Goods Sold', amount: costValue }
        ] : [])
      ]
    } else if (formType === 'Damage' || formType === 'Damaged Goods') {
      return [
        { type: 'Debit', account: 'Inventory Loss Expense', amount: costValue },
        { type: 'Credit', account: 'Finished Goods Inventory', amount: costValue }
      ]
    } else if (formType === 'Internal Consumption') {
      return [
        { type: 'Debit', account: 'Office Expense', amount: costValue },
        { type: 'Credit', account: 'Finished Goods Inventory', amount: costValue }
      ]
    } else if (formType === 'Free Sample') {
      return [
        { type: 'Debit', account: 'Marketing Expense', amount: costValue },
        { type: 'Credit', account: 'Finished Goods Inventory', amount: costValue }
      ]
    } else if (formType === 'Stock Adjustment') {
      const isIncrease = formAdjustmentMode === 'Increase'
      return [
        { type: isIncrease ? 'Debit' : 'Debit', account: isIncrease ? 'Finished Goods Inventory' : 'Inventory Adjustment Loss', amount: costValue },
        { type: isIncrease ? 'Credit' : 'Credit', account: isIncrease ? 'Inventory Adjustment Gain' : 'Finished Goods Inventory', amount: costValue }
      ]
    }
    return []
  }, [formType, selectedProductInForm, formCases, formUnitPrice, formDiscount, isGstEnabled, formPaymentMethod, formRefundMethod, formAdjustmentMode])

  // PDF Exporter
  const handleDownloadPDF = (txn: SalesTransaction) => {
    const compName = companySettings?.displayName || companySettings?.name || user?.companyName || 'Corporate Enterprise Tenant'
    const compGst = companySettings?.gstNumber || '36AAACU9876D1Z5'
    const compAddr = companySettings?.address || 'Industrial Park, Hyderabad'

    const total = txn.totalAmount || (txn.cases * (txn.unitPrice || 0))
    const tax = txn.taxAmount || 0
    const sub = total - tax

    const pdf = generateERPDocumentPDF({
      title: `${txn.transactionType.toUpperCase()} TRANSACTION REGISTER`,
      docNumber: txn.transactionNumber,
      date: new Date(txn.transactionDate).toLocaleDateString('en-IN', { dateStyle: 'medium' }),
      companyInfo: {
        name: compName,
        displayName: compName,
        gstNumber: compGst,
        address: compAddr,
        email: user?.email || 'accounts@tenant.com'
      },
      partyLabel: 'Business Connection / Customer',
      partyInfo: {
        name: txn.customerName || 'System Internal Ledger',
        details1: txn.customerCode ? `Code: ${txn.customerCode}` : 'Internal Consumption / Physical Correction',
        details2: txn.referenceNumber ? `Ref: ${txn.referenceNumber}` : undefined
      },
      preparedBy: txn.createdByName || 'ERP Core Integration',
      paymentDetails: {
        method: txn.paymentMethod || 'Credit',
        reference: txn.referenceNumber || undefined,
        status: txn.paymentStatus || undefined
      },
      items: [
        {
          sno: 1,
          description: `${txn.productName} (SKU: ${txn.productSku || 'N/A'})`,
          quantity: txn.cases,
          unitPrice: txn.unitPrice || 0,
          amount: total
        }
      ],
      financialSummary: {
        subTotal: sub,
        taxAmount: tax,
        discountAmount: txn.discountAmount || 0,
        grandTotal: total,
        amountPaid: txn.amountReceived || 0,
        balance: txn.outstandingAmount || 0
      },
      notes: 'Generated by Aquzio ERP system. All postings remain locked under tenant cryptographic ledgers.',
      remarks: txn.remarks || undefined
    })

    pdf.save(`Invoice_${txn.transactionNumber}.pdf`)
  }

  // Mutations
  const createMutation = useMutation({
    mutationFn: salesService.createTransaction,
    onSuccess: (res) => {
      if (res.success) {
        showToast('Sales transaction recorded and general ledger posted.', 'success')
        queryClient.invalidateQueries({ queryKey: ['salesTransactionsList'] })
        queryClient.invalidateQueries({ queryKey: ['salesDashboard'] })
        queryClient.invalidateQueries({ queryKey: ['activeProductsForSales'] })
        setIsCreateOpen(false)
        resetForm()
      } else {
        showToast(res.message || 'Failed to create transaction.', 'error')
      }
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Error recording transaction.', 'error')
    }
  })

  const updateMutation = useMutation({
    mutationFn: salesService.updateTransaction,
    onSuccess: (res) => {
      if (res.success) {
        showToast('Sales transaction updated, ledger balances recalculated.', 'success')
        queryClient.invalidateQueries({ queryKey: ['salesTransactionsList'] })
        queryClient.invalidateQueries({ queryKey: ['salesDashboard'] })
        queryClient.invalidateQueries({ queryKey: ['activeProductsForSales'] })
        setIsEditOpen(false)
        resetForm()
        if (selectedTxn && selectedTxn.id === res.data.id) {
          setSelectedTxn(res.data)
        }
      } else {
        showToast(res.message || 'Failed to update transaction.', 'error')
      }
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Error updating transaction.', 'error')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: salesService.deleteTransaction,
    onSuccess: (res) => {
      if (res.success) {
        showToast('Transaction successfully reversed and ledger accounts adjusted.', 'success')
        queryClient.invalidateQueries({ queryKey: ['salesTransactionsList'] })
        queryClient.invalidateQueries({ queryKey: ['salesDashboard'] })
        queryClient.invalidateQueries({ queryKey: ['activeProductsForSales'] })
        setIsDeleteOpen(false)
        setIsViewingDetails(false)
        setSelectedTxn(null)
      } else {
        showToast(res.message || 'Failed to reverse transaction.', 'error')
      }
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Error deleting transaction.', 'error')
    }
  })

  // Handlers
  const resetForm = () => {
    setFormType('Sales Dispatch')
    setFormProductId('')
    setFormCustomerId('')
    setFormCases('')
    setFormDate(new Date().toISOString().substring(0, 10))
    setFormRef('')
    setFormRemarks('')
    setCustomerSearch('')
    setFormUnitPrice('')
    setFormDiscount('')
    setIsGstEnabled(false)
    setFormPaymentMethod('Credit')
    setFormBankAccountId('')
    setFormCashBookId('')
    setFormOriginalInvoice('')
    setFormReturnReason('')
    setFormReturnCondition('Good')
    setFormRefundMethod('Credit Note')
    setFormWarehouse('Main Warehouse')
    setFormDamageType('Broken')
    setFormApprovedBy('')
    setFormDepartment('')
    setFormPurpose('')
    setFormMarketingCampaign('')
    setFormSalesPerson('')
    setFormAdjustmentReason('Correction')
    setFormAdjustmentMode('Increase')
  }

  const handleOpenCreate = () => {
    if (!canWrite) {
      showToast('You do not have write permissions.', 'warning')
      return
    }
    resetForm()
    setIsCreateOpen(true)
  }

  const handleOpenView = (txn: SalesTransaction) => {
    setSelectedTxn(txn)
    setIsViewingDetails(true)
  }

  const handleOpenEdit = (txn: SalesTransaction) => {
    if (!canWrite) {
      showToast('You do not have write permissions.', 'warning')
      return
    }
    setSelectedTxn(txn)
    setFormType(txn.transactionType)
    setFormProductId(txn.productId)
    setFormCustomerId(txn.customerId)
    setFormCases(Math.abs(txn.cases).toString())
    setFormDate(txn.transactionDate.substring(0, 10))
    setFormRef(txn.referenceNumber || '')
    setFormRemarks(txn.remarks || '')

    const matchedCustomer = customers.find(c => c.id === txn.customerId)
    setCustomerSearch(matchedCustomer ? matchedCustomer.customerName : '')

    // ERP specific state restorations
    setFormUnitPrice(txn.unitPrice?.toString() || '')
    setFormDiscount(txn.discountAmount?.toString() || '')
    setIsGstEnabled((txn.taxAmount || 0) > 0)
    setFormPaymentMethod(txn.paymentMethod || 'Credit')
    setFormBankAccountId(txn.bankAccountId || '')
    setFormCashBookId(txn.cashBookId || '')

    try {
      const meta = txn.metadataJson ? JSON.parse(txn.metadataJson) : {}
      setFormOriginalInvoice(meta.originalInvoice || '')
      setFormReturnReason(meta.returnReason || '')
      setFormReturnCondition(meta.returnCondition || 'Good')
      setFormRefundMethod(meta.refundMethod || 'Credit Note')
      setFormWarehouse(meta.warehouse || 'Main Warehouse')
      setFormDamageType(meta.damageType || 'Broken')
      setFormApprovedBy(meta.approvedBy || '')
      setFormDepartment(meta.department || '')
      setFormPurpose(meta.purpose || '')
      setFormMarketingCampaign(meta.marketingCampaign || '')
      setFormSalesPerson(meta.salesPerson || '')
      setFormAdjustmentReason(meta.adjustmentReason || 'Correction')
      setFormAdjustmentMode(txn.cases >= 0 ? 'Increase' : 'Decrease')
    } catch {
      // safe fallback
    }

    setIsEditOpen(true)
  }

  const handleOpenDelete = (txn: SalesTransaction) => {
    if (!canWrite) {
      showToast('You do not have write permissions.', 'warning')
      return
    }
    setSelectedTxn(txn)
    setIsDeleteOpen(true)
  }

  const validateForm = (): boolean => {
    const isCustomerRequired = ['Sales Dispatch', 'Customer Return', 'Free Sample'].includes(formType)
    if (isCustomerRequired && !formCustomerId) {
      showToast('Please select a customer for this transaction.', 'warning')
      return false
    }

    if (formType === 'Sales Dispatch' && formPaymentMethod === 'Credit' && !formCustomerId) {
      showToast('Select a customer for credit sales.', 'warning')
      return false
    }

    if (!formProductId || !formCases || !formDate) {
      showToast('Please fill in all required fields.', 'warning')
      return false
    }

    const casesNum = parseFloat(formCases)
    if (isNaN(casesNum) || casesNum <= 0) {
      showToast('Quantity must be greater than zero.', 'warning')
      return false
    }

    // Ensure payment register / bank account is set
    if (formType === 'Sales Dispatch') {
      if (['Bank', 'UPI', 'Cheque'].includes(formPaymentMethod) && !formBankAccountId) {
        if (banks.length > 0) {
          setFormBankAccountId(banks[0].id)
        } else {
          showToast('Company Bank Account is required.', 'warning')
          return false
        }
      }
      if (formPaymentMethod === 'Cash' && !formCashBookId) {
        if (cashRegisters.length > 0) {
          setFormCashBookId(cashRegisters[0].id)
        }
      }
    }

    // Verify stock availability
    if (formType === 'Sales Dispatch' || formType === 'Damage' || formType === 'Damaged Goods' || formType === 'Internal Consumption' || formType === 'Free Sample' || (formType === 'Stock Adjustment' && formAdjustmentMode === 'Decrease')) {
      const prod = products.find(p => p.id === formProductId)
      if (prod) {
        let maxAvailable = prod.currentStock
        if (isEditOpen && selectedTxn && selectedTxn.productId === formProductId) {
          maxAvailable += Math.abs(selectedTxn.cases)
        }
        if (casesNum > maxAvailable) {
          showToast(`Insufficient stock. Max available: ${maxAvailable} Cases.`, 'error')
          return false
        }
      }
    }

    return true
  }

  const buildRequestPayload = (): CreateSalesTransactionRequest => {
    const casesVal = parseFloat(formCases)
    const finalCases = (formType === 'Stock Adjustment' && formAdjustmentMode === 'Decrease') ? -casesVal : casesVal

    const up = parseFloat(formUnitPrice) || 0
    const disc = parseFloat(formDiscount) || 0
    const sub = finalCases * up - disc

    let cgst = 0, sgst = 0
    if (isGstEnabled) {
      cgst = sub * 0.09
      sgst = sub * 0.09
    }
    const tax = cgst + sgst

    const meta = {
      originalInvoice: formOriginalInvoice,
      returnReason: formReturnReason,
      returnCondition: formReturnCondition,
      refundMethod: formRefundMethod,
      warehouse: formWarehouse,
      damageType: formDamageType,
      approvedBy: formApprovedBy,
      department: formDepartment,
      purpose: formPurpose,
      marketingCampaign: formMarketingCampaign,
      salesPerson: formSalesPerson,
      adjustmentReason: formAdjustmentReason
    }

    return {
      customerId: formCustomerId || '00000000-0000-0000-0000-000000000000',
      productId: formProductId,
      cases: finalCases,
      transactionType: formType,
      transactionDate: formDate,
      referenceNumber: formRef ? formRef.trim() : undefined,
      remarks: formRemarks ? formRemarks.trim() : undefined,
      paymentMethod: formPaymentMethod,
      bankAccountId: formBankAccountId || undefined,
      cashBookId: formCashBookId || undefined,
      unitPrice: up,
      discountAmount: disc,
      taxAmount: tax,
      cgst: cgst,
      sgst: sgst,
      igst: 0,
      metadataJson: JSON.stringify(meta),
      totalAmount: sub + tax,
      amountReceived: formPaymentMethod === 'Credit' ? 0 : (sub + tax),
      returnedAmount: formType === 'Customer Return' ? sub + tax : 0,
      refundAmount: (formType === 'Customer Return' && formRefundMethod !== 'Credit Note') ? sub + tax : 0,
      adjustmentAmount: (formType === 'Customer Return' && formRefundMethod === 'Credit Note') ? sub + tax : 0,
      returnType: formType === 'Customer Return' ? formRefundMethod : undefined
    }
  }

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    createMutation.mutate(buildRequestPayload())
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTxn) return
    if (!validateForm()) return
    updateMutation.mutate({ id: selectedTxn.id, data: buildRequestPayload() })
  }

  // Parse dynamic metadata for detail viewing
  const viewMeta = useMemo(() => {
    if (!selectedTxn || !selectedTxn.metadataJson) return {}
    try {
      return JSON.parse(selectedTxn.metadataJson)
    } catch {
      return {}
    }
  }, [selectedTxn])

  if (isViewingDetails && selectedTxn) {
    // Dynamic General Ledger View for the Sales Transaction details
    const total = selectedTxn.totalAmount || (Math.abs(selectedTxn.cases) * (selectedTxn.unitPrice || 0))
    const tax = selectedTxn.taxAmount || 0
    const sub = total - tax
    const cost = Math.abs(selectedTxn.cases) * (selectedProductInForm?.costPrice || 15)

    const resolvedDebit = selectedTxn.paymentMethod === 'Cash' ? 'Cash Account' : (selectedTxn.paymentMethod === 'BankAccount' ? 'Bank Account' : 'Accounts Receivable')

    return (
      <PageContainer>
        <div className="bg-slate-50 min-h-screen pb-12">
          {/* Details header */}
          <div className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsViewingDetails(false)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <ShoppingCart className="w-6 h-6 text-blue-600" />
                  {selectedTxn.transactionType} Register
                </h1>
                <span className="font-mono text-xs font-semibold text-slate-400 mt-1 block">
                  Document Reference: {selectedTxn.transactionNumber}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownloadPDF(selectedTxn)}
                className="h-[36px] px-4 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-blue-150/40"
              >
                <Printer className="w-3.5 h-3.5" />
                Print / Export Invoice PDF
              </button>
              {canWrite && (
                <button
                  onClick={() => {
                    setIsViewingDetails(false);
                    handleOpenEdit(selectedTxn);
                  }}
                  className="h-[36px] px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-bold rounded-lg transition-all cursor-pointer"
                >
                  Edit Document
                </button>
              )}
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-8 mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main content pane */}
            <div className="lg:col-span-2 space-y-6">

              {/* Product Sold Section */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-[14px] font-extrabold text-slate-800 mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-600" />
                  Purchased Finished Goods
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider h-[32px]">
                        <th className="py-2 px-3">Item Description</th>
                        <th className="py-2 px-3 text-right">Quantity</th>
                        <th className="py-2 px-3 text-right">Unit Price</th>
                        <th className="py-2 px-3 text-right">Discount</th>
                        <th className="py-2 px-3 text-right">Taxable Amt</th>
                        <th className="py-2 px-3 text-right">Total Amt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[13px] text-slate-700">
                      <tr className="h-[40px]">
                        <td className="py-3 px-3 font-semibold text-slate-800">
                          {selectedTxn.productName}
                          <span className="block text-[10px] text-slate-400 font-mono mt-0.5">{selectedTxn.productSku || 'NO_SKU_CODE'}</span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold">{Math.abs(selectedTxn.cases)} Cases</td>
                        <td className="py-3 px-3 text-right font-mono">₹{(selectedTxn.unitPrice || 0).toLocaleString()}</td>
                        <td className="py-3 px-3 text-right font-mono text-rose-500">₹{(selectedTxn.discountAmount || 0).toLocaleString()}</td>
                        <td className="py-3 px-3 text-right font-mono">₹{sub.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right font-mono font-black text-slate-850">₹{total.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Subsystem fields for categories */}
                {selectedTxn.transactionType === 'Customer Return' && (
                  <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-4 border-t border-slate-100 pt-4 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-0.5">Condition:</span>
                      <span className="font-bold text-slate-700">{viewMeta.returnCondition || 'Good'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Return Reason:</span>
                      <span className="font-bold text-slate-700">{viewMeta.returnReason || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Refund Settlement:</span>
                      <span className="font-bold text-slate-700">{viewMeta.refundMethod || 'Credit Note'}</span>
                    </div>
                  </div>
                )}

                {selectedTxn.transactionType === 'Damage' && (
                  <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-4 border-t border-slate-100 pt-4 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-0.5">Damage Reason:</span>
                      <span className="font-bold text-slate-700">{selectedTxn.damageReason || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Approved By:</span>
                      <span className="font-bold text-slate-700">{viewMeta.approvedBy || 'System Audit'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Warehouse Location:</span>
                      <span className="font-bold text-slate-700">{viewMeta.warehouse || 'Main Warehouse'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Accounting double-entry register impact */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-[14px] font-extrabold text-slate-800 mb-4 flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-emerald-600" />
                  Cryptographic Ledger Posting Impact
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider h-[32px]">
                        <th className="py-2 px-3">Account Ledger</th>
                        <th className="py-2 px-3 text-right">Debit (Dr)</th>
                        <th className="py-2 px-3 text-right">Credit (Cr)</th>
                        <th className="py-2 px-3">Transaction Narration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[13px] text-slate-700 font-mono">
                      {selectedTxn.transactionType === 'Sales Dispatch' && (
                        <>
                          <tr className="h-[38px]">
                            <td className="py-3 px-3 font-semibold text-slate-800">{resolvedDebit}</td>
                            <td className="py-3 px-3 text-right font-bold text-blue-600">₹{total.toLocaleString()}</td>
                            <td className="py-3 px-3 text-right text-slate-300">—</td>
                            <td className="py-3 px-3 text-slate-400 font-sans text-xs">Sales dispatch accounts receivable posting</td>
                          </tr>
                          <tr className="h-[38px]">
                            <td className="py-3 px-3 pl-8 text-slate-600 font-medium">Sales Revenue</td>
                            <td className="py-3 px-3 text-right text-slate-300">—</td>
                            <td className="py-3 px-3 text-right font-bold text-slate-800">₹{sub.toLocaleString()}</td>
                            <td className="py-3 px-3 text-slate-400 font-sans text-xs">Finished goods income recognition</td>
                          </tr>
                          {tax > 0 && (
                            <tr className="h-[38px]">
                              <td className="py-3 px-3 pl-8 text-slate-650">GST Output Liabilities</td>
                              <td className="py-3 px-3 text-right text-slate-300">—</td>
                              <td className="py-3 px-3 text-right font-bold text-slate-800">₹{tax.toLocaleString()}</td>
                              <td className="py-3 px-3 text-slate-400 font-sans text-xs">Postings for statutory GST liabilities</td>
                            </tr>
                          )}
                          <tr className="h-[38px]">
                            <td className="py-3 px-3 font-semibold text-slate-850">Cost of Goods Sold</td>
                            <td className="py-3 px-3 text-right font-bold text-slate-800">₹{cost.toLocaleString()}</td>
                            <td className="py-3 px-3 text-right text-slate-300">—</td>
                            <td className="py-3 px-3 text-slate-400 font-sans text-xs">Asset cost conversion expense</td>
                          </tr>
                          <tr className="h-[38px]">
                            <td className="py-3 px-3 pl-8 text-slate-600">Finished Goods Inventory</td>
                            <td className="py-3 px-3 text-right text-slate-300">—</td>
                            <td className="py-3 px-3 text-right font-bold text-rose-500">₹{cost.toLocaleString()}</td>
                            <td className="py-3 px-3 text-slate-400 font-sans text-xs">Stock reduction posting</td>
                          </tr>
                        </>
                      )}
                      {selectedTxn.transactionType === 'Customer Return' && (
                        <>
                          <tr className="h-[38px]">
                            <td className="py-3 px-3 font-semibold text-slate-850">Sales Return Note</td>
                            <td className="py-3 px-3 text-right font-bold text-blue-600">₹{total.toLocaleString()}</td>
                            <td className="py-3 px-3 text-right text-slate-300">—</td>
                            <td className="py-3 px-3 text-slate-400 font-sans text-xs">Contra-income returns registration</td>
                          </tr>
                          <tr className="h-[38px]">
                            <td className="py-3 px-3 pl-8 text-slate-600">{resolvedDebit}</td>
                            <td className="py-3 px-3 text-right text-slate-300">—</td>
                            <td className="py-3 px-3 text-right font-bold text-slate-800">₹{total.toLocaleString()}</td>
                            <td className="py-3 px-3 text-slate-400 font-sans text-xs">Customer return refund/credit settlement</td>
                          </tr>
                        </>
                      )}
                      {selectedTxn.transactionType === 'Damage' && (
                        <>
                          <tr className="h-[38px]">
                            <td className="py-3 px-3 font-semibold text-slate-850">Inventory Loss Expense</td>
                            <td className="py-3 px-3 text-right font-bold text-slate-800">₹{cost.toLocaleString()}</td>
                            <td className="py-3 px-3 text-right text-slate-300">—</td>
                            <td className="py-3 px-3 text-slate-400 font-sans text-xs">Unsellable damage loss allocation</td>
                          </tr>
                          <tr className="h-[38px]">
                            <td className="py-3 px-3 pl-8 text-slate-600">Finished Goods Inventory</td>
                            <td className="py-3 px-3 text-right text-slate-300">—</td>
                            <td className="py-3 px-3 text-right font-bold text-rose-500">₹{cost.toLocaleString()}</td>
                            <td className="py-3 px-3 text-slate-400 font-sans text-xs">Reduction of stock asset values</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Sidebar metadata card */}
            <div className="space-y-6">

              {/* Customer and payments summaries */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                  Business Connection Summary
                </h3>
                <div className="space-y-3.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-400">Customer name:</span>
                    <span className="font-bold text-slate-800">{selectedTxn.customerName || 'N/A (System Internal)'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-400">Customer Code:</span>
                    <span className="font-mono text-slate-800">{selectedTxn.customerCode || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-400">Payment Status:</span>
                    <span className={`px-2 py-0.5 rounded font-bold ${selectedTxn.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>{selectedTxn.paymentStatus || 'POSTED'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-400">Payment Mode:</span>
                    <span className="font-bold text-slate-700">{selectedTxn.paymentMethod || 'Credit'}</span>
                  </div>
                </div>
              </div>

              {/* Subsystem status indicators */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                  System Posting Registry
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-slate-650">
                    <span>1. Inventory Subsystem Impact:</span>
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Adjusted
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-650">
                    <span>2. Customer Ledger Impact:</span>
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Adjusted
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-650">
                    <span>3. General Ledger double-entry:</span>
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      JV Posted
                    </span>
                  </div>
                </div>
              </div>

              {/* System Audit Details */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                  Chronological Audit Log
                </h3>
                <div className="space-y-4 relative pl-4 border-l border-slate-100 text-xs">
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 bg-blue-600 rounded-full border border-white" />
                    <span className="text-slate-450 block text-[10px]">
                      {new Date(selectedTxn.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                    <span className="font-bold text-slate-700 mt-0.5 block">Document Initialized & Posted</span>
                    <span className="text-slate-400 block text-[11px] mt-0.5">Recorded by: {selectedTxn.createdByName}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        title="Sales"
        description="Log finished goods dispatches, returns, and damages with proper inventory adjustments."
        actions={
          canWrite ? (
            <button
              onClick={handleOpenCreate}
              className="h-[32px] px-3 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Transaction
            </button>
          ) : undefined
        }
      />

      {/* FILTERS */}
      <FilterBar>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search txn, customer, product..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 pr-4 w-full h-[32px] text-[12px] bg-white border border-[#E5E7EB] rounded-lg placeholder-slate-400 focus:outline-none focus:border-blue-400"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="h-[32px] px-3 text-[12px] font-semibold bg-white border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-blue-400 cursor-pointer text-slate-700"
        >
          <option value="">All Types</option>
          <option value="Sales Dispatch">Sales Dispatch</option>
          <option value="Customer Return">Customer Return</option>
          <option value="Damage">Damage</option>
        </select>
        <select
          value={productIdFilter}
          onChange={(e) => { setProductIdFilter(e.target.value); setPage(1); }}
          className="h-[32px] px-3 text-[12px] font-semibold bg-white border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-blue-400 cursor-pointer text-slate-700"
        >
          <option value="">All Products</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={customerIdFilter}
          onChange={(e) => { setCustomerIdFilter(e.target.value); setPage(1); }}
          className="h-[32px] px-3 text-[12px] font-semibold bg-white border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-blue-400 cursor-pointer text-slate-700"
        >
          <option value="">All Customers</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>{c.customerName}</option>
          ))}
        </select>
        <input
          type="date"
          value={startDateFilter}
          onChange={(e) => { setStartDateFilter(e.target.value); setPage(1); }}
          className="h-[32px] px-3 text-[12px] font-semibold bg-white border border-[#E5E7EB] rounded-lg focus:outline-none cursor-pointer text-slate-700"
        />
        <input
          type="date"
          value={endDateFilter}
          onChange={(e) => { setEndDateFilter(e.target.value); setPage(1); }}
          className="h-[32px] px-3 text-[12px] font-semibold bg-white border border-[#E5E7EB] rounded-lg focus:outline-none cursor-pointer text-slate-700"
        />
        <select
          value={sortOrder}
          onChange={(e) => { setSortOrder(e.target.value); setPage(1); }}
          className="h-[32px] px-3 text-[12px] font-semibold bg-white border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-blue-400 cursor-pointer text-slate-700"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="largest_qty">Largest Qty</option>
        </select>
        <button
          onClick={() => { setSearch(''); setProductIdFilter(''); setCustomerIdFilter(''); setTypeFilter(''); setStatusFilter(''); setStartDateFilter(''); setEndDateFilter(''); setSortOrder('newest'); setPage(1); }}
          className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors whitespace-nowrap"
        >
          Clear Filters
        </button>
      </FilterBar>

      {/* TABLE SECTION */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm">
        {isTxnsLoading ? (
          <div className="py-20 flex flex-col justify-center items-center gap-3">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <span className="text-xs font-semibold text-slate-400">Loading ledger logs...</span>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-20 flex flex-col justify-center items-center text-center">
            <FileSpreadsheet className="w-12 h-12 text-slate-300 stroke-[1.2] mb-3" />
            <h3 className="text-sm font-bold text-slate-700">No Sales Transactions</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">No transactions matched your search filters. Click 'Create Transaction' to log stock changes.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none h-[36px]">
                  <th className="py-2 px-4">Date</th>
                  {/* <th className="py-2 px-4">Transaction No</th> */}
                  <th className="py-2 px-4">Customer</th>
                  <th className="py-2 px-4">Product</th>
                  <th className="py-2 px-4">Type</th>
                  <th className="py-2 px-4 text-right">Cases</th>
                  <th className="py-2 px-4 text-center">Status</th>
                  <th className="py-2 px-4">Created By</th>
                  <th className="py-2 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] text-[13px] text-slate-700">
                {transactions.map((txn, i) => (
                  <tr key={txn.id} className={`h-[38px] transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFC]'} hover:bg-blue-50/30`}>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {new Date(txn.transactionDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </td>
                    {/* <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {txn.transactionNumber}
                    </td> */}
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {txn.customerName}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {txn.productName}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${txn.transactionType === 'Sales Dispatch'
                        ? 'bg-blue-50 text-blue-700 border border-blue-100'
                        : txn.transactionType === 'Customer Return'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}>
                        {txn.transactionType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-black tabular-nums text-slate-800">
                      {txn.cases.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <EnterpriseBadge variant="success">{txn.status}</EnterpriseBadge>
                    </td>
                    <td className="py-3 px-4 text-slate-650">
                      {txn.createdByName}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenView(txn)}
                          title="View Details"
                          className="p-1.5 text-slate-400 hover:text-blue-650 hover:bg-slate-100 rounded transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canWrite && (
                          <button
                            onClick={() => handleOpenEdit(txn)}
                            title="Edit Transaction"
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canWrite && (
                          <button
                            onClick={() => handleOpenDelete(txn)}
                            title="Delete/Reverse"
                            className="p-1.5 text-slate-400 hover:text-red-650 hover:bg-slate-100 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION CONTROLS */}
        {pagination && pagination.totalPages > 1 && (
          <div className="border-t border-slate-100 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Showing page <strong className="font-bold text-slate-700">{page}</strong> of <strong className="font-bold text-slate-700">{pagination.totalPages}</strong>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                Record ERP Sales transaction
              </h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-650">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Transaction Type */}
                <div className="flex flex-col">
                  <PremiumLabel label="Transaction Type *" />
                  <select
                    value={formType}
                    onChange={(e) => {
                      setFormType(e.target.value)
                      if (e.target.value === 'Stock Adjustment') {
                        setFormCases('')
                      }
                    }}
                    className="w-full h-[40px] px-3.5 border border-slate-200 text-[14px] bg-white rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Sales Dispatch">Sales Dispatch</option>
                    <option value="Customer Return">Customer Return</option>
                    <option value="Damage">Damaged Goods</option>
                    <option value="Internal Consumption">Internal Consumption</option>
                    <option value="Free Sample">Free Sample</option>
                    <option value="Stock Adjustment">Stock Adjustment</option>
                  </select>
                </div>

                {/* Transaction Date */}
                <div className="flex flex-col">
                  <PremiumLabel label="Transaction Date *" />
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full h-[40px] px-3.5 border border-slate-200 text-[14px] rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              {/* Product Selection */}
              <div className="flex flex-col">
                <PremiumLabel label="Product *" />
                <select
                  value={formProductId}
                  onChange={(e) => setFormProductId(e.target.value)}
                  className="w-full h-[40px] px-3.5 border border-slate-200 text-[14px] bg-white rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select Finished Product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} {p.sku ? `(SKU: ${p.sku})` : ''}</option>
                  ))}
                </select>

                {/* Current Stock indicators */}
                {selectedProductInForm && (
                  <div className="mt-2.5 bg-blue-50/50 border border-blue-100 rounded-lg px-3 py-2 text-[11px] flex justify-between">
                    <span className="font-semibold text-blue-800">Current Stock:</span>
                    <span className="font-bold text-blue-800">{selectedProductInForm.currentStock.toLocaleString()} Cases</span>
                  </div>
                )}
              </div>

              {/* CONDITIONAL FIELDSETS DEPENDING ON TRANSACTION TYPE */}

              {/* Sales Dispatch Conditional UI */}
              {formType === 'Sales Dispatch' && (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  {/* Customer search selection */}
                  <div className="flex flex-col relative">
                    <PremiumLabel label="Customer *" />
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="Search customer..."
                          value={customerSearch}
                          onChange={(e) => { setCustomerSearch(e.target.value); setIsCustomerDropdownOpen(true); }}
                          onFocus={() => setIsCustomerDropdownOpen(true)}
                          className="w-full h-[40px] px-3.5 border border-slate-200 text-[14px] rounded-lg focus:outline-none"
                        />
                        {isCustomerDropdownOpen && (
                          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                            {filteredCustomersForForm.map(c => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => { setFormCustomerId(c.id); setCustomerSearch(c.customerName); setIsCustomerDropdownOpen(false); }}
                                className="w-full text-left py-2 px-3 hover:bg-slate-50 text-xs text-slate-700"
                              >
                                {c.customerName} ({c.customerCode})
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={handleQuickCreateCustomer} className="px-3 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-bold">+ New Customer</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <EnterpriseNumberInput label="Cases Quantity *" value={formCases} onChange={(e) => setFormCases(e.target.value)} placeholder="0" allowDecimals={false} />
                    <div className="flex flex-col">
                      <PremiumLabel label="Unit Price (₹) *" />
                      <input type="number" value={formUnitPrice} onChange={(e) => setFormUnitPrice(e.target.value)} placeholder={selectedProductInForm?.sellingPrice?.toString() || '0.00'} className="w-full h-[40px] px-3 border border-slate-200 text-sm rounded-lg" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <PremiumLabel label="Discount (₹)" />
                      <input type="number" value={formDiscount} onChange={(e) => setFormDiscount(e.target.value)} placeholder="0.00" className="w-full h-[40px] px-3 border border-slate-200 text-sm rounded-lg" />
                    </div>
                    <div className="flex items-center gap-2 h-10 mt-6 pl-2">
                      <input type="checkbox" id="isGst" checked={isGstEnabled} onChange={(e) => setIsGstEnabled(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                      <label htmlFor="isGst" className="text-xs font-semibold text-slate-650 cursor-pointer">GST Applicable (Calculated 18%)</label>
                    </div>
                  </div>

                  {/* Payment Type Selection */}
                  <div className="border-t border-slate-100 pt-4 space-y-4">
                    <div className="flex flex-col">
                      <PremiumLabel label="Payment Method *" />
                      <div className="flex gap-3">
                        {['Cash', 'Bank', 'Credit', 'UPI', 'Cheque'].map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setFormPaymentMethod(m)}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${formPaymentMethod === m ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Credit Details & Limit Warning */}
                    {formPaymentMethod === 'Credit' && selectedCustomerInForm && (
                      <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl space-y-2 text-xs select-none">
                        <div className="flex justify-between items-center text-[#92400E] font-semibold">
                          <span>Customer Outstanding Balance:</span>
                          <span className="font-bold text-[#78350F]">₹{(selectedCustomerInForm.outstandingPlaceholder || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-600">
                          <span>Credit Limit:</span>
                          <span className="font-bold">₹{(selectedCustomerInForm.creditLimit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        {selectedCustomerInForm.creditLimit > 0 && (
                          <div className="flex justify-between items-center text-slate-600">
                            <span>Available Credit:</span>
                            <span className={`font-bold ${(selectedCustomerInForm.creditLimit - (selectedCustomerInForm.outstandingPlaceholder || 0)) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                              ₹{(selectedCustomerInForm.creditLimit - (selectedCustomerInForm.outstandingPlaceholder || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {selectedCustomerInForm.creditLimit > 0 &&
                          ((selectedCustomerInForm.outstandingPlaceholder || 0) + (parseFloat(formCases) || 0) * (parseFloat(formUnitPrice) || selectedProductInForm?.sellingPrice || 0)) > selectedCustomerInForm.creditLimit && (
                            <div className="flex items-center gap-1.5 text-red-700 bg-red-100/80 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold mt-1">
                              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                              <span>Warning: Total credit exposure exceeds customer credit limit!</span>
                            </div>
                          )}
                      </div>
                    )}

                    {/* Bank Account dropdown */}
                    {['Bank', 'UPI', 'Cheque'].includes(formPaymentMethod) && (
                      <div className="flex flex-col">
                        <PremiumLabel label="Company Bank Account *" />
                        <select value={formBankAccountId} onChange={(e) => setFormBankAccountId(e.target.value)} className="w-full h-[40px] border border-slate-200 rounded-lg text-sm bg-white">
                          <option value="">Select Account...</option>
                          {banks.map(b => (
                            <option key={b.id} value={b.id}>{b.bankName} — {b.accountNumber}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Cash Book dropdown */}
                    {formPaymentMethod === 'Cash' && (
                      <div className="flex flex-col">
                        <PremiumLabel label="Company Cash Book Register *" />
                        <select value={formCashBookId} onChange={(e) => setFormCashBookId(e.target.value)} className="w-full h-[40px] border border-slate-200 rounded-lg text-sm bg-white">
                          <option value="">Select Cash Register...</option>
                          {cashRegisters.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Customer Return Conditional UI */}
              {formType === 'Customer Return' && (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  {/* Customer search selection */}
                  <div className="flex flex-col relative">
                    <PremiumLabel label="Customer *" />
                    <input
                      type="text"
                      placeholder="Select return customer..."
                      value={customerSearch}
                      onChange={(e) => { setCustomerSearch(e.target.value); setIsCustomerDropdownOpen(true); }}
                      onFocus={() => setIsCustomerDropdownOpen(true)}
                      className="w-full h-[40px] px-3.5 border border-slate-200 text-[14px] rounded-lg focus:outline-none"
                    />
                    {isCustomerDropdownOpen && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {filteredCustomersForForm.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => { setFormCustomerId(c.id); setCustomerSearch(c.customerName); setIsCustomerDropdownOpen(false); }}
                            className="w-full text-left py-2 px-3 hover:bg-slate-50 text-xs text-slate-700"
                          >
                            {c.customerName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <PremiumLabel label="Original Reference Invoice" />
                      <input type="text" value={formOriginalInvoice} onChange={(e) => setFormOriginalInvoice(e.target.value)} placeholder="E.g., TXN-2026..." className="w-full h-[40px] px-3 border border-slate-200 text-sm rounded-lg" />
                    </div>
                    <div className="flex flex-col">
                      <PremiumLabel label="Return Condition" />
                      <select value={formReturnCondition} onChange={(e) => setFormReturnCondition(e.target.value)} className="w-full h-[40px] px-3 border border-slate-200 text-sm bg-white rounded-lg">
                        <option value="Good">Good (Restock Asset)</option>
                        <option value="Damaged">Damaged / Rejected</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <EnterpriseNumberInput label="Cases Returned *" value={formCases} onChange={(e) => setFormCases(e.target.value)} placeholder="0" allowDecimals={false} />
                    <div className="flex flex-col">
                      <PremiumLabel label="Refund Method *" />
                      <select value={formRefundMethod} onChange={(e) => setFormRefundMethod(e.target.value)} className="w-full h-[40px] px-3 border border-slate-200 text-sm bg-white rounded-lg">
                        <option value="Credit Note">Credit Note Note</option>
                        <option value="Cash">Cash Refund</option>
                        <option value="Bank">Bank Settlement</option>
                        <option value="Replacement">Direct Replacement</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <PremiumLabel label="Reason for Return" />
                    <input type="text" value={formReturnReason} onChange={(e) => setFormReturnReason(e.target.value)} placeholder="Incorrect goods, defective..." className="w-full h-[40px] px-3 border border-slate-200 text-sm rounded-lg" />
                  </div>
                </div>
              )}

              {/* Damaged Goods Conditional UI */}
              {formType === 'Damage' && (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <PremiumLabel label="Damage Reason *" />
                      <select value={formDamageType} onChange={(e) => setFormDamageType(e.target.value)} className="w-full h-[40px] px-3 border border-slate-200 text-sm bg-white rounded-lg">
                        <option value="Broken">Broken</option>
                        <option value="Leak">Leak</option>
                        <option value="Expired">Expired</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <PremiumLabel label="Warehouse Location" />
                      <input type="text" value={formWarehouse} onChange={(e) => setFormWarehouse(e.target.value)} className="w-full h-[40px] px-3 border border-slate-200 text-sm rounded-lg" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <EnterpriseNumberInput label="Quantity (Cases) *" value={formCases} onChange={(e) => setFormCases(e.target.value)} placeholder="0" allowDecimals={false} />
                    <div className="flex flex-col">
                      <PremiumLabel label="Authorized By" />
                      <input type="text" value={formApprovedBy} onChange={(e) => setFormApprovedBy(e.target.value)} placeholder="Manager initials..." className="w-full h-[40px] px-3 border border-slate-200 text-sm rounded-lg" />
                    </div>
                  </div>
                </div>
              )}

              {/* Internal Consumption Conditional UI */}
              {formType === 'Internal Consumption' && (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <PremiumLabel label="Department *" />
                      <input type="text" value={formDepartment} onChange={(e) => setFormDepartment(e.target.value)} placeholder="E.g., Office, Logistics..." className="w-full h-[40px] px-3 border border-slate-200 text-sm rounded-lg" />
                    </div>
                    <div className="flex flex-col">
                      <PremiumLabel label="Purpose / Reason" />
                      <input type="text" value={formPurpose} onChange={(e) => setFormPurpose(e.target.value)} placeholder="E.g., Event, QA Test..." className="w-full h-[40px] px-3 border border-slate-200 text-sm rounded-lg" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <EnterpriseNumberInput label="Quantity (Cases) *" value={formCases} onChange={(e) => setFormCases(e.target.value)} placeholder="0" allowDecimals={false} />
                    <div className="flex flex-col">
                      <PremiumLabel label="Approved By" />
                      <input type="text" value={formApprovedBy} onChange={(e) => setFormApprovedBy(e.target.value)} placeholder="Approved by..." className="w-full h-[40px] px-3 border border-slate-200 text-sm rounded-lg" />
                    </div>
                  </div>
                </div>
              )}

              {/* Free Sample Conditional UI */}
              {formType === 'Free Sample' && (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  {/* Customer search selection */}
                  <div className="flex flex-col relative">
                    <PremiumLabel label="Customer *" />
                    <input
                      type="text"
                      placeholder="Select customer target..."
                      value={customerSearch}
                      onChange={(e) => { setCustomerSearch(e.target.value); setIsCustomerDropdownOpen(true); }}
                      onFocus={() => setIsCustomerDropdownOpen(true)}
                      className="w-full h-[40px] px-3.5 border border-slate-200 text-[14px] rounded-lg focus:outline-none"
                    />
                    {isCustomerDropdownOpen && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {filteredCustomersForForm.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => { setFormCustomerId(c.id); setCustomerSearch(c.customerName); setIsCustomerDropdownOpen(false); }}
                            className="w-full text-left py-2 px-3 hover:bg-slate-50 text-xs text-slate-700"
                          >
                            {c.customerName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <PremiumLabel label="Marketing Campaign" />
                      <input type="text" value={formMarketingCampaign} onChange={(e) => setFormMarketingCampaign(e.target.value)} placeholder="Summer promotion..." className="w-full h-[40px] px-3 border border-slate-200 text-sm rounded-lg" />
                    </div>
                    <div className="flex flex-col">
                      <PremiumLabel label="Sales Executive" />
                      <input type="text" value={formSalesPerson} onChange={(e) => setFormSalesPerson(e.target.value)} placeholder="Representative name..." className="w-full h-[40px] px-3 border border-slate-200 text-sm rounded-lg" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1">
                    <EnterpriseNumberInput label="Quantity (Cases) *" value={formCases} onChange={(e) => setFormCases(e.target.value)} placeholder="0" allowDecimals={false} />
                  </div>
                </div>
              )}

              {/* Stock Adjustment Conditional UI */}
              {formType === 'Stock Adjustment' && (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <PremiumLabel label="Adjustment Type *" />
                      <select value={formAdjustmentMode} onChange={(e) => setFormAdjustmentMode(e.target.value)} className="w-full h-[40px] px-3 border border-slate-200 text-sm bg-white rounded-lg">
                        <option value="Increase">Increase Stock (+)</option>
                        <option value="Decrease">Decrease Stock (-)</option>
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <PremiumLabel label="Adjustment Reason" />
                      <select value={formAdjustmentReason} onChange={(e) => setFormAdjustmentReason(e.target.value)} className="w-full h-[40px] px-3 border border-slate-200 text-sm bg-white rounded-lg">
                        <option value="Correction">Physical Audit Correction</option>
                        <option value="Reconciliation">Reconciliation Offset</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1">
                    <EnterpriseNumberInput label="Adjustment Quantity (Cases) *" value={formCases} onChange={(e) => setFormCases(e.target.value)} placeholder="0" allowDecimals={false} />
                  </div>
                </div>
              )}

              {/* General Reference & Remarks fields for non-sales types */}
              {formType !== 'Sales Dispatch' && formType !== 'Customer Return' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                  <div className="flex flex-col">
                    <PremiumLabel label="Reference Number" />
                    <input type="text" value={formRef} onChange={(e) => setFormRef(e.target.value)} className="w-full h-[40px] px-3 border border-slate-200 text-sm rounded-lg" />
                  </div>
                  <div className="flex flex-col">
                    <PremiumLabel label="Remarks" />
                    <input type="text" value={formRemarks} onChange={(e) => setFormRemarks(e.target.value)} className="w-full h-[40px] px-3 border border-slate-200 text-sm rounded-lg" />
                  </div>
                </div>
              )}

              {/* LIVE GENERAL LEDGER ACCOUNTING IMPACT PREVIEW */}
              {accountingImpactPreview.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                    Live Accounting Double-Entry Preview
                  </span>
                  <div className="divide-y divide-slate-100 text-[12px] font-mono">
                    {accountingImpactPreview.map((item, i) => (
                      <div key={i} className="flex justify-between py-1.5">
                        <span className={item.type === 'Credit' ? 'pl-6 text-slate-500' : 'font-semibold text-slate-800'}>
                          {item.type === 'Credit' ? 'To ' : ''}{item.account}
                        </span>
                        <span className={`font-bold ${item.type === 'Credit' ? 'text-slate-500' : 'text-blue-650'}`}>
                          ({item.type === 'Credit' ? 'Cr' : 'Dr'}) ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <EnterpriseButton
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 bg-blue-650 hover:bg-blue-750 text-white rounded-lg h-11 text-sm font-semibold transition-all shadow-md shadow-blue-200/50 flex items-center justify-center gap-2"
                >
                  {createMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving Transaction...
                    </>
                  ) : (
                    'Record Transaction'
                  )}
                </EnterpriseButton>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="w-[100px] h-11 border border-slate-200 text-slate-500 font-semibold text-sm rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditOpen && selectedTxn && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-amber-500" />
                Edit Transaction: {selectedTxn.transactionNumber}
              </h2>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-slate-650">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-250 rounded-lg p-3.5 text-xs text-amber-800 flex items-start gap-2.5 leading-relaxed">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Important Stock Reversal Alert:</span>
                  <p className="mt-0.5">
                    Modifying this transaction will automatically reverse the original stock movement of <strong>{selectedTxn.cases} Cases</strong> before applying the new quantity. This prevents stock duplication or inconsistencies.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <PremiumLabel label="Transaction Type *" />
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full h-[40px] px-3.5 border border-slate-200 text-[14px] bg-white rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Sales Dispatch">Sales Dispatch</option>
                    <option value="Customer Return">Customer Return</option>
                    <option value="Damage">Damaged Goods</option>
                    <option value="Internal Consumption">Internal Consumption</option>
                    <option value="Free Sample">Free Sample</option>
                    <option value="Stock Adjustment">Stock Adjustment</option>
                  </select>
                </div>

                <div className="flex flex-col">
                  <PremiumLabel label="Transaction Date *" />
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full h-[40px] px-3.5 border border-slate-200 text-[14px] rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              {/* Product Selection */}
              <div className="flex flex-col">
                <PremiumLabel label="Product *" />
                <select
                  value={formProductId}
                  onChange={(e) => setFormProductId(e.target.value)}
                  className="w-full h-[40px] px-3.5 border border-slate-200 text-[14px] bg-white rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select Finished Product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} {p.sku ? `(SKU: ${p.sku})` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Conditional sections mapped identically to create form */}
              {formType === 'Sales Dispatch' && (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  <div className="flex flex-col">
                    <PremiumLabel label="Customer *" />
                    <select value={formCustomerId} onChange={(e) => setFormCustomerId(e.target.value)} className="w-full h-[40px] border border-slate-200 text-sm bg-white rounded-lg">
                      <option value="">Select Customer...</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.customerName}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <EnterpriseNumberInput label="Cases Quantity *" value={formCases} onChange={(e) => setFormCases(e.target.value)} placeholder="0" allowDecimals={false} />
                    <div className="flex flex-col">
                      <PremiumLabel label="Unit Price (₹) *" />
                      <input type="number" value={formUnitPrice} onChange={(e) => setFormUnitPrice(e.target.value)} placeholder="0.00" className="w-full h-[40px] px-3 border border-slate-200 text-sm rounded-lg" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <PremiumLabel label="Discount (₹)" />
                      <input type="number" value={formDiscount} onChange={(e) => setFormDiscount(e.target.value)} placeholder="0.00" className="w-full h-[40px] px-3 border border-slate-200 text-sm rounded-lg" />
                    </div>
                    <div className="flex items-center gap-2 h-10 mt-6 pl-2">
                      <input type="checkbox" id="isGstEdit" checked={isGstEnabled} onChange={(e) => setIsGstEnabled(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                      <label htmlFor="isGstEdit" className="text-xs font-semibold text-slate-650 cursor-pointer">GST Applicable (18%)</label>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4 space-y-4">
                    <div className="flex flex-col">
                      <PremiumLabel label="Payment Method *" />
                      <div className="flex gap-3">
                        {['Cash', 'Bank', 'Credit', 'UPI', 'Cheque'].map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setFormPaymentMethod(m)}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${formPaymentMethod === m ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 text-slate-600 border-slate-200'
                              }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {formType !== 'Sales Dispatch' && (
                <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4">
                  <EnterpriseNumberInput label="Cases Quantity *" value={formCases} onChange={(e) => setFormCases(e.target.value)} placeholder="0" allowDecimals={false} />
                </div>
              )}

              {/* Accounting preview for edits */}
              {accountingImpactPreview.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Live Accounting Impact Preview</span>
                  <div className="divide-y divide-slate-100 text-[12px] font-mono">
                    {accountingImpactPreview.map((item, i) => (
                      <div key={i} className="flex justify-between py-1.5">
                        <span className={item.type === 'Credit' ? 'pl-6 text-slate-500' : 'font-semibold text-slate-800'}>{item.account}</span>
                        <span className="font-bold">({item.type === 'Credit' ? 'Cr' : 'Dr'}) ₹{item.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <EnterpriseButton
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex-1 bg-amber-650 hover:bg-amber-700 text-white rounded-lg h-11 text-sm font-semibold transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {updateMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Updating Transaction...
                    </>
                  ) : (
                    'Update Transaction'
                  )}
                </EnterpriseButton>
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="w-[100px] h-11 border border-slate-200 text-slate-500 font-semibold text-sm rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {isDeleteOpen && selectedTxn && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex justify-center items-center p-4">
          <div className="bg-white border border-slate-100 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center gap-3.5 text-rose-600">
              <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-850 leading-tight">Reverse Stock & Delete?</h3>
                <p className="text-xs text-slate-450 mt-1 leading-normal">
                  This transaction will be soft-deleted. The inventory effect will be automatically reversed.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 space-y-3 text-xs text-slate-650">
              <div className="flex justify-between border-b border-slate-150/40 pb-2">
                <span className="font-semibold text-slate-400">Transaction ID:</span>
                <span className="font-mono font-bold text-slate-800">{selectedTxn.transactionNumber}</span>
              </div>
              <div className="flex justify-between border-b border-slate-150/40 pb-2">
                <span className="font-semibold text-slate-400">Product:</span>
                <span className="font-bold text-slate-800">{selectedTxn.productName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-150/40 pb-2">
                <span className="font-semibold text-slate-400">Customer:</span>
                <span className="font-bold text-slate-800">{selectedTxn.customerName}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="font-bold text-slate-650 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Inventory Restored:
                </span>
                <span className="font-black font-mono text-emerald-600 bg-emerald-50 border border-emerald-100/50 px-2 py-0.5 rounded-lg text-xs">
                  {selectedTxn.transactionType === 'Customer Return' ? '-' : '+'}{selectedTxn.cases} Cases
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => deleteMutation.mutate(selectedTxn.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white rounded-xl h-11 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-200/50 active:scale-[0.98] cursor-pointer"
              >
                {deleteMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing Reversal...
                  </>
                ) : (
                  'Confirm & Reverse'
                )}
              </button>
              <button
                onClick={() => setIsDeleteOpen(false)}
                className="w-[100px] h-11 border border-slate-200 text-slate-500 font-bold text-xs rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
