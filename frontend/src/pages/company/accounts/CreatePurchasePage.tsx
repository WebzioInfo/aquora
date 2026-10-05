import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ShoppingBag,
  Plus,
  Trash2,
  Save,
  Building2,
  Calculator,
  Calendar,
  CreditCard,
  Layers,
  FileText,
  CheckCircle2,
  RefreshCw,
  Info,
  Tag
} from 'lucide-react'
import {
  purchaseService,
  type CreatePurchaseRequest,
  type PurchaseItem,
  type PurchaseCategory,
  type CreatePurchaseCategoryRequest
} from '../../../services/purchases'
import { vendorService, type VendorDropdownItem, type CreateVendorRequest } from '../../../services/vendors'
import { rawMaterialsService, type RawMaterial } from '../../../services/rawMaterials'
import { simpleAccountsService } from '../../../services/simpleAccounts'
import { api } from '../../../services/api'

const DEFAULT_CATEGORIES: { code: string; name: string; treatment: string }[] = [
  { code: 'RawMaterial', name: 'Raw Material (Inventory Stock IN)', treatment: 'Inventory' },
  { code: 'Machine', name: 'Machine / Equipment (Capital Asset Auto-Create)', treatment: 'Asset' },
  { code: 'OfficeAsset', name: 'Office Asset (Asset Auto-Create)', treatment: 'Asset' },
  { code: 'OfficeExpense', name: 'Office Expense', treatment: 'Expense' },
  { code: 'Service', name: 'Service / Consulting', treatment: 'Expense' },
  { code: 'Maintenance', name: 'Maintenance & Repair', treatment: 'Expense' },
  { code: 'Utility', name: 'Utility Bills', treatment: 'Expense' },
  { code: 'Vehicle', name: 'Vehicle & Fuel Expense', treatment: 'Expense' },
  { code: 'Software', name: 'Software & Subscriptions', treatment: 'Expense' },
  { code: 'Other', name: 'Other Category', treatment: 'Expense' }
]
import { useNotificationStore } from '../../../store/useNotificationStore'
import EnterpriseHeader from '../../../components/ui/EnterpriseHeader'
import EnterpriseCard from '../../../components/ui/EnterpriseCard'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import EnterpriseBadge from '../../../components/ui/EnterpriseBadge'
import EnterpriseModal from '../../../components/ui/EnterpriseModal'
import EnterpriseNumberInput from '../../../components/ui/EnterpriseNumberInput'

interface BankAccountOption {
  id: string
  accountName: string
  bankName: string
}

interface CashBookOption {
  id: string
  name: string
}

import { useParams, useLocation } from 'react-router-dom'

