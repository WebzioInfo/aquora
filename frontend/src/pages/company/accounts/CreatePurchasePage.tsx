import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Check,
  Info,
  Layers,
  FileText,
  CreditCard,
  Building2,
  Calendar,
  AlertCircle
} from 'lucide-react'
import {
  purchaseService,
  type CreatePurchaseRequest,
  type PurchaseCategory,
  type CreatePurchaseCategoryRequest
} from '../../../services/purchases'
import { vendorService, type VendorDropdownItem, type CreateVendorRequest } from '../../../services/vendors'
import { rawMaterialsService, type RawMaterial } from '../../../services/rawMaterials'
import { simpleAccountsService } from '../../../services/simpleAccounts'
import { useNotificationStore } from '../../../store/useNotificationStore'
import EnterpriseHeader from '../../../components/ui/EnterpriseHeader'
import EnterpriseCard from '../../../components/ui/EnterpriseCard'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import EnterpriseBadge from '../../../components/ui/EnterpriseBadge'
import EnterpriseModal from '../../../components/ui/EnterpriseModal'
import EnterpriseNumberInput from '../../../components/ui/EnterpriseNumberInput'
import { calculatePurchaseTotals, round2, type TaxMode } from '../../../utils/purchaseCalculations'

interface BankAccountOption {
  id: string
  accountName: string
  bankName: string
}

interface CashBookOption {
  id: string
  name: string
}