export const CreatePurchasePage: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const location = useLocation()
  const isEditMode = Boolean(id)
  const { showToast } = useNotificationStore()
  const [submitting, setSubmitting] = useState<boolean>(false)

  // Master Data
  const [vendors, setVendors] = useState<VendorDropdownItem[]>([])
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([])
  const [cashBooks, setCashBooks] = useState<CashBookOption[]>([])

  // Inline Vendor Modal
  const [showVendorModal, setShowVendorModal] = useState<boolean>(false)
  const [newVendorData, setNewVendorData] = useState<CreateVendorRequest>({ name: '', phone: '', email: '', gst: '', address: '' })

  // Category Architecture & Custom Categories State
  const [categoriesList, setCategoriesList] = useState<{ code: string; name: string; treatment: string }[]>(DEFAULT_CATEGORIES)
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false)
  const [creatingCategory, setCreatingCategory] = useState<boolean>(false)
  const [newCategoryData, setNewCategoryData] = useState<CreatePurchaseCategoryRequest>({
    name: '',
    treatment: 'Expense',
    description: ''
  })
  const [customAssetData, setCustomAssetData] = useState({
    assetName: '',
    category: 'Equipment',
    serialNumber: '',
    location: 'Main Facility',
    cost: 0 as number | string
  })

  // Core Form Fields
  const [taxMode, setTaxMode] = useState<'GST' | 'NonGST'>('GST')
  const [purchaseCategory, setPurchaseCategory] = useState<string>('RawMaterial')
  const [purchaseDate, setPurchaseDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [vendorId, setVendorId] = useState<string>('')
  const [vendorName, setVendorName] = useState<string>('')
  const [invoiceNumber, setInvoiceNumber] = useState<string>('')
  const [referenceNumber, setReferenceNumber] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  // Financial Summary Inputs (Clearable: number or empty string)
  const [taxAmountInput, setTaxAmountInput] = useState<number | string>(0)
  const [discountAmountInput, setDiscountAmountInput] = useState<number | string>(0)
  const [freightChargesInput, setFreightChargesInput] = useState<number | string>(0)
  const [amountPaidInput, setAmountPaidInput] = useState<number | string>(0)

  // Payment Details
  const [paymentMethod, setPaymentMethod] = useState<string>('Credit')
  const [bankAccountId, setBankAccountId] = useState<string>('')
  const [cashBookId, setCashBookId] = useState<string>('')
  const [paymentReferenceNo, setPaymentReferenceNo] = useState<string>('')

  // Category 1: Raw Material Grid
  const [items, setItems] = useState<any[]>([
    { rawMaterialId: '', itemName: '', description: '', quantity: 1, unit: 'Bags', unitPrice: 0, gstPercent: 18, discountAmount: 0, totalAmount: 0 }
  ])

  // Category 2-10 Metadata States
  const [machineData, setMachineData] = useState({ machineName: '', brand: '', model: '', serialNumber: '', purchaseCost: 0 as number | string, installationCost: 0 as number | string, warranty: '1 Year', location: 'Main Factory' })
  const [assetData, setAssetData] = useState({ assetName: '', category: 'Laptop', quantity: 1 as number | string, unitCost: 0 as number | string, department: 'IT', location: 'Head Office' })
  const [expenseData, setExpenseData] = useState({ expenseType: 'Stationery', amount: 0 as number | string, description: '' })
  const [serviceData, setServiceData] = useState({ serviceName: 'Consulting', duration: '1 Month', amount: 0 as number | string })
  const [maintenanceData, setMaintenanceData] = useState({ maintenanceType: 'Machine', targetAsset: '', cost: 0 as number | string, serviceDate: new Date().toISOString().slice(0, 10), nextDueDate: '' })
  const [utilityData, setUtilityData] = useState({ utilityType: 'Electricity', billNumber: '', billingMonth: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }), amount: 0 as number | string })
  const [vehicleData, setVehicleData] = useState({ vehicleNumber: '', expenseType: 'Fuel', cost: 0 as number | string })
  const [softwareData, setSoftwareData] = useState({ softwareName: '', subscription: 'Annual', licenseKey: '', cost: 0 as number | string })
  const [otherData, setOtherData] = useState({ description: '', cost: 0 as number | string })

  // Quick Purchase Category Creation Handler
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCategoryData.name.trim()) {
      showToast('Category name is required.', 'warning')
      return
    }

    setCreatingCategory(true)
    try {
      const created = await purchaseService.createPurchaseCategory({
        name: newCategoryData.name.trim(),
        treatment: newCategoryData.treatment,
        description: newCategoryData.description?.trim()
      })

      showToast(`Purchase category "${created.name}" created successfully.`, 'success')
      setShowCategoryModal(false)
      setNewCategoryData({ name: '', treatment: 'Expense', description: '' })

      const updated = await purchaseService.getPurchaseCategories()
      if (Array.isArray(updated) && updated.length > 0) {
        setCategoriesList(updated.map(c => ({
          code: c.code,
          name: c.name,
          treatment: c.treatment
        })))
      }
      setPurchaseCategory(created.code)
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || 'Failed to create purchase category.', 'error')
    } finally {
      setCreatingCategory(false)
    }
  }

  // Load Master Data & Existing Purchase / Draft
  useEffect(() => {
    purchaseService.getPurchaseCategories().then(cats => {
      if (Array.isArray(cats) && cats.length > 0) {
        setCategoriesList(cats.map(c => ({
          code: c.code,
          name: c.name,
          treatment: c.treatment
        })))
      }
    }).catch(() => {})

    vendorService.getVendorDropdown().then(v => setVendors(Array.isArray(v) ? v : [])).catch(() => setVendors([]))
    rawMaterialsService.getRawMaterials(1, 100).then(res => setRawMaterials(res.data?.items || [])).catch(() => setRawMaterials([]))
    simpleAccountsService.getBankAccountDropdown().then(b => setBankAccounts(Array.isArray(b) ? b : [])).catch(() => setBankAccounts([]))
    simpleAccountsService.getCashBookDropdown().then(c => setCashBooks(Array.isArray(c) ? c : [])).catch(() => setCashBooks([]))

    if (id) {
      purchaseService.getPurchaseById(id).then(p => {
        if (p) {
          setPurchaseCategory(p.purchaseCategory)
          setPurchaseDate(new Date(p.purchaseDate).toISOString().slice(0, 10))
          setVendorId(p.vendorId || '')
          setVendorName(p.vendorName)
          setInvoiceNumber(p.invoiceNumber || '')
          setReferenceNumber(p.referenceNumber || '')
          setNotes(p.notes || '')
          setTaxMode(p.taxAmount > 0 ? 'GST' : 'NonGST')
          setDiscountAmountInput(p.discountAmount)
          setFreightChargesInput(p.otherCharges)
          setTaxAmountInput(p.taxAmount)
          setAmountPaidInput(p.amountPaid)
          setPaymentMethod(p.paymentMethod)
          if (p.items && p.items.length > 0) {
            setItems(p.items.map(i => ({
              id: i.id,
              rawMaterialId: i.rawMaterialId || '',
              itemName: i.itemName,
              description: '',
              quantity: i.quantity,
              unit: i.unit,
              unitPrice: i.unitPrice,
              gstPercent: i.gstPercent,
              discountAmount: i.discountAmount,
              totalAmount: i.totalAmount
            })))
          }
        }
      }).catch(() => showToast('Failed to load purchase for editing', 'error'))
    } else if (location.state?.draftData) {
      const draft = location.state.draftData as CreatePurchaseRequest
      setPurchaseCategory(draft.purchaseCategory)
      setVendorId(draft.vendorId || '')
      setVendorName(draft.vendorName)
      setInvoiceNumber(draft.invoiceNumber || '')
      setReferenceNumber(draft.referenceNumber || '')
      setNotes(draft.notes || '')
      setDiscountAmountInput(draft.discountAmount)
      setFreightChargesInput(draft.otherCharges)
      setTaxAmountInput(draft.taxAmount)
      if (draft.items && draft.items.length > 0) {
        setItems(draft.items)
      }
    }
  }, [id, location.state])

  const handleVendorSelect = (vId: string) => {
    setVendorId(vId)
    const v = vendors.find((x) => x.id === vId)
    if (v) setVendorName(v.name)
  }

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newVendorData.name.trim()) return
    try {
      const created = await vendorService.createVendor(newVendorData)
      showToast('Vendor created inline', 'success')
      const updatedVendors = await vendorService.getVendorDropdown()
      setVendors(updatedVendors)
      setVendorId(created.id)
      setVendorName(created.name)
      setShowVendorModal(false)
    } catch (err: any) {
      showToast(err?.message || 'Failed to create vendor', 'error')
    }
  }

  // Helper for numeric safe parsing
  const parseVal = (val: number | string | undefined | null): number => {
    if (val === '' || val === null || val === undefined) return 0
    const num = typeof val === 'number' ? val : parseFloat(val)
    return isNaN(num) ? 0 : num
  }

  // Item Grid Management
  const updateItem = (index: number, field: string, val: any) => {
    const newItems = [...items]
    const current = { ...newItems[index], [field]: val }

    if (field === 'rawMaterialId') {
      const rm = rawMaterials.find((r) => r.id === val)
      if (rm) {
        current.itemName = rm.name
        current.unit = rm.unit || 'Bags'
        current.unitPrice = rm.costPerUnit || current.unitPrice
      }
    }

    // Live Row Calculation
    const qty = parseVal(current.quantity)
    const rate = parseVal(current.unitPrice)
    const gstRate = taxMode === 'GST' ? parseVal(current.gstPercent) : 0
    const disc = parseVal(current.discountAmount)

    const baseAmount = qty * rate
    const gstVal = (baseAmount * gstRate) / 100
    current.totalAmount = Math.max(0, baseAmount + gstVal - disc)

    newItems[index] = current
    setItems(newItems)
  }

  const addItemRow = () => {
    setItems([
      ...items,
      { rawMaterialId: '', itemName: '', description: '', quantity: 1, unit: 'Bags', unitPrice: 0, gstPercent: taxMode === 'GST' ? 18 : 0, discountAmount: 0, totalAmount: 0 }
    ])
  }

  const removeItemRow = (index: number) => {
    if (items.length <= 1) {
      setItems([{ rawMaterialId: '', itemName: '', description: '', quantity: 0, unit: 'Bags', unitPrice: 0, gstPercent: 0, discountAmount: 0, totalAmount: 0 }])
      return
    }
    setItems(items.filter((_, i) => i !== index))
  }

  const handleGridKeyDown = (e: React.KeyboardEvent, index: number, isLastColumn: boolean) => {
    if ((e.key === 'Enter' || e.key === 'Tab') && isLastColumn && index === items.length - 1) {
      e.preventDefault()
      addItemRow()
    }
  }

  const selectedCatObj = categoriesList.find(c => c.code === purchaseCategory || c.name === purchaseCategory)
  const currentTreatment = selectedCatObj?.treatment || (
    purchaseCategory === 'RawMaterial' ? 'Inventory' :
    (purchaseCategory === 'Machine' || purchaseCategory === 'OfficeAsset') ? 'Asset' : 'Expense'
  )

  // Live Calculation Engine
  const computeSubTotal = (): number => {
    if (currentTreatment === 'Inventory') {
      return items.reduce((sum, item) => sum + (parseVal(item.quantity) * parseVal(item.unitPrice)), 0)
    }
    if (purchaseCategory === 'Machine') {
      return parseVal(machineData.purchaseCost) + parseVal(machineData.installationCost)
    }
    if (purchaseCategory === 'OfficeAsset') {
      return parseVal(assetData.quantity) * parseVal(assetData.unitCost)
    }
    if (currentTreatment === 'Asset') {
      return parseVal(customAssetData.cost)
    }
    if (purchaseCategory === 'OfficeExpense') return parseVal(expenseData.amount)
    if (purchaseCategory === 'Service') return parseVal(serviceData.amount)
    if (purchaseCategory === 'Maintenance') return parseVal(maintenanceData.cost)
    if (purchaseCategory === 'Utility') return parseVal(utilityData.amount)
    if (purchaseCategory === 'Vehicle') return parseVal(vehicleData.cost)
    if (purchaseCategory === 'Software') return parseVal(softwareData.cost)
    return parseVal(otherData.cost)
  }

  const computeItemGSTTotal = (): number => {
    if (taxMode === 'NonGST' || currentTreatment !== 'Inventory') return 0
    return items.reduce((sum, item) => {
      const base = parseVal(item.quantity) * parseVal(item.unitPrice)
      const gstPercent = parseVal(item.gstPercent)
      return sum + ((base * gstPercent) / 100)
    }, 0)
  }

  const subTotal = computeSubTotal()
  const itemGstTotal = computeItemGSTTotal()
  const discountTotal = parseVal(discountAmountInput)
  const freightTotal = parseVal(freightChargesInput)
  const manualTaxTotal = parseVal(taxAmountInput)

  const computedGSTTotal = taxMode === 'GST' ? (currentTreatment === 'Inventory' ? itemGstTotal : manualTaxTotal) : 0
  const computedCGST = computedGSTTotal / 2
  const computedSGST = computedGSTTotal / 2

  const computedGrandTotal = Math.max(0, subTotal + computedGSTTotal + freightTotal - discountTotal)

  const computedAmountPaid = paymentMethod === 'Credit' ? 0 : parseVal(amountPaidInput)
  const computedBalance = Math.max(0, computedGrandTotal - computedAmountPaid)

  const getStatusBadge = () => {
    if (paymentMethod === 'Credit' || computedAmountPaid <= 0) {
      return <EnterpriseBadge variant="danger">Credit / Unpaid</EnterpriseBadge>
    }
    if (computedAmountPaid >= computedGrandTotal && computedGrandTotal > 0) {
      return <EnterpriseBadge variant="success">Paid</EnterpriseBadge>
    }
    return <EnterpriseBadge variant="warning">Partially Paid</EnterpriseBadge>
  }

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vendorName.trim()) {
      showToast('Please select a vendor before saving the purchase.', 'warning')
      return
    }

    if (!purchaseCategory.trim()) {
      showToast('Please choose a purchase category.', 'warning')
      return
    }

    if (currentTreatment === 'Inventory' && (items.length === 0 || !items.some(i => i.quantity > 0))) {
      showToast('Please add at least one purchase item for inventory purchases.', 'warning')
      return
    }

    if (computedGrandTotal <= 0) {
      showToast('Please enter a valid purchase amount.', 'warning')
      return
    }

    setSubmitting(true)
    try {
      let metadataObj: any = {}
      if (purchaseCategory === 'Machine') metadataObj = machineData
      else if (purchaseCategory === 'OfficeAsset') metadataObj = assetData
      else if (currentTreatment === 'Asset') metadataObj = customAssetData
      else if (purchaseCategory === 'OfficeExpense') metadataObj = expenseData
      else if (purchaseCategory === 'Service') metadataObj = serviceData
      else if (purchaseCategory === 'Maintenance') metadataObj = maintenanceData
      else if (purchaseCategory === 'Utility') metadataObj = utilityData
      else if (purchaseCategory === 'Vehicle') metadataObj = vehicleData
      else if (purchaseCategory === 'Software') metadataObj = softwareData
      else metadataObj = otherData

      metadataObj.taxMode = taxMode
      metadataObj.cgst = computedCGST
      metadataObj.sgst = computedSGST
      metadataObj.treatment = currentTreatment

      const request: CreatePurchaseRequest = {
        purchaseDate,
        vendorId: vendorId || undefined,
        vendorName,
        purchaseCategory,
        invoiceNumber,
        referenceNumber,
        paymentMethod,
        bankAccountId: paymentMethod === 'BankAccount' ? bankAccountId : undefined,
        cashBookId: paymentMethod === 'Cash' ? cashBookId : undefined,
        subTotal,
        taxAmount: computedGSTTotal,
        discountAmount: discountTotal,
        otherCharges: freightTotal,
        grandTotal: computedGrandTotal,
        amountPaid: computedAmountPaid,
        notes,
        categoryMetadataJson: JSON.stringify(metadataObj),
        items: currentTreatment === 'Inventory' ? items.map(i => ({
          id: i.id || undefined,
          rawMaterialId: i.rawMaterialId || undefined,
          itemName: i.itemName,
          quantity: parseVal(i.quantity),
          unit: i.unit,
          unitPrice: parseVal(i.unitPrice),
          gstPercent: taxMode === 'GST' ? parseVal(i.gstPercent) : 0,
          discountAmount: parseVal(i.discountAmount),
          totalAmount: parseVal(i.totalAmount)
        })) : []
      }

      if (isEditMode && id) {
        await purchaseService.updatePurchase(id, request)
        showToast('Purchase updated successfully.', 'success')
        navigate(`/company/accounts/purchases/${id}`)
      } else {
        const created = await purchaseService.createPurchase(request)
        showToast('Purchase created successfully.', 'success')
        navigate(`/company/accounts/purchases/${created.id}`)
      }
    } catch (err: any) {
      showToast(err?.message || 'Unable to update this purchase. Please refresh the page and try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <EnterpriseHeader
        title={isEditMode ? 'Edit Purchase' : 'Create Purchase'}
        description={isEditMode ? 'Update existing procurement record and financial details' : 'Record corporate purchases, raw material inventory stock, or capital equipment'}
        actions={
          <div className="flex items-center gap-2">
            <EnterpriseButton
              variant="secondary"
              size="sm"
              onClick={() => navigate('/company/accounts/purchases')}
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Purchases
            </EnterpriseButton>
            <EnterpriseButton
              variant="primary"
              size="sm"
              loading={submitting}
              onClick={handleSubmit}
            >
              <Save className="w-4 h-4 mr-1.5" /> Save Purchase
            </EnterpriseButton>
          </div>
        }
      />

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Details & Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Tax Mode & Header Details */}
          <EnterpriseCard title="Purchase Mode & Header Details">
            <div className="space-y-4">
              {/* Purchase Tax Type Radio Selector */}
              <div>
                <label className="block text-xs font-semibold text-[#344054] mb-2">
                  Purchase Tax Mode <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-6 bg-[#F8FAFC] p-3 rounded-[8px] border border-[#E5E9F2]">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="taxMode"
                      checked={taxMode === 'GST'}
                      onChange={() => setTaxMode('GST')}
                      className="w-4 h-4 text-[#1A56DB] focus:ring-[#1A56DB]"
                    />
                    GST Purchase (Includes CGST / SGST Breakdown)
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="taxMode"
                      checked={taxMode === 'NonGST'}
                      onChange={() => setTaxMode('NonGST')}
                      className="w-4 h-4 text-[#1A56DB] focus:ring-[#1A56DB]"
                    />
                    Non-GST Purchase (Excludes Tax Calculations)
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Category Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#344054]">
                      Purchase Category <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCategoryModal(true)}
                      className="text-xs text-[#1A56DB] hover:underline font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> New Category
                    </button>
                  </div>
                  <select
                    value={purchaseCategory}
                    onChange={(e) => setPurchaseCategory(e.target.value)}
                    className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB] font-bold text-slate-900"
                  >
                    {categoriesList.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Purchase Date */}
                <div>
                  <label className="block text-xs font-semibold text-[#344054] mb-1">
                    Purchase Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full h-[40px] px-3 text-sm bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                  />
                </div>

                {/* Vendor Selection */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#344054]">
                      Vendor / Supplier <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowVendorModal(true)}
                      className="text-xs text-[#1A56DB] hover:underline font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> New Vendor
                    </button>
                  </div>
                  {vendors.length > 0 ? (
                    <select
                      value={vendorId}
                      onChange={(e) => handleVendorSelect(e.target.value)}
                      className="w-full h-[40px] px-3 text-sm bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                    >
                      <option value="">-- Select Vendor --</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>{v.name} {v.gst ? `(${v.gst})` : ''}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      placeholder="Enter Vendor Name"
                      value={vendorName}
                      onChange={(e) => setVendorName(e.target.value)}
                      className="w-full h-[40px] px-3 text-sm bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                    />
                  )}
                </div>

                {/* Invoice Number */}
                <div>
                  <label className="block text-xs font-semibold text-[#344054] mb-1">Vendor Invoice Number</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-99821"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full h-[40px] px-3 text-sm bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB] font-mono"
                  />
                </div>
              </div>
            </div>
          </EnterpriseCard>

          {/* Card 2: Dynamic Category Information & Workflow */}
          <EnterpriseCard title={`Category Details: ${selectedCatObj?.name || purchaseCategory}`}>
            <div className="space-y-4">
              {/* Category Explanation Banner */}
              <div className="p-3.5 bg-blue-50/60 rounded-[8px] border border-blue-200/70 text-xs text-blue-950 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-[#1A56DB] shrink-0 mt-0.5" />
                <div>
                  {currentTreatment === 'Inventory' && (
                    <p><strong>Inventory Stock Purchase:</strong> Saving this purchase will automatically increase stock levels and log an <strong className="text-[#1A56DB]">InventoryMovement (Stock IN)</strong> record. Debit: Inventory Stock | Credit: Cash / Vendor Creditor.</p>
                  )}
                  {currentTreatment === 'Asset' && (
                    <p><strong>Capital Asset Purchase:</strong> Saving this purchase will automatically register a new <strong className="text-[#1A56DB]">Fixed Asset record</strong> with an active Asset History timeline. Debit: Capital Fixed Asset | Credit: Cash / Vendor Creditor.</p>
                  )}
                  {currentTreatment === 'Expense' && (
                    <p><strong>Operating Expense Purchase:</strong> Saving this transaction will log an operating expense record and post corresponding ledger entries. Debit: Operating Expense | Credit: Cash / Bank / Vendor.</p>
                  )}
                </div>
              </div>

              {/* DYNAMIC CASE 1: INVENTORY ITEMS GRID */}
              {currentTreatment === 'Inventory' && (
                <div className="space-y-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#F8FAFC] border-b border-[#E5E9F2] text-slate-600 font-bold uppercase tracking-wider">
                          <th className="p-2.5">Raw Material</th>
                          <th className="p-2.5">Description</th>
                          <th className="p-2.5 w-24">Qty</th>
                          <th className="p-2.5 w-20">Unit</th>
                          <th className="p-2.5 w-28">Rate (₹)</th>
                          {taxMode === 'GST' && <th className="p-2.5 w-20">GST %</th>}
                          <th className="p-2.5 w-24">Discount</th>
                          <th className="p-2.5 w-28 text-right">Row Total</th>
                          <th className="p-2.5 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E9F2]">
                        {items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2">
                              {rawMaterials.length > 0 ? (
                                <select
                                  value={item.rawMaterialId || ''}
                                  onChange={(e) => updateItem(idx, 'rawMaterialId', e.target.value)}
                                  className="w-full h-[36px] px-2 bg-white border border-[#D0D5DD] rounded-[6px] text-xs font-semibold"
                                >
                                  <option value="">Custom Item...</option>
                                  {rawMaterials.map((rm) => (
                                    <option key={rm.id} value={rm.id}>{rm.name} ({rm.unit})</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  placeholder="Material Name"
                                  value={item.itemName}
                                  onChange={(e) => updateItem(idx, 'itemName', e.target.value)}
                                  className="w-full h-[36px] px-2 bg-white border border-[#D0D5DD] rounded-[6px] text-xs"
                                />
                              )}
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                placeholder="Specs / Grade"
                                value={item.description}
                                onChange={(e) => updateItem(idx, 'description', e.target.value)}
                                className="w-full h-[36px] px-2 bg-white border border-[#D0D5DD] rounded-[6px] text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <EnterpriseNumberInput
                                value={item.quantity}
                                onValueChange={(val) => updateItem(idx, 'quantity', val)}
                                placeholder="0"
                                className="!h-[36px] text-xs text-right font-mono"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.unit}
                                onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                                className="w-full h-[36px] px-2 bg-white border border-[#D0D5DD] rounded-[6px] text-xs text-center"
                              />
                            </td>
                            <td className="p-2">
                              <EnterpriseNumberInput
                                value={item.unitPrice}
                                onValueChange={(val) => updateItem(idx, 'unitPrice', val)}
                                placeholder="0.00"
                                className="!h-[36px] text-xs text-right font-mono"
                              />
                            </td>
                            {taxMode === 'GST' && (
                              <td className="p-2">
                                <EnterpriseNumberInput
                                  value={item.gstPercent}
                                  onValueChange={(val) => updateItem(idx, 'gstPercent', val)}
                                  placeholder="18"
                                  className="!h-[36px] text-xs text-right font-mono"
                                />
                              </td>
                            )}
                            <td className="p-2">
                              <EnterpriseNumberInput
                                value={item.discountAmount}
                                onValueChange={(val) => updateItem(idx, 'discountAmount', val)}
                                onKeyDown={(e) => handleGridKeyDown(e, idx, true)}
                                placeholder="0.00"
                                className="!h-[36px] text-xs text-right font-mono"
                              />
                            </td>
                            <td className="p-2 text-right font-extrabold text-slate-900 font-mono">
                              ₹{item.totalAmount.toFixed(2)}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeItemRow(idx)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {items.length === 0 && (
                    <div className="p-6 text-center text-slate-400 text-xs italic">
                      No purchase items added. Click "Add Item" to begin.
                    </div>
                  )}

                  <EnterpriseButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addItemRow}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Line Item
                  </EnterpriseButton>
                </div>
              )}

              {/* DYNAMIC CASE 2: MACHINE */}
              {purchaseCategory === 'Machine' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#344054] mb-1">Machine Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 20L Semi Auto Blow Moulding Machine"
                      value={machineData.machineName}
                      onChange={(e) => setMachineData({ ...machineData, machineName: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#344054] mb-1">Brand / Manufacturer</label>
                    <input
                      type="text"
                      placeholder="e.g. ASB Plast"
                      value={machineData.brand}
                      onChange={(e) => setMachineData({ ...machineData, brand: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px]"
                    />
                  </div>
                  <EnterpriseNumberInput
                    label="Purchase Cost (₹)"
                    value={machineData.purchaseCost}
                    onValueChange={(val) => setMachineData({ ...machineData, purchaseCost: val })}
                  />
                  <EnterpriseNumberInput
                    label="Installation Cost (₹)"
                    value={machineData.installationCost}
                    onValueChange={(val) => setMachineData({ ...machineData, installationCost: val })}
                  />
                  <div>
                    <label className="block text-xs font-semibold text-[#344054] mb-1">Serial Number</label>
                    <input
                      type="text"
                      placeholder="SN-998231-X"
                      value={machineData.serialNumber}
                      onChange={(e) => setMachineData({ ...machineData, serialNumber: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#344054] mb-1">Location / Floor</label>
                    <input
                      type="text"
                      placeholder="Factory Line 1"
                      value={machineData.location}
                      onChange={(e) => setMachineData({ ...machineData, location: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px]"
                    />
                  </div>
                </div>
              )}

              {/* DYNAMIC CASE 3: OFFICE ASSET */}
              {purchaseCategory === 'OfficeAsset' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#344054] mb-1">Asset Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dell XPS 15 Laptop"
                      value={assetData.assetName}
                      onChange={(e) => setAssetData({ ...assetData, assetName: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px]"
                    />
                  </div>
                  <EnterpriseNumberInput
                    label="Quantity"
                    value={assetData.quantity}
                    onValueChange={(val) => setAssetData({ ...assetData, quantity: val })}
                  />
                  <EnterpriseNumberInput
                    label="Unit Cost (₹)"
                    value={assetData.unitCost}
                    onValueChange={(val) => setAssetData({ ...assetData, unitCost: val })}
                  />
                  <div>
                    <label className="block text-xs font-semibold text-[#344054] mb-1">Department</label>
                    <input
                      type="text"
                      placeholder="Accounts / IT"
                      value={assetData.department}
                      onChange={(e) => setAssetData({ ...assetData, department: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px]"
                    />
                  </div>
                </div>
              )}

              {/* DYNAMIC CASE 3B: CUSTOM ASSET */}
              {currentTreatment === 'Asset' && purchaseCategory !== 'Machine' && purchaseCategory !== 'OfficeAsset' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#344054] mb-1">Asset Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Industrial Water Chiller / Server Rack"
                      value={customAssetData.assetName}
                      onChange={(e) => setCustomAssetData({ ...customAssetData, assetName: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#344054] mb-1">Asset Type / Classification</label>
                    <input
                      type="text"
                      placeholder="e.g. Machinery, Electronics, Plant Equipment"
                      value={customAssetData.category}
                      onChange={(e) => setCustomAssetData({ ...customAssetData, category: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px]"
                    />
                  </div>
                  <EnterpriseNumberInput
                    label="Acquisition Cost (₹)"
                    value={customAssetData.cost}
                    onValueChange={(val) => setCustomAssetData({ ...customAssetData, cost: val })}
                  />
                  <div>
                    <label className="block text-xs font-semibold text-[#344054] mb-1">Serial / Identification Number</label>
                    <input
                      type="text"
                      placeholder="SN-123456"
                      value={customAssetData.serialNumber}
                      onChange={(e) => setCustomAssetData({ ...customAssetData, serialNumber: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-[#344054] mb-1">Location / Department</label>
                    <input
                      type="text"
                      placeholder="e.g. Main Production Floor / Admin Block"
                      value={customAssetData.location}
                      onChange={(e) => setCustomAssetData({ ...customAssetData, location: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px]"
                    />
                  </div>
                </div>
              )}

              {/* DYNAMIC CASE 4: EXPENSES & SERVICES */}
              {currentTreatment === 'Expense' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#344054] mb-1">Description / Particulars</label>
                    <input
                      type="text"
                      required
                      placeholder="Specify details or bill description"
                      value={
                        purchaseCategory === 'OfficeExpense' ? expenseData.description :
                        purchaseCategory === 'Service' ? serviceData.serviceName :
                        purchaseCategory === 'Maintenance' ? maintenanceData.targetAsset :
                        purchaseCategory === 'Utility' ? utilityData.utilityType :
                        purchaseCategory === 'Vehicle' ? vehicleData.vehicleNumber :
                        purchaseCategory === 'Software' ? softwareData.softwareName : otherData.description
                      }
                      onChange={(e) => {
                        const val = e.target.value
                        if (purchaseCategory === 'OfficeExpense') setExpenseData({ ...expenseData, description: val })
                        else if (purchaseCategory === 'Service') setServiceData({ ...serviceData, serviceName: val })
                        else if (purchaseCategory === 'Maintenance') setMaintenanceData({ ...maintenanceData, targetAsset: val })
                        else if (purchaseCategory === 'Utility') setUtilityData({ ...utilityData, utilityType: val })
                        else if (purchaseCategory === 'Vehicle') setVehicleData({ ...vehicleData, vehicleNumber: val })
                        else if (purchaseCategory === 'Software') setSoftwareData({ ...softwareData, softwareName: val })
                        else setOtherData({ ...otherData, description: val })
                      }}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px]"
                    />
                  </div>
                  <EnterpriseNumberInput
                    label="Amount (₹)"
                    value={
                      purchaseCategory === 'OfficeExpense' ? expenseData.amount :
                      purchaseCategory === 'Service' ? serviceData.amount :
                      purchaseCategory === 'Maintenance' ? maintenanceData.cost :
                      purchaseCategory === 'Utility' ? utilityData.amount :
                      purchaseCategory === 'Vehicle' ? vehicleData.cost :
                      purchaseCategory === 'Software' ? softwareData.cost : otherData.cost
                    }
                    onValueChange={(val) => {
                      if (purchaseCategory === 'OfficeExpense') setExpenseData({ ...expenseData, amount: val })
                      else if (purchaseCategory === 'Service') setServiceData({ ...serviceData, amount: val })
                      else if (purchaseCategory === 'Maintenance') setMaintenanceData({ ...maintenanceData, cost: val })
                      else if (purchaseCategory === 'Utility') setUtilityData({ ...utilityData, amount: val })
                      else if (purchaseCategory === 'Vehicle') setVehicleData({ ...vehicleData, cost: val })
                      else if (purchaseCategory === 'Software') setSoftwareData({ ...softwareData, cost: val })
                      else setOtherData({ ...otherData, cost: val })
                    }}
                  />
                </div>
              )}
            </div>
          </EnterpriseCard>

          {/* Notes */}
          <EnterpriseCard title="Additional Purchase Notes">
            <textarea
              rows={2}
              placeholder="Enter purchase agreement terms, delivery tracking, or remarks"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
            />
          </EnterpriseCard>
        </div>

        {/* Right Column: Financial Summary & Payment Card */}
        <div className="space-y-6">
          <EnterpriseCard title="Payment Summary & Settlement">
            <div className="space-y-4">
              {/* Summary Breakdown */}
              <div className="space-y-2 text-xs bg-[#F8FAFC] p-4 rounded-[8px] border border-[#E5E9F2]">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono font-bold text-slate-900">₹{subTotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center text-slate-600">
                  <span>Discount (₹):</span>
                  <div className="w-28">
                    <EnterpriseNumberInput
                      value={discountAmountInput}
                      onValueChange={(val) => setDiscountAmountInput(val)}
                      placeholder="0.00"
                      className="!h-[32px] text-right font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-slate-600">
                  <span>Freight / Freight Charges (₹):</span>
                  <div className="w-28">
                    <EnterpriseNumberInput
                      value={freightChargesInput}
                      onValueChange={(val) => setFreightChargesInput(val)}
                      placeholder="0.00"
                      className="!h-[32px] text-right font-mono text-xs"
                    />
                  </div>
                </div>

                {taxMode === 'GST' && (
                  <>
                    {purchaseCategory !== 'RawMaterial' && (
                      <div className="flex justify-between items-center text-slate-600">
                        <span>GST Amount (₹):</span>
                        <div className="w-28">
                          <EnterpriseNumberInput
                            value={taxAmountInput}
                            onValueChange={(val) => setTaxAmountInput(val)}
                            placeholder="0.00"
                            className="!h-[32px] text-right font-mono text-xs"
                          />
                        </div>
                      </div>
                    )}
                    <div className="pt-2 border-t border-[#E5E9F2] space-y-1 text-[11px] text-slate-500">
                      <div className="flex justify-between">
                        <span>CGST (Central Tax):</span>
                        <span className="font-mono">₹{computedCGST.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SGST (State Tax):</span>
                        <span className="font-mono">₹{computedSGST.toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex justify-between text-slate-900 font-extrabold text-sm border-t border-[#E5E9F2] pt-2.5">
                  <span>Grand Total:</span>
                  <span className="font-mono text-[#1A56DB]">₹{computedGrandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Details */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#344054] mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] font-bold text-slate-900"
                  >
                    <option value="Credit">Credit / Unpaid (Vendor Ledger)</option>
                    <option value="Cash">Cash</option>
                    <option value="BankAccount">Bank Transfer</option>
                    <option value="UPI">UPI</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                {paymentMethod === 'BankAccount' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#344054] mb-1">Select Bank Account</label>
                    <select
                      value={bankAccountId}
                      onChange={(e) => setBankAccountId(e.target.value)}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px]"
                    >
                      <option value="">-- Select Bank Account --</option>
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>{b.bankName} - {b.accountName}</option>
                      ))}
                    </select>
                  </div>
                )}

                {paymentMethod === 'Cash' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#344054] mb-1">Select Cash Book</label>
                    <select
                      value={cashBookId}
                      onChange={(e) => setCashBookId(e.target.value)}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px]"
                    >
                      <option value="">-- Select Cash Book --</option>
                      {cashBooks.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {paymentMethod !== 'Credit' && (
                  <>
                    <EnterpriseNumberInput
                      label="Amount Paid Now (₹)"
                      value={amountPaidInput}
                      onValueChange={(val) => setAmountPaidInput(val)}
                      placeholder="0.00"
                    />
                    <div>
                      <label className="block text-xs font-semibold text-[#344054] mb-1">Reference Number / UTR</label>
                      <input
                        type="text"
                        placeholder="e.g. UTR-8827391"
                        value={paymentReferenceNo}
                        onChange={(e) => setPaymentReferenceNo(e.target.value)}
                        className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] font-mono"
                      />
                    </div>
                  </>
                )}

                {/* Remaining Balance & Status */}
                <div className="p-3 bg-slate-50 rounded-[8px] border border-[#E5E9F2] space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-700">Payment Status:</span>
                    {getStatusBadge()}
                  </div>
                  <div className="flex justify-between items-center text-xs font-extrabold text-slate-900 border-t border-[#E5E9F2] pt-2">
                    <span>Remaining Balance:</span>
                    <span className="font-mono text-red-600">₹{computedBalance.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Submit Action Button */}
              <EnterpriseButton
                type="submit"
                variant="primary"
                loading={submitting}
                className="w-full"
              >
                Save Purchase Record
              </EnterpriseButton>
            </div>
          </EnterpriseCard>
        </div>
      </form>

      {/* Inline Create Vendor Modal */}
      {showVendorModal && (
        <EnterpriseModal
          isOpen={showVendorModal}
          onClose={() => setShowVendorModal(false)}
          title="Quick Create Vendor"
        >
          <form onSubmit={handleCreateVendor} className="space-y-3">
            <input
              type="text"
              required
              placeholder="Vendor Name *"
              value={newVendorData.name}
              onChange={(e) => setNewVendorData({ ...newVendorData, name: e.target.value })}
              className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px]"
            />
            <input
              type="text"
              placeholder="GST Number"
              value={newVendorData.gst}
              onChange={(e) => setNewVendorData({ ...newVendorData, gst: e.target.value })}
              className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] uppercase font-mono"
            />
            <input
              type="text"
              placeholder="Phone Number"
              value={newVendorData.phone}
              onChange={(e) => setNewVendorData({ ...newVendorData, phone: e.target.value })}
              className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <EnterpriseButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowVendorModal(false)}
              >
                Cancel
              </EnterpriseButton>
              <EnterpriseButton
                type="submit"
                variant="primary"
                size="sm"
              >
                Save Vendor
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
      )}

      {/* Quick Create Purchase Category Modal */}
      {showCategoryModal && (
        <EnterpriseModal
          isOpen={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          title="Create Purchase Category"
        >
          <form onSubmit={handleCreateCategory} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#344054] mb-1">
                Category Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Factory Cleaning, Laboratory Supplies"
                value={newCategoryData.name}
                onChange={(e) => setNewCategoryData({ ...newCategoryData, name: e.target.value })}
                className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#344054] mb-1">
                Purchase Treatment <span className="text-red-500">*</span>
              </label>
              <select
                value={newCategoryData.treatment}
                onChange={(e) => setNewCategoryData({ ...newCategoryData, treatment: e.target.value })}
                className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB] font-medium text-slate-800"
              >
                <option value="Expense">Expense — Operating expenses, services, bills & consumables</option>
                <option value="Inventory">Inventory — Raw materials & items stocked into warehouse</option>
                <option value="Asset">Asset — Capital equipment, machinery & fixed assets</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                {newCategoryData.treatment === 'Expense' && 'Posts to operating expense ledger. Does not alter warehouse inventory.'}
                {newCategoryData.treatment === 'Inventory' && 'Enables line items grid and automatically records warehouse Stock IN.'}
                {newCategoryData.treatment === 'Asset' && 'Auto-provisions a registered Fixed Asset record with tracking history.'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#344054] mb-1">
                Description (Optional)
              </label>
              <input
                type="text"
                placeholder="Brief note on what belongs in this category"
                value={newCategoryData.description || ''}
                onChange={(e) => setNewCategoryData({ ...newCategoryData, description: e.target.value })}
                className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <EnterpriseButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowCategoryModal(false)}
              >
                Cancel
              </EnterpriseButton>
              <EnterpriseButton
                type="submit"
                variant="primary"
                size="sm"
                loading={creatingCategory}
              >
                Create Category
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
      )}
    </div>
  )
}

export default CreatePurchasePage