const STANDARD_GST_RATES = [0, 5, 12, 18, 28]

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
  const [categoriesList, setCategoriesList] = useState<PurchaseCategory[]>([])

  // Inline Vendor Modal
  const [showVendorModal, setShowVendorModal] = useState<boolean>(false)
  const [newVendorData, setNewVendorData] = useState<CreateVendorRequest>({ name: '', phone: '', email: '', gst: '', address: '' })

  // Inline Category Modal
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false)
  const [creatingCategory, setCreatingCategory] = useState<boolean>(false)
  const [newCategoryData, setNewCategoryData] = useState<CreatePurchaseCategoryRequest>({
    name: '',
    treatment: 'Expense',
    description: ''
  })

  // Core Form Fields
  const [purchaseCategory, setPurchaseCategory] = useState<string>('RawMaterial')
  const [purchaseDate, setPurchaseDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [vendorId, setVendorId] = useState<string>('')
  const [vendorName, setVendorName] = useState<string>('')
  const [invoiceNumber, setInvoiceNumber] = useState<string>('')
  const [referenceNumber, setReferenceNumber] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  // Tax & GST Configuration States
  const [taxMode, setTaxMode] = useState<TaxMode>('GST')
  const [isInclusiveTax, setIsInclusiveTax] = useState<boolean>(false)
  const [isInterState, setIsInterState] = useState<boolean>(false)
  const [selectedGstRate, setSelectedGstRate] = useState<number>(18)
  const [isCustomGstRate, setIsCustomGstRate] = useState<boolean>(false)
  const [customGstRateInput, setCustomGstRateInput] = useState<number | string>(18)

  // Manual GST Override States
  const [isGstOverridden, setIsGstOverridden] = useState<boolean>(false)
  const [manualGstAmountInput, setManualGstAmountInput] = useState<number | string>(0)

  // Financial Adjustments
  const [discountAmountInput, setDiscountAmountInput] = useState<number | string>(0)
  const [freightChargesInput, setFreightChargesInput] = useState<number | string>(0)
  const [amountPaidInput, setAmountPaidInput] = useState<number | string>(0)

  // Payment Details
  const [paymentMethod, setPaymentMethod] = useState<string>('Credit')
  const [bankAccountId, setBankAccountId] = useState<string>('')
  const [cashBookId, setCashBookId] = useState<string>('')
  const [paymentReferenceNo, setPaymentReferenceNo] = useState<string>('')

  // 1. Raw Material Items Grid
  const [items, setItems] = useState<any[]>([
    { rawMaterialId: '', itemName: '', description: '', quantity: 1, unit: 'Bags', unitPrice: 0, gstPercent: 18, discountAmount: 0, totalAmount: 0 }
  ])

  // 2-10 Category-Specific Dynamic Form States
  const [machineData, setMachineData] = useState({
    machineName: '',
    brand: '',
    model: '',
    serialNumber: '',
    purchaseCost: 0 as number | string,
    installationCost: 0 as number | string,
    warranty: '1 Year',
    usefulLifeYears: 10 as number | string,
    depreciationPercent: 10 as number | string,
    location: 'Main Factory'
  })

  const [assetData, setAssetData] = useState({
    assetName: '',
    category: 'Computers & IT',
    quantity: 1 as number | string,
    unitCost: 0 as number | string,
    serialNumber: '',
    modelNumber: '',
    usefulLifeYears: 5 as number | string,
    depreciationPercent: 20 as number | string,
    warranty: '1 Year',
    department: 'Administration',
    location: 'Head Office'
  })

  const [customAssetData, setCustomAssetData] = useState({
    assetName: '',
    category: 'Equipment',
    serialNumber: '',
    location: 'Main Facility',
    cost: 0 as number | string
  })

  const [maintenanceData, setMaintenanceData] = useState({
    targetAsset: '',
    maintenanceType: 'Routine Servicing',
    serviceProvider: '',
    serviceDate: new Date().toISOString().slice(0, 10),
    nextDueDate: '',
    description: '',
    cost: 0 as number | string
  })

  const [expenseData, setExpenseData] = useState({
    expenseType: 'Office Supplies',
    department: 'Operations',
    description: '',
    amount: 0 as number | string
  })

  const [serviceData, setServiceData] = useState({
    serviceName: 'Professional Consulting',
    sacCode: '',
    consultantName: '',
    servicePeriod: '1 Month',
    scopeNotes: '',
    amount: 0 as number | string
  })

  const [softwareData, setSoftwareData] = useState({
    softwareName: '',
    billingFrequency: 'Annual',
    licenseSeats: 1 as number | string,
    licenseKey: '',
    renewalDate: '',
    cost: 0 as number | string
  })

  const [utilityData, setUtilityData] = useState({
    utilityType: 'Electricity',
    billingMonth: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
    consumerNumber: '',
    meterReading: '',
    amount: 0 as number | string
  })

  const [vehicleData, setVehicleData] = useState({
    vehicleNumber: '',
    fuelType: 'Diesel',
    quantityLiters: 0 as number | string,
    ratePerLiter: 0 as number | string,
    odometerKm: 0 as number | string,
    cost: 0 as number | string
  })

  const [otherData, setOtherData] = useState({
    description: '',
    ledgerAccount: 'General Procurement',
    cost: 0 as number | string
  })

  // Safe helper for numeric parsing
  const parseVal = (val: number | string | undefined | null): number => {
    if (val === '' || val === null || val === undefined) return 0
    const num = typeof val === 'number' ? val : parseFloat(val)
    return isNaN(num) ? 0 : num
  }

  // Active Category Definition & Configuration
  const currentCategory = useMemo(() => {
    return categoriesList.find(c => c.code.toLowerCase() === purchaseCategory.toLowerCase() || c.name.toLowerCase() === purchaseCategory.toLowerCase())
  }, [categoriesList, purchaseCategory])

  const currentTreatment = currentCategory?.treatment || (
    purchaseCategory === 'RawMaterial' ? 'Inventory' :
    (purchaseCategory === 'Machine' || purchaseCategory === 'OfficeAsset') ? 'Asset' : 'Expense'
  )

  // Fetch Master Data on Mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [cats, vList, rmList, banks, cash] = await Promise.all([
          purchaseService.getPurchaseCategories(),
          vendorService.getVendorDropdown(),
          rawMaterialsService.getRawMaterials(1, 100),
          simpleAccountsService.getBankAccountDropdown(),
          simpleAccountsService.getCashBookDropdown()
        ])

        if (Array.isArray(cats)) setCategoriesList(cats)
        if (Array.isArray(vList)) setVendors(vList)
        if (rmList?.data?.items) setRawMaterials(rmList.data.items)
        if (Array.isArray(banks)) setBankAccounts(banks)
        if (Array.isArray(cash)) setCashBooks(cash)
      } catch (err) {
        console.error('Failed to load master data', err)
      }
    }
    loadData()
  }, [])

  // When Category changes: adapt defaults from Category Configuration
  const handleCategoryChange = (newCatCode: string) => {
    setPurchaseCategory(newCatCode)
    const cat = categoriesList.find(c => c.code === newCatCode)
    if (cat) {
      if (!cat.isGstApplicable) {
        setTaxMode('NonGST')
      } else if (taxMode === 'NonGST' && cat.isGstApplicable) {
        setTaxMode('GST')
      }

      if (!isGstOverridden) {
        const defRate = cat.defaultGstRate ?? 18
        if (STANDARD_GST_RATES.includes(defRate)) {
          setSelectedGstRate(defRate)
          setIsCustomGstRate(false)
        } else {
          setIsCustomGstRate(true)
          setCustomGstRateInput(defRate)
        }
      }
    }
  }

  // When Vendor changes
  const handleVendorSelect = (vId: string) => {
    setVendorId(vId)
    const v = vendors.find((x) => x.id === vId)
    if (v) {
      setVendorName(v.name)
    }
  }

  // When Payment method changes, handle default paid amounts
  const handlePaymentMethodChange = (newMethod: string) => {
    setPaymentMethod(newMethod)
    if (newMethod === 'Credit') {
      setAmountPaidInput(0)
    }
  }

  // Load Existing Purchase for Editing or Draft
  useEffect(() => {
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
          setTaxMode(p.taxMode === 'NonGST' || (p.taxAmount === 0 && p.subTotal > 0 && !p.taxMode) ? 'NonGST' : 'GST')
          setIsInclusiveTax(Boolean(p.isInclusiveTax))
          setIsInterState(Boolean(p.isInterState || (p.igstAmount && p.igstAmount > 0)))

          const effectiveRate = p.gstRate || 0
          if (STANDARD_GST_RATES.includes(effectiveRate)) {
            setSelectedGstRate(effectiveRate)
            setIsCustomGstRate(false)
          } else {
            setIsCustomGstRate(true)
            setCustomGstRateInput(effectiveRate)
          }

          if (p.isGstOverridden) {
            setIsGstOverridden(true)
            setManualGstAmountInput(p.taxAmount)
          }

          setDiscountAmountInput(p.discountAmount)
          setFreightChargesInput(p.otherCharges)
          setAmountPaidInput(p.amountPaid)
          setPaymentMethod(p.paymentMethod)
          if (p.bankAccountId) setBankAccountId(p.bankAccountId)
          if (p.cashBookId) setCashBookId(p.cashBookId)

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

          if (p.categoryMetadataJson) {
            try {
              const meta = JSON.parse(p.categoryMetadataJson)
              if (p.purchaseCategory === 'Machine') setMachineData(prev => ({ ...prev, ...meta }))
              else if (p.purchaseCategory === 'OfficeAsset') setAssetData(prev => ({ ...prev, ...meta }))
              else if (p.purchaseCategory === 'Maintenance') setMaintenanceData(prev => ({ ...prev, ...meta }))
              else if (p.purchaseCategory === 'OfficeExpense') setExpenseData(prev => ({ ...prev, ...meta }))
              else if (p.purchaseCategory === 'Service') setServiceData(prev => ({ ...prev, ...meta }))
              else if (p.purchaseCategory === 'Utility') setUtilityData(prev => ({ ...prev, ...meta }))
              else if (p.purchaseCategory === 'Vehicle') setVehicleData(prev => ({ ...prev, ...meta }))
              else if (p.purchaseCategory === 'Software') setSoftwareData(prev => ({ ...prev, ...meta }))
              else setOtherData(prev => ({ ...prev, ...meta }))
            } catch {}
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
      if (draft.items && draft.items.length > 0) setItems(draft.items)
    }
  }, [id, location.state])

  // Items Grid Management
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

    const qty = parseVal(current.quantity)
    const rate = parseVal(current.unitPrice)
    const gstR = taxMode === 'GST' ? parseVal(current.gstPercent) : 0
    const disc = parseVal(current.discountAmount)

    const baseAmount = qty * rate
    const gstVal = (baseAmount * gstR) / 100
    current.totalAmount = Math.max(0, round2(baseAmount + gstVal - disc))

    newItems[index] = current
    setItems(newItems)
  }

  const addItemRow = () => {
    setItems([
      ...items,
      { rawMaterialId: '', itemName: '', description: '', quantity: 1, unit: 'Bags', unitPrice: 0, gstPercent: taxMode === 'GST' ? (isCustomGstRate ? parseVal(customGstRateInput) : selectedGstRate) : 0, discountAmount: 0, totalAmount: 0 }
    ])
  }

  const removeItemRow = (index: number) => {
    if (items.length <= 1) {
      setItems([{ rawMaterialId: '', itemName: '', description: '', quantity: 0, unit: 'Bags', unitPrice: 0, gstPercent: 0, discountAmount: 0, totalAmount: 0 }])
      return
    }
    setItems(items.filter((_, i) => i !== index))
  }

  // Compute SubTotal dynamically across all 10 categories
  const subTotal = useMemo((): number => {
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
  }, [
    currentTreatment,
    purchaseCategory,
    items,
    machineData,
    assetData,
    customAssetData,
    expenseData,
    serviceData,
    maintenanceData,
    utilityData,
    vehicleData,
    softwareData,
    otherData
  ])

  // Active Effective GST Rate
  const activeGstRate = useMemo(() => {
    if (taxMode === 'NonGST') return 0
    return isCustomGstRate ? parseVal(customGstRateInput) : selectedGstRate
  }, [taxMode, isCustomGstRate, customGstRateInput, selectedGstRate])

  // Live Authoritative Calculation via Centralized Engine
  const calculation = useMemo(() => {
    return calculatePurchaseTotals({
      subTotal,
      discountAmount: parseVal(discountAmountInput),
      otherCharges: parseVal(freightChargesInput),
      taxMode,
      gstRate: activeGstRate,
      isInclusiveTax,
      isGstOverridden,
      manualTaxAmount: parseVal(manualGstAmountInput),
      isInterState,
      amountPaid: parseVal(amountPaidInput),
      paymentMethod
    })
  }, [
    subTotal,
    discountAmountInput,
    freightChargesInput,
    taxMode,
    activeGstRate,
    isInclusiveTax,
    isGstOverridden,
    manualGstAmountInput,
    isInterState,
    amountPaidInput,
    paymentMethod
  ])

  // Reset Manual GST Override to Automatic
  const handleResetGstToAuto = () => {
    setIsGstOverridden(false)
    setManualGstAmountInput(calculation.calculatedGst)
    showToast('GST calculation restored to automatic mode.', 'info')
  }

  // Handle Manual GST Input
  const handleManualGstChange = (newVal: number | string) => {
    setIsGstOverridden(true)
    setManualGstAmountInput(newVal)
  }

  // Handle Custom GST Rate Input with validation
  const handleCustomGstInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val === '') {
      setCustomGstRateInput('')
      return
    }
    const num = parseFloat(val)
    if (isNaN(num)) return
    if (num < 0) {
      setCustomGstRateInput(0)
    } else if (num > 100) {
      setCustomGstRateInput(100)
    } else {
      setCustomGstRateInput(val)
    }
  }

  // Quick Inline Category Creation
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
      if (Array.isArray(updated)) setCategoriesList(updated)
      setPurchaseCategory(created.code)
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || 'Failed to create purchase category.', 'error')
    } finally {
      setCreatingCategory(false)
    }
  }

  // Quick Inline Vendor Creation
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

  // Form Submit Handler
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    // Robust Validations
    if (!vendorName.trim()) {
      showToast('Please select or specify a vendor before saving.', 'warning')
      return
    }

    if (!purchaseCategory.trim()) {
      showToast('Please select a purchase category.', 'warning')
      return
    }

    if (currentTreatment === 'Inventory' && (items.length === 0 || !items.some(i => i.quantity > 0))) {
      showToast('Please add at least one item with quantity for inventory purchases.', 'warning')
      return
    }

    if (currentCategory?.requireInvoiceNumber && !invoiceNumber.trim()) {
      showToast('Invoice Number is required for this purchase category.', 'warning')
      return
    }

    if (purchaseCategory === 'Machine' && !machineData.machineName.trim()) {
      showToast('Machine / Asset Name is required for capital asset purchases.', 'warning')
      return
    }

    if (purchaseCategory === 'OfficeAsset' && !assetData.assetName.trim()) {
      showToast('Office Asset Name is required for asset purchases.', 'warning')
      return
    }

    if (calculation.grandTotal <= 0 && calculation.subTotal <= 0) {
      showToast('Please enter a valid purchase amount greater than zero.', 'warning')
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

      metadataObj.taxMode = calculation.taxMode
      metadataObj.isInclusiveTax = calculation.isInclusiveTax
      metadataObj.isInterState = calculation.isInterState
      metadataObj.cgst = calculation.cgstAmount
      metadataObj.sgst = calculation.sgstAmount
      metadataObj.igst = calculation.igstAmount
      metadataObj.treatment = currentTreatment

      const request: CreatePurchaseRequest = {
        purchaseDate,
        vendorId: vendorId || undefined,
        vendorName,
        purchaseCategory,
        invoiceNumber: invoiceNumber.trim() || undefined,
        referenceNumber: referenceNumber.trim() || undefined,
        paymentMethod,
        bankAccountId: paymentMethod === 'BankAccount' ? bankAccountId : undefined,
        cashBookId: paymentMethod === 'Cash' ? cashBookId : undefined,
        subTotal: calculation.subTotal,
        discountAmount: calculation.discountAmount,
        otherCharges: calculation.otherCharges,
        taxMode: calculation.taxMode,
        gstRate: calculation.gstRate,
        taxableAmount: calculation.taxableAmount,
        taxAmount: calculation.finalGst,
        cgstAmount: calculation.cgstAmount,
        sgstAmount: calculation.sgstAmount,
        igstAmount: calculation.igstAmount,
        isGstOverridden: calculation.isGstOverridden,
        isInclusiveTax: calculation.isInclusiveTax,
        isInterState: calculation.isInterState,
        grandTotal: calculation.grandTotal,
        amountPaid: calculation.amountPaid,
        notes: notes.trim() || undefined,
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
        showToast('Purchase invoice updated successfully', 'success')
      } else {
        await purchaseService.createPurchase(request)
        showToast('Purchase invoice recorded successfully', 'success')
      }

      navigate('/app/accounts/purchases')
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || 'Failed to save purchase record.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-20">
      {/* 1. Redesigned Top Header with Primary Actions */}
      <EnterpriseHeader
        title={isEditMode ? 'Edit Purchase Invoice' : 'Create Purchase Invoice'}
        description="Record a supplier purchase, inventory acquisition, service, asset, or operating expense."
        actions={
          <div className="flex items-center gap-3">
            <EnterpriseButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigate('/app/accounts/purchases')}
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back to Purchases
            </EnterpriseButton>
            <EnterpriseButton
              type="button"
              variant="primary"
              size="sm"
              loading={submitting}
              onClick={() => handleSubmit()}
              className="shadow-sm font-semibold"
            >
              <Save className="w-4 h-4 mr-1.5" />
              {isEditMode ? 'Update Purchase Invoice' : 'Save Purchase Invoice'}
            </EnterpriseButton>
          </div>
        }
      />

      {/* Main Full-Width ERP Workspace Layout */}
      <form onSubmit={(e) => handleSubmit(e)} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: 70-75% Main Purchase Workspace */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">

          {/* Section 1: Purchase / Vendor Information */}
          <EnterpriseCard title="Purchase / Vendor Information">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Purchase Category */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Purchase Category <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCategoryModal(true)}
                    className="text-xs text-[#1A56DB] hover:underline font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Custom Category
                  </button>
                </div>
                <select
                  value={purchaseCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB] focus:ring-1 focus:ring-[#1A56DB] font-semibold text-slate-900"
                >
                  {categoriesList.map((c) => (
                    <option key={c.id || c.code} value={c.code}>
                      {c.name} ({c.treatment || 'Expense'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Purchase Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Purchase Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB] focus:ring-1 focus:ring-[#1A56DB] text-slate-900 font-medium"
                />
              </div>

              {/* Vendor / Supplier */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Vendor / Supplier <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowVendorModal(true)}
                    className="text-xs text-[#1A56DB] hover:underline font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> New Vendor
                  </button>
                </div>
                {vendors.length > 0 ? (
                  <select
                    value={vendorId}
                    onChange={(e) => handleVendorSelect(e.target.value)}
                    className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB] focus:ring-1 focus:ring-[#1A56DB] font-medium text-slate-900"
                  >
                    <option value="">-- Select Vendor --</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} {v.gst ? `[${v.gst}]` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    placeholder="Enter Vendor Name"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                  />
                )}
              </div>

              {/* Vendor Invoice Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Vendor Invoice Number {currentCategory?.requireInvoiceNumber && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-9982"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB] focus:ring-1 focus:ring-[#1A56DB] font-mono"
                />
              </div>
            </div>
          </EnterpriseCard>

          {/* Section 2: Tax & GST Configuration — Streamlined Accounting Hierarchy */}
          <EnterpriseCard title="Tax & GST Configuration">
            <div className="space-y-5">
              {/* Hierarchical Controls: Treatment -> Pricing -> Location */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Tax Type */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Tax Type</label>
                  <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-[8px] border border-slate-200 gap-1">
                    <button
                      type="button"
                      onClick={() => setTaxMode('GST')}
                      className={`py-1.5 text-xs font-semibold rounded-[6px] transition-all text-center ${
                        taxMode === 'GST'
                          ? 'bg-[#1A56DB] text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      GST Invoice
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaxMode('NonGST')}
                      className={`py-1.5 text-xs font-semibold rounded-[6px] transition-all text-center ${
                        taxMode === 'NonGST'
                          ? 'bg-slate-800 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      Non-GST
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {taxMode === 'GST' ? 'Standard GST tax credit invoice' : 'Exempted or non-taxable procurement'}
                  </p>
                </div>

                {/* 2. GST Pricing */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">GST Pricing</label>
                  <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-[8px] border border-slate-200 gap-1">
                    <button
                      type="button"
                      onClick={() => setIsInclusiveTax(false)}
                      className={`py-1.5 text-xs font-semibold rounded-[6px] transition-all text-center ${
                        !isInclusiveTax
                          ? 'bg-[#1A56DB] text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      Tax Exclusive
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsInclusiveTax(true)}
                      className={`py-1.5 text-xs font-semibold rounded-[6px] transition-all text-center ${
                        isInclusiveTax
                          ? 'bg-[#1A56DB] text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      Tax Inclusive
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {isInclusiveTax
                      ? 'GST is already included in the entered amount.'
                      : 'GST is added to the taxable amount.'}
                  </p>
                </div>

                {/* 3. Tax Location */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Tax Location</label>
                  <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-[8px] border border-slate-200 gap-1">
                    <button
                      type="button"
                      disabled={taxMode === 'NonGST'}
                      onClick={() => setIsInterState(false)}
                      className={`py-1.5 text-xs font-semibold rounded-[6px] transition-all text-center ${
                        !isInterState
                          ? 'bg-[#1A56DB] text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      } ${taxMode === 'NonGST' ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      Intra-State
                    </button>
                    <button
                      type="button"
                      disabled={taxMode === 'NonGST'}
                      onClick={() => setIsInterState(true)}
                      className={`py-1.5 text-xs font-semibold rounded-[6px] transition-all text-center ${
                        isInterState
                          ? 'bg-[#1A56DB] text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      } ${taxMode === 'NonGST' ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      Inter-State
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {isInterState ? 'IGST (Integrated Tax across states)' : 'CGST + SGST (Intra-state split)'}
                  </p>
                </div>
              </div>

              {/* GST Rate Selection with Radio/Pill Controls */}
              {taxMode === 'GST' && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                      GST Rate Selection
                    </label>
                    <div className="flex flex-wrap items-center gap-2.5">
                      {STANDARD_GST_RATES.map((rate) => {
                        const isSelected = !isCustomGstRate && selectedGstRate === rate
                        return (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => {
                              setSelectedGstRate(rate)
                              setIsCustomGstRate(false)
                            }}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-[8px] text-xs font-semibold border transition-all ${
                              isSelected
                                ? 'bg-blue-50 border-[#1A56DB] text-[#1A56DB] shadow-sm ring-1 ring-[#1A56DB]'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            <span
                              className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                                isSelected ? 'border-[#1A56DB]' : 'border-slate-300'
                              }`}
                            >
                              {isSelected && <span className="w-2 h-2 rounded-full bg-[#1A56DB]" />}
                            </span>
                            <span>{rate}%</span>
                          </button>
                        )
                      })}

                      {/* Custom Rate Pill */}
                      <button
                        type="button"
                        onClick={() => setIsCustomGstRate(true)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-[8px] text-xs font-semibold border transition-all ${
                          isCustomGstRate
                            ? 'bg-blue-50 border-[#1A56DB] text-[#1A56DB] shadow-sm ring-1 ring-[#1A56DB]'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            isCustomGstRate ? 'border-[#1A56DB]' : 'border-slate-300'
                          }`}
                        >
                          {isCustomGstRate && <span className="w-2 h-2 rounded-full bg-[#1A56DB]" />}
                        </span>
                        <span>Custom Rate</span>
                      </button>

                      {/* Inline Custom Rate Input with Suffix */}
                      {isCustomGstRate && (
                        <div className="flex items-center gap-1.5 ml-2 bg-slate-50 px-2.5 py-1 rounded-[8px] border border-blue-200">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={customGstRateInput}
                            onChange={handleCustomGstInputChange}
                            placeholder="0.00"
                            className="w-20 h-[30px] px-2 text-xs font-mono font-bold bg-white border border-[#1A56DB] rounded-[6px] focus:outline-none text-right"
                          />
                          <span className="text-xs font-bold text-slate-600">%</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Human-Readable Accounting GST Calculation & Manual Override */}
                  <div className="bg-[#F8FAFC] p-4 rounded-[10px] border border-slate-200/90 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                      <span className="text-xs font-bold text-slate-800 tracking-wide">
                        GST Calculation & Accounting Breakdown
                      </span>
                      <div className="flex items-center gap-2">
                        {isGstOverridden ? (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md font-semibold border border-amber-200">
                            Manual Override
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md font-semibold border border-emerald-200">
                            <Check className="w-3 h-3 text-emerald-600" /> Auto Calculated
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      {/* Taxable Amount */}
                      <div>
                        <span className="block text-[11px] text-slate-500 font-medium">Taxable Amount</span>
                        <span className="font-mono font-bold text-sm text-slate-900">
                          ₹{calculation.taxableAmount.toFixed(2)}
                        </span>
                      </div>

                      {/* GST Rate */}
                      <div>
                        <span className="block text-[11px] text-slate-500 font-medium">GST Rate</span>
                        <span className="font-mono font-bold text-sm text-slate-900">
                          {activeGstRate}%
                        </span>
                      </div>

                      {/* GST Amount with inline edit */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-slate-500 font-medium">GST Amount</span>
                          {isGstOverridden && (
                            <button
                              type="button"
                              onClick={handleResetGstToAuto}
                              title="Restore automatic calculation"
                              className="text-[11px] text-[#1A56DB] hover:underline font-semibold flex items-center gap-0.5"
                            >
                              <RotateCcw className="w-3 h-3" /> Auto
                            </button>
                          )}
                        </div>
                        <div className="w-36">
                          <EnterpriseNumberInput
                            value={isGstOverridden ? manualGstAmountInput : calculation.finalGst}
                            onValueChange={handleManualGstChange}
                            placeholder="0.00"
                            className="!h-[32px] text-right font-mono text-xs font-bold"
                          />
                        </div>
                        {isGstOverridden && (
                          <p className="text-[10px] text-amber-700 mt-1 font-medium">
                            GST amount manually adjusted
                          </p>
                        )}
                      </div>

                      {/* Tax Split */}
                      <div className="border-l border-slate-200/80 pl-4">
                        <span className="block text-[11px] text-slate-500 font-medium mb-1">Tax Split</span>
                        {isInterState ? (
                          <div className="font-mono text-xs text-slate-800">
                            IGST ({activeGstRate}%): <span className="font-bold">₹{calculation.igstAmount.toFixed(2)}</span>
                          </div>
                        ) : (
                          <div className="font-mono text-xs text-slate-800 space-y-0.5">
                            <div>CGST ({(activeGstRate / 2).toFixed(1)}%): <span className="font-bold">₹{calculation.cgstAmount.toFixed(2)}</span></div>
                            <div>SGST ({(activeGstRate / 2).toFixed(1)}%): <span className="font-bold">₹{calculation.sgstAmount.toFixed(2)}</span></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </EnterpriseCard>

          {/* Section 3: Dynamic Category-Specific Purchase Details */}
          <EnterpriseCard title={`Category Details: ${currentCategory?.name || purchaseCategory}`}>
            <div className="space-y-4">
              {/* Guidance Info Banner */}
              <div className="p-3 bg-blue-50/70 rounded-[8px] border border-blue-200/80 text-xs text-slate-700 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-[#1A56DB] shrink-0 mt-0.5" />
                <div>
                  {currentTreatment === 'Inventory' && (
                    <p><strong>Raw Material Inventory:</strong> Saving this purchase will automatically increment stock quantities and register an <strong className="text-[#1A56DB]">InventoryMovement (Stock IN)</strong> audit. Ledger: Debit Raw Material Inventory | Credit Vendor.</p>
                  )}
                  {currentTreatment === 'Asset' && (
                    <p><strong>Fixed Capital Asset:</strong> Automatically creates a registered <strong className="text-[#1A56DB]">Fixed Asset record</strong> with initial acquisition value, location, and depreciation details.</p>
                  )}
                  {currentTreatment === 'Expense' && (
                    <p><strong>Operating Expense:</strong> Posts directly to company expense ledgers with accurate input tax credits. Ledger: Debit Operating Expense | Credit Vendor / Bank.</p>
                  )}
                </div>
              </div>

              {/* Dynamic View 1: RAW MATERIAL INVENTORY (FULL-WIDTH PROFESSIONAL ITEM TABLE) */}
              {currentTreatment === 'Inventory' && (
                <div className="space-y-3">
                  <div className="overflow-x-auto border border-slate-200 rounded-[8px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider">
                          <th className="p-3">Material *</th>
                          <th className="p-3">Description / Batch</th>
                          <th className="p-3 w-28 text-right">Qty *</th>
                          <th className="p-3 w-24">Unit</th>
                          <th className="p-3 w-32 text-right">Rate (₹) *</th>
                          {taxMode === 'GST' && <th className="p-3 w-24 text-right">GST %</th>}
                          <th className="p-3 w-28 text-right">Discount</th>
                          <th className="p-3 w-32 text-right">Row Total</th>
                          <th className="p-3 w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="p-2.5">
                              {rawMaterials.length > 0 ? (
                                <select
                                  value={item.rawMaterialId || ''}
                                  onChange={(e) => updateItem(idx, 'rawMaterialId', e.target.value)}
                                  className="w-full h-[36px] px-2.5 bg-white border border-[#D0D5DD] rounded-[6px] text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1A56DB]"
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
                                  className="w-full h-[36px] px-2.5 bg-white border border-[#D0D5DD] rounded-[6px] text-xs focus:outline-none focus:border-[#1A56DB]"
                                />
                              )}
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                placeholder="Batch / Grade"
                                value={item.description}
                                onChange={(e) => updateItem(idx, 'description', e.target.value)}
                                className="w-full h-[36px] px-2.5 bg-white border border-[#D0D5DD] rounded-[6px] text-xs focus:outline-none focus:border-[#1A56DB]"
                              />
                            </td>
                            <td className="p-2.5">
                              <EnterpriseNumberInput
                                value={item.quantity}
                                onValueChange={(val) => updateItem(idx, 'quantity', val)}
                                placeholder="0"
                                className="!h-[36px] text-right font-mono"
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                value={item.unit}
                                onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                                className="w-full h-[36px] px-2.5 bg-white border border-[#D0D5DD] rounded-[6px] text-xs font-medium focus:outline-none focus:border-[#1A56DB]"
                              />
                            </td>
                            <td className="p-2.5">
                              <EnterpriseNumberInput
                                value={item.unitPrice}
                                onValueChange={(val) => updateItem(idx, 'unitPrice', val)}
                                placeholder="0.00"
                                className="!h-[36px] text-right font-mono"
                              />
                            </td>
                            {taxMode === 'GST' && (
                              <td className="p-2.5">
                                <EnterpriseNumberInput
                                  value={item.gstPercent}
                                  onValueChange={(val) => updateItem(idx, 'gstPercent', val)}
                                  placeholder="18"
                                  className="!h-[36px] text-right font-mono"
                                />
                              </td>
                            )}
                            <td className="p-2.5">
                              <EnterpriseNumberInput
                                value={item.discountAmount}
                                onValueChange={(val) => updateItem(idx, 'discountAmount', val)}
                                placeholder="0.00"
                                className="!h-[36px] text-right font-mono"
                              />
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                              ₹{(item.totalAmount || 0).toFixed(2)}
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => removeItemRow(idx)}
                                className="text-slate-400 hover:text-red-600 transition-colors p-1"
                                title="Remove item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Item Table Bottom Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                    <EnterpriseButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={addItemRow}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Material Item
                    </EnterpriseButton>
                    <div className="text-xs font-semibold text-slate-600 text-right">
                      Items Subtotal: <span className="font-mono text-sm font-bold text-slate-900 ml-1">₹{subTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic View 2: MACHINE / EQUIPMENT (CAPITAL ASSET) */}
              {purchaseCategory === 'Machine' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Machine / Equipment Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 24-BPM Automatic Bottling Monoblock Machine"
                      value={machineData.machineName}
                      onChange={(e) => setMachineData({ ...machineData, machineName: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB] font-semibold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Manufacturer / Brand</label>
                    <input
                      type="text"
                      placeholder="e.g. Tetra Pak / WaterTec"
                      value={machineData.brand}
                      onChange={(e) => setMachineData({ ...machineData, brand: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Model Number</label>
                    <input
                      type="text"
                      placeholder="e.g. WTP-RO-5000"
                      value={machineData.model}
                      onChange={(e) => setMachineData({ ...machineData, model: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                    />
                  </div>
                  <EnterpriseNumberInput
                    label="Machine Base Cost (₹) *"
                    value={machineData.purchaseCost}
                    onValueChange={(val) => setMachineData({ ...machineData, purchaseCost: val })}
                  />
                  <EnterpriseNumberInput
                    label="Installation / Commissioning Charges (₹)"
                    value={machineData.installationCost}
                    onValueChange={(val) => setMachineData({ ...machineData, installationCost: val })}
                  />
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Serial Number</label>
                    <input
                      type="text"
                      placeholder="SN-RO-998231-X"
                      value={machineData.serialNumber}
                      onChange={(e) => setMachineData({ ...machineData, serialNumber: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Installation Location / Bay</label>
                    <input
                      type="text"
                      placeholder="e.g. Primary RO Hall / Filling Line A"
                      value={machineData.location}
                      onChange={(e) => setMachineData({ ...machineData, location: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Warranty Period</label>
                    <input
                      type="text"
                      placeholder="e.g. 2 Years Comprehensive"
                      value={machineData.warranty}
                      onChange={(e) => setMachineData({ ...machineData, warranty: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <EnterpriseNumberInput
                      label="Useful Life (Yrs)"
                      value={machineData.usefulLifeYears}
                      onValueChange={(val) => setMachineData({ ...machineData, usefulLifeYears: val })}
                    />
                    <EnterpriseNumberInput
                      label="Depreciation %"
                      value={machineData.depreciationPercent}
                      onValueChange={(val) => setMachineData({ ...machineData, depreciationPercent: val })}
                    />
                  </div>
                </div>
              )}

              {/* Dynamic View 3: OFFICE ASSET */}
              {purchaseCategory === 'OfficeAsset' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Asset Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dell Core i7 Billing Terminal"
                      value={assetData.assetName}
                      onChange={(e) => setAssetData({ ...assetData, assetName: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB] font-semibold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Asset Category</label>
                    <select
                      value={assetData.category}
                      onChange={(e) => setAssetData({ ...assetData, category: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                    >
                      <option value="Computers & IT">Computers & IT Equipment</option>
                      <option value="Office Furniture">Office Furniture & Fixtures</option>
                      <option value="Printers & Scanners">Printers & Peripheral Devices</option>
                      <option value="Security & CCTV">Security & CCTV Cameras</option>
                      <option value="Air Conditioning">HVAC & Air Conditioning</option>
                      <option value="Other Office Asset">Other Office Fixed Asset</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department Assigned</label>
                    <input
                      type="text"
                      placeholder="e.g. Accounts & Dispatch"
                      value={assetData.department}
                      onChange={(e) => setAssetData({ ...assetData, department: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                    />
                  </div>
                  <EnterpriseNumberInput
                    label="Quantity *"
                    value={assetData.quantity}
                    onValueChange={(val) => setAssetData({ ...assetData, quantity: val })}
                  />
                  <EnterpriseNumberInput
                    label="Unit Cost (₹) *"
                    value={assetData.unitCost}
                    onValueChange={(val) => setAssetData({ ...assetData, unitCost: val })}
                  />
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Serial / Tag</label>
                    <input
                      type="text"
                      placeholder="e.g. AST-IT-2026-0042"
                      value={assetData.serialNumber}
                      onChange={(e) => setAssetData({ ...assetData, serialNumber: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Admin Block Room 2"
                      value={assetData.location}
                      onChange={(e) => setAssetData({ ...assetData, location: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                    />
                  </div>
                </div>
              )}

              {/* Dynamic View 4: MAINTENANCE & REPAIR */}
              {purchaseCategory === 'Maintenance' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Serviced Equipment / Asset *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. High Pressure RO Pump #2"
                      value={maintenanceData.targetAsset}
                      onChange={(e) => setMaintenanceData({ ...maintenanceData, targetAsset: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] font-medium focus:outline-none focus:border-[#1A56DB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Maintenance Type</label>
                    <select
                      value={maintenanceData.maintenanceType}
                      onChange={(e) => setMaintenanceData({ ...maintenanceData, maintenanceType: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                    >
                      <option value="Routine Servicing">Routine Servicing</option>
                      <option value="Breakdown Repair">Breakdown Repair</option>
                      <option value="Membrane CIP Cleaning">Membrane CIP Chemical Wash</option>
                      <option value="Ozone Generator Overhaul">Ozone Generator Overhaul</option>
                      <option value="Annual Maintenance (AMC)">AMC Service Visit</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Service Engineer / Agency</label>
                    <input
                      type="text"
                      placeholder="e.g. Technocare Services"
                      value={maintenanceData.serviceProvider}
                      onChange={(e) => setMaintenanceData({ ...maintenanceData, serviceProvider: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                    />
                  </div>
                  <EnterpriseNumberInput
                    label="Service Charge / Maintenance Cost (₹) *"
                    value={maintenanceData.cost}
                    onValueChange={(val) => setMaintenanceData({ ...maintenanceData, cost: val })}
                  />
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Work Done / Scope Description</label>
                    <input
                      type="text"
                      placeholder="Detailed work carried out, replaced seals, chemicals used"
                      value={maintenanceData.description}
                      onChange={(e) => setMaintenanceData({ ...maintenanceData, description: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                    />
                  </div>
                </div>
              )}

              {/* Dynamic View 5: OFFICE EXPENSE */}
              {purchaseCategory === 'OfficeExpense' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Expense Type</label>
                    <select
                      value={expenseData.expenseType}
                      onChange={(e) => setExpenseData({ ...expenseData, expenseType: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                    >
                      <option value="Office Supplies">Stationery & Office Supplies</option>
                      <option value="Pantry & Refreshments">Pantry, Tea & Refreshments</option>
                      <option value="Sanitation & Cleaning">Plant Housekeeping & Sanitizers</option>
                      <option value="Courier & Postage">Courier & Dispatch Postage</option>
                      <option value="Staff Welfare">Staff Welfare & Safety PPE</option>
                      <option value="Other Consumables">Other Consumable Expense</option>
                    </select>
                  </div>
                  <EnterpriseNumberInput
                    label="Total Expense Amount (₹) *"
                    value={expenseData.amount}
                    onValueChange={(val) => setExpenseData({ ...expenseData, amount: val })}
                  />
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Expense Description *</label>
                    <input
                      type="text"
                      required
                      placeholder="Describe items purchased or purpose"
                      value={expenseData.description}
                      onChange={(e) => setExpenseData({ ...expenseData, description: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                    />
                  </div>
                </div>
              )}

              {/* Dynamic View 6: SERVICE / CONSULTING */}
              {purchaseCategory === 'Service' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Service Description *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. BIS / FSSAI Water Testing & Compliance Audit"
                      value={serviceData.serviceName}
                      onChange={(e) => setServiceData({ ...serviceData, serviceName: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] font-medium focus:outline-none focus:border-[#1A56DB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">SAC Code (Services Tax Code)</label>
                    <input
                      type="text"
                      placeholder="e.g. 998311"
                      value={serviceData.sacCode}
                      onChange={(e) => setServiceData({ ...serviceData, sacCode: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] font-mono focus:outline-none focus:border-[#1A56DB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Service Duration / Billing Period</label>
                    <input
                      type="text"
                      placeholder="e.g. October 2026 Audit Cycle"
                      value={serviceData.servicePeriod}
                      onChange={(e) => setServiceData({ ...serviceData, servicePeriod: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                    />
                  </div>
                  <EnterpriseNumberInput
                    label="Service Fee (₹) *"
                    value={serviceData.amount}
                    onValueChange={(val) => setServiceData({ ...serviceData, amount: val })}
                  />
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Consultancy Scope & Deliverables</label>
                    <input
                      type="text"
                      placeholder="Deliverables, audit certificate reference, etc."
                      value={serviceData.scopeNotes}
                      onChange={(e) => setServiceData({ ...serviceData, scopeNotes: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                    />
                  </div>
                </div>
              )}

              {/* Dynamic View 7: SOFTWARE & SUBSCRIPTIONS */}
              {purchaseCategory === 'Software' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Software / Tool Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. TallyPrime Cloud / Microsoft 365 / WhatsApp API"
                      value={softwareData.softwareName}
                      onChange={(e) => setSoftwareData({ ...softwareData, softwareName: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] font-medium focus:outline-none focus:border-[#1A56DB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Billing Frequency</label>
                    <select
                      value={softwareData.billingFrequency}
                      onChange={(e) => setSoftwareData({ ...softwareData, billingFrequency: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                    >
                      <option value="Monthly">Monthly Recurring</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Annual">Annual License</option>
                      <option value="OneTime">Perpetual / One-Time</option>
                    </select>
                  </div>
                  <EnterpriseNumberInput
                    label="Subscription Amount (₹) *"
                    value={softwareData.cost}
                    onValueChange={(val) => setSoftwareData({ ...softwareData, cost: val })}
                  />
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Renewal Date</label>
                    <input
                      type="date"
                      value={softwareData.renewalDate}
                      onChange={(e) => setSoftwareData({ ...softwareData, renewalDate: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                    />
                  </div>
                </div>
              )}

              {/* Dynamic View 8: UTILITY BILLS */}
              {purchaseCategory === 'Utility' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Utility Type</label>
                    <select
                      value={utilityData.utilityType}
                      onChange={(e) => setUtilityData({ ...utilityData, utilityType: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                    >
                      <option value="Electricity">Plant Industrial Electricity (HT / LT)</option>
                      <option value="Municipal Water">Municipal Raw Water Tariff</option>
                      <option value="Internet">Fiber Broadband & Static IP</option>
                      <option value="LPG/Gas">Fuel Gas / LPG Boiler Supply</option>
                      <option value="Waste Disposal">Effluent / Solid Waste Disposal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Consumer / Meter Number</label>
                    <input
                      type="text"
                      placeholder="e.g. MTR-99238410"
                      value={utilityData.consumerNumber}
                      onChange={(e) => setUtilityData({ ...utilityData, consumerNumber: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] font-mono focus:outline-none focus:border-[#1A56DB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Billing Month / Period</label>
                    <input
                      type="text"
                      placeholder="e.g. September 2026"
                      value={utilityData.billingMonth}
                      onChange={(e) => setUtilityData({ ...utilityData, billingMonth: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                    />
                  </div>
                  <EnterpriseNumberInput
                    label="Utility Bill Amount (₹) *"
                    value={utilityData.amount}
                    onValueChange={(val) => setUtilityData({ ...utilityData, amount: val })}
                  />
                </div>
              )}

              {/* Dynamic View 9: VEHICLE & FUEL EXPENSE */}
              {purchaseCategory === 'Vehicle' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Delivery Vehicle Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. MH-12-AB-1234"
                      value={vehicleData.vehicleNumber}
                      onChange={(e) => setVehicleData({ ...vehicleData, vehicleNumber: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] font-mono uppercase font-bold focus:outline-none focus:border-[#1A56DB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Fuel / Expense Type</label>
                    <select
                      value={vehicleData.fuelType}
                      onChange={(e) => setVehicleData({ ...vehicleData, fuelType: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                    >
                      <option value="Diesel">Diesel</option>
                      <option value="Petrol">Petrol</option>
                      <option value="CNG">CNG</option>
                      <option value="Toll & Fastag">Fastag / Toll Charges</option>
                      <option value="Vehicle Maintenance">Truck Tyre / Service</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <EnterpriseNumberInput
                      label="Quantity (Liters)"
                      value={vehicleData.quantityLiters}
                      onValueChange={(val) => setVehicleData({ ...vehicleData, quantityLiters: val })}
                    />
                    <EnterpriseNumberInput
                      label="Odometer (Km)"
                      value={vehicleData.odometerKm}
                      onValueChange={(val) => setVehicleData({ ...vehicleData, odometerKm: val })}
                    />
                  </div>
                  <EnterpriseNumberInput
                    label="Total Fuel / Expense (₹) *"
                    value={vehicleData.cost}
                    onValueChange={(val) => setVehicleData({ ...vehicleData, cost: val })}
                  />
                </div>
              )}

              {/* Dynamic View 10: OTHER CATEGORY OR CUSTOM ASSET */}
              {purchaseCategory === 'Other' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Particulars / Item Description *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Specify procurement particulars"
                      value={otherData.description}
                      onChange={(e) => setOtherData({ ...otherData, description: e.target.value })}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                    />
                  </div>
                  <EnterpriseNumberInput
                    label="Amount (₹) *"
                    value={otherData.cost}
                    onValueChange={(val) => setOtherData({ ...otherData, cost: val })}
                  />
                </div>
              )}
            </div>
          </EnterpriseCard>

          {/* Section 4: Notes / Additional Information */}
          <EnterpriseCard title="Notes & Additional Information">
            <textarea
              rows={2}
              placeholder="Enter purchase agreement terms, delivery tracking, warranty clauses, or audit remarks"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB] focus:ring-1 focus:ring-[#1A56DB] text-slate-800"
            />
          </EnterpriseCard>
        </div>

        {/* Right Column: 25-30% Sticky Financial Summary & Payment Settlement */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-6 lg:sticky lg:top-6">
          <EnterpriseCard title="Purchase Summary">
            <div className="space-y-4">
              {/* Financial Breakdown Sheet */}
              <div className="space-y-2.5 text-xs bg-slate-50 p-4 rounded-[10px] border border-slate-200">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono font-bold text-slate-900">₹{calculation.subTotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center text-slate-600">
                  <span>Discount:</span>
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
                  <span>Freight / Logistics:</span>
                  <div className="w-28">
                    <EnterpriseNumberInput
                      value={freightChargesInput}
                      onValueChange={(val) => setFreightChargesInput(val)}
                      placeholder="0.00"
                      className="!h-[32px] text-right font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-between text-slate-700 font-semibold border-t border-dashed border-slate-300 pt-2">
                  <span>Taxable Amount:</span>
                  <span className="font-mono text-slate-900 font-bold">₹{calculation.taxableAmount.toFixed(2)}</span>
                </div>

                {calculation.taxMode === 'GST' && (
                  <div className="pt-2 border-t border-slate-200 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1 text-slate-600">
                        GST ({calculation.gstRate}%{calculation.isInclusiveTax ? ' Incl' : ''}):
                        {calculation.isGstOverridden && (
                          <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                            Manual
                          </span>
                        )}
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        + ₹{calculation.finalGst.toFixed(2)}
                      </span>
                    </div>

                    {calculation.isInterState ? (
                      <div className="flex justify-between text-[11px] text-slate-600 pl-2">
                        <span>IGST ({calculation.gstRate}%):</span>
                        <span className="font-mono font-medium">₹{calculation.igstAmount.toFixed(2)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between text-[11px] text-slate-500 pl-2">
                          <span>CGST ({(calculation.gstRate / 2).toFixed(1)}%):</span>
                          <span className="font-mono">₹{calculation.cgstAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500 pl-2">
                          <span>SGST ({(calculation.gstRate / 2).toFixed(1)}%):</span>
                          <span className="font-mono">₹{calculation.sgstAmount.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Grand Total — Dominant Highlight */}
                <div className="border-t-2 border-slate-300 pt-3 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-slate-900">Grand Total:</span>
                  <span className="font-mono text-xl font-extrabold text-[#1A56DB]">
                    ₹{calculation.grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Settlement Section */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => handlePaymentMethodChange(e.target.value)}
                    className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] font-semibold text-slate-900 focus:outline-none focus:border-[#1A56DB]"
                  >
                    <option value="Credit">Credit / Unpaid (Vendor Payable Ledger)</option>
                    <option value="Cash">Cash (Immediate Cash Book)</option>
                    <option value="BankAccount">Bank Transfer / NEFT / RTGS</option>
                    <option value="UPI">UPI / Digital QR</option>
                    <option value="Cheque">Bank Cheque</option>
                  </select>
                </div>

                {/* Bank Account Selection if Bank */}
                {paymentMethod === 'BankAccount' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Company Bank Account</label>
                    <select
                      value={bankAccountId}
                      onChange={(e) => setBankAccountId(e.target.value)}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                    >
                      <option value="">-- Select Bank Account --</option>
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>{b.bankName} - {b.accountName}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Cash Book Selection if Cash */}
                {paymentMethod === 'Cash' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Company Cash Book</label>
                    <select
                      value={cashBookId}
                      onChange={(e) => setCashBookId(e.target.value)}
                      className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
                    >
                      <option value="">-- Select Cash Book --</option>
                      {cashBooks.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Amount Paid & Reference (shown when not Credit) */}
                {paymentMethod !== 'Credit' ? (
                  <>
                    <EnterpriseNumberInput
                      label="Paid Amount (₹)"
                      value={amountPaidInput}
                      onValueChange={(val) => setAmountPaidInput(val)}
                      placeholder="0.00"
                    />
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Reference / UTR</label>
                      <input
                        type="text"
                        placeholder="e.g. UTR-20261008001"
                        value={paymentReferenceNo}
                        onChange={(e) => setPaymentReferenceNo(e.target.value)}
                        className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] font-mono focus:outline-none focus:border-[#1A56DB]"
                      />
                    </div>
                  </>
                ) : (
                  <div className="bg-slate-50 p-2.5 rounded-[8px] border border-slate-200 text-xs text-slate-600">
                    <span className="block text-[11px] text-slate-500 font-medium">Paid Amount</span>
                    <span className="font-mono font-bold text-slate-700">₹0.00 (Unpaid)</span>
                  </div>
                )}

                {/* Settlement Balance & Status Card */}
                <div className="p-3 bg-slate-50 rounded-[8px] border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-slate-600">Payment Status:</span>
                    {calculation.paymentStatus === 'Paid' && (
                      <EnterpriseBadge variant="success">Fully Paid</EnterpriseBadge>
                    )}
                    {calculation.paymentStatus === 'PartiallyPaid' && (
                      <EnterpriseBadge variant="warning">Partially Paid</EnterpriseBadge>
                    )}
                    {calculation.paymentStatus === 'Unpaid' && (
                      <EnterpriseBadge variant="danger">Credit / Unpaid</EnterpriseBadge>
                    )}
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-slate-900 border-t border-slate-200 pt-2">
                    <span>Remaining Balance:</span>
                    <span className={`font-mono text-sm ${calculation.balanceAmount > 0 ? 'text-red-600 font-extrabold' : 'text-emerald-600'}`}>
                      ₹{calculation.balanceAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Save Invoice Primary Button */}
                <EnterpriseButton
                  type="submit"
                  variant="primary"
                  loading={submitting}
                  className="w-full !h-[44px] text-sm font-bold shadow-sm mt-2"
                >
                  <Save className="w-4 h-4 mr-1.5" />
                  {isEditMode ? 'Update Purchase Invoice' : 'Save Purchase Invoice'}
                </EnterpriseButton>
              </div>
            </div>
          </EnterpriseCard>
        </div>
      </form>

      {/* Inline Create Vendor Modal */}
      {showVendorModal && (
        <EnterpriseModal
          isOpen={showVendorModal}
          onClose={() => setShowVendorModal(false)}
          title="Quick Add Vendor"
        >
          <form onSubmit={handleCreateVendor} className="space-y-3">
            <input
              type="text"
              required
              placeholder="Vendor Name *"
              value={newVendorData.name}
              onChange={(e) => setNewVendorData({ ...newVendorData, name: e.target.value })}
              className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
            />
            <input
              type="text"
              placeholder="GSTIN (e.g. 29AABCU9603R1ZM)"
              value={newVendorData.gst}
              onChange={(e) => setNewVendorData({ ...newVendorData, gst: e.target.value })}
              className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] uppercase font-mono focus:outline-none focus:border-[#1A56DB]"
            />
            <input
              type="text"
              placeholder="Phone Number"
              value={newVendorData.phone}
              onChange={(e) => setNewVendorData({ ...newVendorData, phone: e.target.value })}
              className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
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
          title="Create Custom Purchase Category"
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
                placeholder="e.g. Factory Sanitation, Testing Chemicals"
                value={newCategoryData.name}
                onChange={(e) => setNewCategoryData({ ...newCategoryData, name: e.target.value })}
                className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#344054] mb-1">
                Accounting Treatment <span className="text-red-500">*</span>
              </label>
              <select
                value={newCategoryData.treatment}
                onChange={(e) => setNewCategoryData({ ...newCategoryData, treatment: e.target.value })}
                className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB] font-medium text-slate-800"
              >
                <option value="Expense">Expense — Operating expense ledgers (P&L impact)</option>
                <option value="Inventory">Inventory — Warehouse stock increase (Balance Sheet impact)</option>
                <option value="Asset">Asset — Capital equipment auto-creation (Fixed Assets impact)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#344054] mb-1">
                Description (Optional)
              </label>
              <input
                type="text"
                placeholder="Brief purpose of this procurement category"
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
