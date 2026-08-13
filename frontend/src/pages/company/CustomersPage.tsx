import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { 
  Search, Plus, Eye, Edit2, Trash2, X, AlertTriangle, 
  MapPin, Phone as PhoneIcon, FileText, Landmark, ShieldAlert,
  ArrowUpDown, Filter, ChevronLeft, ChevronRight, CheckCircle2, XCircle,
  Printer
} from 'lucide-react'
import { PrintPreviewModal } from '../../components/ui/PrintPreviewModal'
import { customersService } from '../../services/customers'
import type { Customer } from '../../services/customers'
import { brandService } from '../../services/brands'
import { rawMaterialsService } from '../../services/rawMaterials'
import { SearchableDropdown } from '../../components/ui/SearchableDropdown'
import { useNotificationStore } from '../../store/useNotificationStore'
import { useAuthStore } from '../../store/useAuthStore'
import EnterpriseHeader from '../../components/ui/EnterpriseHeader'
import PageContainer from '../../components/ui/layout/PageContainer'
import PageHeader from '../../components/ui/layout/PageHeader'
import FilterBar from '../../components/ui/layout/FilterBar'
import EnterpriseBadge from '../../components/ui/EnterpriseBadge'
import EnterpriseInput from '../../components/ui/EnterpriseInput'
import EnterpriseSelect from '../../components/ui/EnterpriseSelect'
import EnterpriseModal from '../../components/ui/EnterpriseModal'
import { CustomerProfilePage } from './CustomerProfilePage'
import { GeneralTab } from './customers/GeneralTab'
import { AddressTab } from './customers/AddressTab'
import {
  PremiumLabel,
  PremiumInput,
  PremiumSelect,
  PremiumTextarea,
  PremiumSectionHeading
} from '../../components/ui/PremiumForms'

const parseErrorResponse = (err: any): string => {
  const data = err?.response?.data
  if (!data) {
    return 'Unable to process request. Please check your network connection and try again.'
  }

  let extractedMessage = ''
  
  if (data.errors && typeof data.errors === 'object') {
    const errorList: string[] = []
    Object.entries(data.errors).forEach(([_, val]) => {
      if (Array.isArray(val)) {
        errorList.push(...val.map(v => String(v)))
      } else if (typeof val === 'string') {
        errorList.push(val)
      }
    })
    if (errorList.length > 0) {
      extractedMessage = errorList.join(', ')
    }
  }

  if (!extractedMessage) {
    extractedMessage = data.message || data.title || ''
  }

  // Check for technical DB or ORM exception terms
  const isTechnicalError = /23502|DbUpdateException|NpgsqlException|Constraint|StackTrace|InnerException|SQL|column|violates/i.test(extractedMessage || '')
  if (isTechnicalError || !extractedMessage) {
    return 'Unable to create customer. Please review the entered information and try again.'
  }

  return extractedMessage
}

export const CustomersPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { showToast } = useNotificationStore()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { customerId } = useParams<{ customerId: string }>()

  // Permissions check based on specifications
  const userRoles = user?.roles || []
  const isOperator = userRoles.includes('Operator') && userRoles.length === 1
  const canWrite = !isOperator

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [customerTypeFilter, setCustomerTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Slide-over Drawer States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null)

  // View Modal State
  const [selectedCustomerForView, setSelectedCustomerForView] = useState<Customer | null>(null)
  const [activeTab, setActiveTab] = useState<'profile' | 'sales' | 'ledger' | 'jars' | 'payments' | 'docs'>('profile')

  // Print Preview Modal States
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [printDocData, setPrintDocData] = useState<any>(null)

  const handlePrintCustomerStatement = (customer: Customer) => {
    setPrintDocData({
      title: 'Customer Statement',
      docNumber: customer.customerCode || `CST-${customer.id.substring(0, 4).toUpperCase()}`,
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      partyLabel: 'Customer Info',
      partyInfo: {
        name: customer.customerName,
        details1: `Email: ${customer.email || 'N/A'} | Phone: ${customer.phone || 'N/A'}`,
        details2: `GST: ${customer.gstNumber || 'N/A'} | Address: ${customer.addressLine1 || '—'}`
      },
      preparedBy: 'Accounts Admin',
      paymentDetails: {
        method: 'Statement Record'
      },
      items: [
        {
          sno: 1,
          description: 'Opening Balance Ledger Entry',
          amount: Number(customer.openingBalance) || 0
        },
        {
          sno: 2,
          description: 'Current Outstandings & Sales',
          amount: customer.openingBalance || 0
        }
      ],
      financialSummary: {
        subTotal: (Number(customer.openingBalance) || 0) + (customer.openingBalance || 0),
        grandTotal: (Number(customer.openingBalance) || 0) + (customer.openingBalance || 0),
        amountPaid: Number(customer.openingBalance) || 0,
        balance: customer.openingBalance || 0
      },
      notes: 'This statement summarizes the outstanding balances and billing mapping for customer accounts.'
    });
    setPrintModalOpen(true);
  };

  // Debounced search logic
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setCurrentPage(1)
    }, 400)
    return () => clearTimeout(handler)
  }, [searchTerm])

  const [formTab, setFormTab] = useState<'general' | 'address' | 'financials' | 'logistics'>('general')

  // Form State
  const [formData, setFormData] = useState({
    customerType: 'B2C',
    customerName: '',
    businessName: '',
    contactPerson: '',
    phone: '',
    alternatePhone: '',
    email: '',
    gstNumber: '',
    panNumber: '',
    businessType: 'Proprietorship',
    gstState: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    district: '',
    state: '',
    country: 'India',
    pinCode: '',
    openingBalance: 0,
    balanceType: 'Zero',
    creditLimit: 0,
    paymentTerms: 'COD',
    status: 'Active',
    remarks: '',
    internalNotes: '',

    // Expanded Business Partner Profiles
    whatsApp: '',
    website: '',
    photoUrl: '',
    businessRegistration: '',
    businessCategory: '',
    industry: '',
    tradeLicense: '',
    taxExempt: false,
    addressesJson: '[]',

    // Financial Settings
    priceList: '',
    discountGroup: '',
    price: 0,
    discount: 0,
    taxCategory: '',
    outstandingPlaceholder: 0,
    ledgerPlaceholder: '',
    accountingPlaceholder: '',

    // Logistics/Distributor Profile details
    distributorType: '',
    commissionPercentage: 0,
    monthlySalary: 0,
    securityDeposit: 0,
    assignedRoute: '',
    assignedVehicle: '',
    assignedDriver: '',
    assignedSalesExecutive: '',
    defaultDeliveryPriority: 'Normal',
    workingArea: '',
    workingDays: '',

    // 20L Water Plant operations settings
    jarDeposit: 0,
    outstandingJars: 0,
    maxJarLimit: 0,
    reservedEmptyJars: 0,
    preferredJarBrand: '',
    preferredCapMaterial: '',
    sealRequired: false,
    preferredDeliveryWindow: '',
    emergencyDelivery: false,
    priorityCustomer: false,
    preferredProductsJson: '[]',
    preferredDeliveryTime: 'Morning',
    deliveryFrequency: 'Daily',
    contactsJson: '[]',
    documentsJson: '[]',
  })

  // Queries for Dropdowns
  const { data: brandsData, isLoading: isLoadingBrands } = useQuery({
    queryKey: ['brandsListForDropdown'],
    queryFn: () => brandService.getBrands(1, 200),
    staleTime: 5 * 60 * 1000 // Cache for 5 mins
  })

  const { data: materialsData, isLoading: isLoadingMaterials } = useQuery({
    queryKey: ['capMaterialsForDropdown'],
    queryFn: () => rawMaterialsService.getRawMaterials(1, 200),
  })

  const brandItems = React.useMemo(() => {
    return brandsData?.data?.items?.filter(b => b.isActive).map(b => ({ id: b.id, name: b.name })) || []
  }, [brandsData])

  const capItems = React.useMemo(() => {
    return materialsData?.data?.items
      ?.filter(m => m.isActive && (m.category === 'Cap Material' || m.category === 'Cap' || m.category?.toLowerCase().includes('cap')))
      .map(m => ({ id: m.id, name: m.name })) || []
  }, [materialsData])

  // Fetch paginated customers list
  const { data: customerData, isLoading, refetch } = useQuery({
    queryKey: [
      'customersList', 
      currentPage, 
      debouncedSearch, 
      customerTypeFilter, 
      statusFilter, 
      stateFilter, 
      cityFilter, 
      sortBy
    ],
    queryFn: async () => {
      const res = await customersService.getCustomers(
        currentPage,
        pageSize,
        debouncedSearch,
        customerTypeFilter,
        statusFilter,
        stateFilter,
        '', // District
        cityFilter,
        sortBy
      )
      return res.data
    }
  })

  // Distinct values for filters extracted from data or predefined for India ERP
  const indianStates = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 
    'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 
    'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 
    'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi'
  ]

  // Automatically open Customer Creation form when navigated from Sales modal
  useEffect(() => {
    if (location.state?.fromSales && canWrite) {
      handleOpenCreateDrawer()
    }
  }, [location.state, canWrite])

  // Create Customer Mutation
  const createCustomerMutation = useMutation({
    mutationFn: customersService.createCustomer,
    onSuccess: (data) => {
      if (data.success) {
        showToast(`Customer ${data.data?.customerCode || data.data?.customerName} created successfully.`, 'success')
        queryClient.invalidateQueries({ queryKey: ['customersList'] })
        queryClient.invalidateQueries({ queryKey: ['activeCustomersForSales'] })
        setIsDrawerOpen(false)
        resetForm()
        if (location.state?.fromSales) {
          navigate('/company/sales', {
            state: {
              fromCustomerCreation: true,
              newCreatedCustomerId: data.data?.id,
              salesForm: location.state.salesForm
            }
          })
        }
      } else {
        showToast(data.message || 'Failed to create customer.', 'error')
      }
    },
    onError: (err: any) => {
      const msg = parseErrorResponse(err)
      showToast(msg, 'error')
    }
  })

  // Update Customer Mutation
  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => customersService.updateCustomer(id, data),
    onSuccess: (data) => {
      if (data.success) {
        showToast('Customer updated successfully.', 'success')
        queryClient.invalidateQueries({ queryKey: ['customersList'] })
        queryClient.invalidateQueries({ queryKey: ['customerProfile'] })
        setIsDrawerOpen(false)
        resetForm()
      } else {
        showToast(data.message || 'Failed to update customer.', 'error')
      }
    },
    onError: (err: any) => {
      const msg = parseErrorResponse(err)
      showToast(msg, 'error')
    }
  })

  // Delete Customer Mutation (Soft Delete)
  const deleteCustomerMutation = useMutation({
    mutationFn: customersService.deleteCustomer,
    onSuccess: (data) => {
      if (data.success) {
        showToast('Customer deleted successfully (soft delete).', 'success')
        queryClient.invalidateQueries({ queryKey: ['customersList'] })
      } else {
        showToast(data.message || 'Failed to delete customer.', 'error')
      }
    },
    onError: (err: any) => {
      const msg = parseErrorResponse(err)
      showToast(msg, 'error')
    }
  })

  // Toggle Customer Active Status
  const toggleStatusMutation = useMutation({
    mutationFn: async (customer: Customer) => {
      const newStatus = customer.status === 'Active' ? 'Inactive' : 'Active'
      return customersService.updateCustomer(customer.id, {
        customerType: customer.customerType,
        customerName: customer.customerName,
        businessName: customer.businessName ?? undefined,
        contactPerson: customer.contactPerson ?? undefined,
        phone: customer.phone,
        alternatePhone: customer.alternatePhone ?? undefined,
        email: customer.email ?? undefined,
        gstNumber: customer.gstNumber ?? undefined,
        panNumber: customer.panNumber ?? undefined,
        businessType: customer.businessType ?? undefined,
        gstState: customer.gstState ?? undefined,
        addressLine1: customer.addressLine1,
        addressLine2: customer.addressLine2 ?? undefined,
        city: customer.city,
        district: customer.district,
        state: customer.state,
        country: customer.country,
        pinCode: customer.pinCode,
        openingBalance: customer.openingBalance,
        balanceType: customer.balanceType,
        creditLimit: customer.creditLimit,
        status: newStatus,
        isActive: newStatus === 'Active',
        remarks: customer.remarks ?? undefined
      })
    },
    onSuccess: () => {
      showToast('Customer status updated successfully.', 'success')
      queryClient.invalidateQueries({ queryKey: ['customersList'] })
      queryClient.invalidateQueries({ queryKey: ['customerProfile'] })
    },
    onError: (err: any) => {
      const msg = parseErrorResponse(err)
      showToast(msg, 'error')
    }
  })

  const resetForm = () => {
    setFormData({
      customerType: 'B2C',
      customerName: '',
      businessName: '',
      contactPerson: '',
      phone: '',
      alternatePhone: '',
      email: '',
      gstNumber: '',
      panNumber: '',
      businessType: 'Proprietorship',
      gstState: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      district: '',
      state: '',
      country: 'India',
      pinCode: '',
      openingBalance: 0,
      balanceType: 'Zero',
      creditLimit: 0,
      paymentTerms: 'COD',
      status: 'Active',
      remarks: '',
      internalNotes: '',

      whatsApp: '',
      website: '',
      photoUrl: '',
      businessRegistration: '',
      businessCategory: '',
      industry: '',
      tradeLicense: '',
      taxExempt: false,
      addressesJson: '[]',
      priceList: '',
      discountGroup: '',
      price: 0,
      discount: 0,
      taxCategory: '',
      outstandingPlaceholder: 0,
      ledgerPlaceholder: '',
      accountingPlaceholder: '',
      distributorType: '',
      commissionPercentage: 0,
      monthlySalary: 0,
      securityDeposit: 0,
      assignedRoute: '',
      assignedVehicle: '',
      assignedDriver: '',
      assignedSalesExecutive: '',
      defaultDeliveryPriority: 'Normal',
      workingArea: '',
      workingDays: '',
      jarDeposit: 0,
      outstandingJars: 0,
      maxJarLimit: 0,
      reservedEmptyJars: 0,
      preferredJarBrand: '',
      preferredCapMaterial: '',
      sealRequired: false,
      preferredDeliveryWindow: '',
      emergencyDelivery: false,
      priorityCustomer: false,
      preferredProductsJson: '[]',
      preferredDeliveryTime: 'Morning',
      deliveryFrequency: 'Daily',
      contactsJson: '[]',
      documentsJson: '[]',
    })
    setEditingCustomerId(null)
    setFormTab('general')
  }

  const handleOpenCreateDrawer = () => {
    if (!canWrite) return
    resetForm()
    setDrawerMode('create')
    setIsDrawerOpen(true)
  }

  const handleOpenEditDrawer = (customer: Customer) => {
    if (!canWrite) return
    setEditingCustomerId(customer.id)
    setDrawerMode('edit')
    setFormData({
      customerType: customer.customerType,
      customerName: customer.customerName,
      businessName: customer.businessName || '',
      contactPerson: customer.contactPerson || '',
      phone: customer.phone,
      alternatePhone: customer.alternatePhone || '',
      email: customer.email || '',
      gstNumber: customer.gstNumber || '',
      panNumber: customer.panNumber || '',
      businessType: customer.businessType || 'Proprietorship',
      gstState: customer.gstState || '',
      addressLine1: customer.addressLine1,
      addressLine2: customer.addressLine2 || '',
      city: customer.city,
      district: customer.district,
      state: customer.state,
      country: customer.country,
      pinCode: customer.pinCode,
      openingBalance: customer.openingBalance,
      balanceType: customer.balanceType,
      creditLimit: customer.creditLimit,
      paymentTerms: customer.paymentTerms || 'COD',
      status: customer.status,
      remarks: customer.remarks || '',
      internalNotes: '',

      whatsApp: customer.whatsApp || '',
      website: customer.website || '',
      photoUrl: customer.photoUrl || '',
      businessRegistration: customer.businessRegistration || '',
      businessCategory: customer.businessCategory || '',
      industry: customer.industry || '',
      tradeLicense: customer.tradeLicense || '',
      taxExempt: customer.taxExempt || false,
      addressesJson: customer.addressesJson || '[]',
      priceList: customer.priceList || '',
      discountGroup: customer.discountGroup || '',
      price: customer.price ?? 0,
      discount: customer.discount ?? 0,
      taxCategory: customer.taxCategory || '',
      outstandingPlaceholder: customer.outstandingPlaceholder || 0,
      ledgerPlaceholder: customer.ledgerPlaceholder || '',
      accountingPlaceholder: customer.accountingPlaceholder || '',
      distributorType: customer.distributorType || '',
      commissionPercentage: customer.commissionPercentage || 0,
      monthlySalary: customer.monthlySalary || 0,
      securityDeposit: customer.securityDeposit || 0,
      assignedRoute: customer.assignedRoute || '',
      assignedVehicle: customer.assignedVehicle || '',
      assignedDriver: customer.assignedDriver || '',
      assignedSalesExecutive: customer.assignedSalesExecutive || '',
      defaultDeliveryPriority: customer.defaultDeliveryPriority || 'Normal',
      workingArea: customer.workingArea || '',
      workingDays: customer.workingDays || '',
      jarDeposit: customer.jarDeposit || 0,
      outstandingJars: customer.outstandingJars || 0,
      maxJarLimit: customer.maxJarLimit || 0,
      reservedEmptyJars: customer.reservedEmptyJars || 0,
      preferredJarBrand: customer.preferredJarBrand || '',
      preferredCapMaterial: customer.preferredCapMaterial || '',
      sealRequired: customer.sealRequired || false,
      preferredDeliveryWindow: customer.preferredDeliveryWindow || '',
      emergencyDelivery: customer.emergencyDelivery || false,
      priorityCustomer: customer.priorityCustomer || false,
      preferredProductsJson: customer.preferredProductsJson || '[]',
      preferredDeliveryTime: customer.preferredDeliveryTime || 'Morning',
      deliveryFrequency: customer.deliveryFrequency || 'Daily',
      contactsJson: customer.contactsJson || '[]',
      documentsJson: customer.documentsJson || '[]',
    })
    setFormTab('general')
    setIsDrawerOpen(true)
  }

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Frontend validations
    if (!formData.customerName.trim()) {
      showToast('Customer Name is required.', 'warning')
      return
    }
    if (!formData.phone.trim()) {
      showToast('Phone number is required.', 'warning')
      return
    }
    if (!formData.customerType) {
      showToast('Customer Type is required.', 'warning')
      return
    }
    if (formData.openingBalance < 0) {
      showToast('Opening Balance cannot be negative.', 'warning')
      return
    }
    if (Number(formData.outstandingJars) < 0) {
      showToast('Outstanding jars cannot be negative.', 'warning')
      return
    }
    if (Number(formData.price) < 0) {
      showToast('Price cannot be negative.', 'warning')
      return
    }
    if (Number(formData.discount) < 0) {
      showToast('Discount cannot be negative.', 'warning')
      return
    }

    if (!formData.paymentTerms) {
      showToast('Please select Payment Terms.', 'warning')
      return
    }

    // Conditional B2B validation
    const isB2B = formData.customerType === 'B2B'
    if (isB2B) {
      if (!formData.gstNumber.trim()) {
        showToast('GST Number is required for B2B customers.', 'warning')
        return
      }
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
      if (!gstRegex.test(formData.gstNumber.trim().toUpperCase())) {
        showToast('Invalid GST Number format.', 'warning')
        return
      }
      if (!formData.gstState) {
        showToast('GST Registered State is required for B2B customers.', 'warning')
        return
      }
      if (!formData.panNumber.trim()) {
        showToast('PAN Number is required for B2B customers.', 'warning')
        return
      }
    }

    // Map remarks with internal notes for archiving
    const notesCombined = formData.internalNotes.trim() 
      ? `${formData.remarks.trim()}\n[Internal Notes: ${formData.internalNotes.trim()}]`
      : formData.remarks.trim()

    // Tenant configuration company lookup: use the current user's default company context or Guid.Empty
    const activeCompanyId = user?.tenantId || '00000000-0000-0000-0000-000000000000'

    if (drawerMode === 'create') {
      createCustomerMutation.mutate({
        companyId: activeCompanyId,
        customerType: formData.customerType,
        customerName: formData.customerName.trim(),
        businessName: isB2B ? formData.businessName.trim() : (formData.businessName.trim() || undefined),
        contactPerson: formData.contactPerson.trim() || undefined,
        phone: formData.phone.trim(),
        alternatePhone: formData.alternatePhone.trim() || undefined,
        email: formData.email.trim() || undefined,
        gstNumber: isB2B ? formData.gstNumber.trim().toUpperCase() : undefined,
        panNumber: formData.panNumber.trim() ? formData.panNumber.trim().toUpperCase() : undefined,
        businessType: isB2B ? formData.businessType : undefined,
        gstState: isB2B ? formData.gstState : undefined,
        addressLine1: formData.addressLine1.trim(),
        addressLine2: formData.addressLine2.trim() || undefined,
        city: formData.city.trim(),
        district: formData.district.trim(),
        state: formData.state.trim(),
        country: formData.country.trim(),
        pinCode: formData.pinCode.trim(),
        openingBalance: Number(formData.openingBalance),
        balanceType: formData.balanceType,
        creditLimit: Number(formData.creditLimit),
        paymentTerms: formData.paymentTerms,
        status: formData.status,
        isActive: formData.status === 'Active',
        remarks: notesCombined || undefined,

        whatsApp: formData.whatsApp.trim() || undefined,
        website: formData.website.trim() || undefined,
        photoUrl: formData.photoUrl.trim() || undefined,
        businessRegistration: formData.businessRegistration.trim() || undefined,
        businessCategory: formData.businessCategory.trim() || undefined,
        industry: formData.industry.trim() || undefined,
        tradeLicense: formData.tradeLicense.trim() || undefined,
        taxExempt: Boolean(formData.taxExempt),
        addressesJson: formData.addressesJson,
        priceList: formData.priceList.trim() || undefined,
        discountGroup: formData.discountGroup.trim() || undefined,
        price: Number(formData.price) || 0,
        discount: Number(formData.discount) || 0,
        taxCategory: formData.taxCategory.trim() || undefined,
        outstandingPlaceholder: Number(formData.outstandingPlaceholder),
        ledgerPlaceholder: formData.ledgerPlaceholder.trim() || undefined,
        accountingPlaceholder: formData.accountingPlaceholder.trim() || undefined,
        distributorType: formData.distributorType.trim() || undefined,
        commissionPercentage: Number(formData.commissionPercentage),
        monthlySalary: Number(formData.monthlySalary),
        securityDeposit: Number(formData.securityDeposit),
        assignedRoute: formData.assignedRoute.trim() || undefined,
        assignedVehicle: formData.assignedVehicle.trim() || undefined,
        assignedDriver: formData.assignedDriver.trim() || undefined,
        assignedSalesExecutive: formData.assignedSalesExecutive.trim() || undefined,
        defaultDeliveryPriority: formData.defaultDeliveryPriority || 'Normal',
        workingArea: formData.workingArea.trim() || undefined,
        workingDays: formData.workingDays.trim() || undefined,
        jarDeposit: Number(formData.jarDeposit),
        outstandingJars: Number(formData.outstandingJars),
        maxJarLimit: Number(formData.maxJarLimit),
        reservedEmptyJars: Number(formData.reservedEmptyJars),
        preferredJarBrand: formData.preferredJarBrand.trim() || undefined,
        preferredCapMaterial: formData.preferredCapMaterial.trim() || undefined,
        sealRequired: Boolean(formData.sealRequired),
        preferredDeliveryWindow: formData.preferredDeliveryWindow.trim() || undefined,
        emergencyDelivery: Boolean(formData.emergencyDelivery),
        priorityCustomer: Boolean(formData.priorityCustomer),
        preferredProductsJson: formData.preferredProductsJson,
        preferredDeliveryTime: formData.preferredDeliveryTime || 'Morning',
        deliveryFrequency: formData.deliveryFrequency || 'Daily',
        contactsJson: formData.contactsJson,
        documentsJson: formData.documentsJson
      })
    } else if (drawerMode === 'edit' && editingCustomerId) {
      updateCustomerMutation.mutate({
        id: editingCustomerId,
        data: {
          customerType: formData.customerType,
          customerName: formData.customerName.trim(),
          businessName: isB2B ? formData.businessName.trim() : (formData.businessName.trim() || undefined),
          contactPerson: formData.contactPerson.trim() || undefined,
          phone: formData.phone.trim(),
          alternatePhone: formData.alternatePhone.trim() || undefined,
          email: formData.email.trim() || undefined,
          gstNumber: isB2B ? formData.gstNumber.trim().toUpperCase() : undefined,
          panNumber: formData.panNumber.trim() ? formData.panNumber.trim().toUpperCase() : undefined,
          businessType: isB2B ? formData.businessType : undefined,
          gstState: isB2B ? formData.gstState : undefined,
          addressLine1: formData.addressLine1.trim(),
          addressLine2: formData.addressLine2.trim() || undefined,
          city: formData.city.trim(),
          district: formData.district.trim(),
          state: formData.state.trim(),
          country: formData.country.trim(),
          pinCode: formData.pinCode.trim(),
          openingBalance: Number(formData.openingBalance),
          balanceType: formData.balanceType,
          creditLimit: Number(formData.creditLimit),
          paymentTerms: formData.paymentTerms,
          status: formData.status,
          isActive: formData.status === 'Active',
          remarks: notesCombined || undefined,

          whatsApp: formData.whatsApp.trim() || undefined,
          website: formData.website.trim() || undefined,
          photoUrl: formData.photoUrl.trim() || undefined,
          businessRegistration: formData.businessRegistration.trim() || undefined,
          businessCategory: formData.businessCategory.trim() || undefined,
          industry: formData.industry.trim() || undefined,
          tradeLicense: formData.tradeLicense.trim() || undefined,
          taxExempt: Boolean(formData.taxExempt),
          addressesJson: formData.addressesJson,
          priceList: formData.priceList.trim() || undefined,
          discountGroup: formData.discountGroup.trim() || undefined,
          price: Number(formData.price) || 0,
          discount: Number(formData.discount) || 0,
          taxCategory: formData.taxCategory.trim() || undefined,
          outstandingPlaceholder: Number(formData.outstandingPlaceholder),
          ledgerPlaceholder: formData.ledgerPlaceholder.trim() || undefined,
          accountingPlaceholder: formData.accountingPlaceholder.trim() || undefined,
          distributorType: formData.distributorType.trim() || undefined,
          commissionPercentage: Number(formData.commissionPercentage),
          monthlySalary: Number(formData.monthlySalary),
          securityDeposit: Number(formData.securityDeposit),
          assignedRoute: formData.assignedRoute.trim() || undefined,
          assignedVehicle: formData.assignedVehicle.trim() || undefined,
          assignedDriver: formData.assignedDriver.trim() || undefined,
          assignedSalesExecutive: formData.assignedSalesExecutive.trim() || undefined,
          defaultDeliveryPriority: formData.defaultDeliveryPriority || 'Normal',
          workingArea: formData.workingArea.trim() || undefined,
          workingDays: formData.workingDays.trim() || undefined,
          jarDeposit: Number(formData.jarDeposit),
          outstandingJars: Number(formData.outstandingJars),
          maxJarLimit: Number(formData.maxJarLimit),
          reservedEmptyJars: Number(formData.reservedEmptyJars),
          preferredJarBrand: formData.preferredJarBrand.trim() || undefined,
          preferredCapMaterial: formData.preferredCapMaterial.trim() || undefined,
          sealRequired: Boolean(formData.sealRequired),
          preferredDeliveryWindow: formData.preferredDeliveryWindow.trim() || undefined,
          emergencyDelivery: Boolean(formData.emergencyDelivery),
          priorityCustomer: Boolean(formData.priorityCustomer),
          preferredProductsJson: formData.preferredProductsJson,
          preferredDeliveryTime: formData.preferredDeliveryTime || 'Morning',
          deliveryFrequency: formData.deliveryFrequency || 'Daily',
          contactsJson: formData.contactsJson,
          documentsJson: formData.documentsJson
        }
      })
    }
  }

  const handleDeleteCustomer = (customer: Customer) => {
    if (!canWrite) return
    if (confirm(`Are you sure you want to delete customer "${customer.customerName}" (${customer.customerCode})? This is a soft delete only.`)) {
      deleteCustomerMutation.mutate(customer.id)
    }
  }

  const handleToggleActive = (customer: Customer) => {
    if (!canWrite) return
    toggleStatusMutation.mutate(customer)
  }

  const totalPages = customerData?.totalPages || 0
  const customers = customerData?.items || []

  if (customerId) {
    return (
      <CustomerProfilePage 
        customerId={customerId} 
        onEditCustomer={handleOpenEditDrawer} 
      />
    )
  }

  return (
    <PageContainer>
      <PageHeader
        title="Customers"
        description="Single source of truth for all customer profiles across Sales and 20L Operations."
        actions={
          canWrite && (
            <button
              onClick={handleOpenCreateDrawer}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Partner</span>
            </button>
          )
        }
      />

      {/* Filter Bar */}
      <FilterBar>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name, business name or phone"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 h-9 border border-slate-200 rounded-lg bg-white text-slate-900 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={customerTypeFilter}
            onChange={(e) => { setCustomerTypeFilter(e.target.value); setCurrentPage(1); }}
            className="h-[32px] px-3 border border-[#E5E7EB] rounded-lg bg-white text-[12px] text-slate-700 font-semibold focus:outline-none cursor-pointer"
          >
            <option value="">All Partner Types</option>
            <option value="B2B">B2B Partners</option>
            <option value="B2C">B2C Partners</option>
            <option value="Distributor">Distributors</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="h-[32px] px-3 border border-[#E5E7EB] rounded-lg bg-white text-[12px] text-slate-700 font-semibold focus:outline-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          {/* Sorting */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-[32px] px-3 border border-[#E5E7EB] rounded-lg bg-white text-[12px] text-slate-700 font-semibold focus:outline-none cursor-pointer"
          >
            <option value="newest">Newest Created</option>
            <option value="oldest">Oldest Created</option>
            <option value="name">Customer Name</option>
            <option value="balance">Highest Balance</option>
          </select>

          <button
            onClick={() => showToast('Export action triggered (mock Excel extraction).', 'info')}
            className="h-[32px] px-3 border border-[#E5E7EB] rounded-lg bg-white text-slate-600 hover:bg-slate-50 text-[12px] font-bold transition-all cursor-pointer"
          >
            Export
          </button>
        </div>
      </FilterBar>

      {/* Main Content Table Area */}
      {isLoading ? (
        <div className="bg-white border border-[#E5E7EB] shadow-sm rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-[13px] font-medium text-slate-500">Querying Customer Database...</span>
        </div>
      ) : customers.length > 0 ? (
        <div className="bg-white border border-[#E5E7EB] shadow-sm rounded-xl overflow-hidden flex flex-col">
          
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none h-[36px]">
                  <th className="py-2 px-4">Partner Name</th>
                  <th className="py-2 px-4">Business Name</th>
                  <th className="py-2 px-4">Type</th>
                  <th className="py-2 px-4">Phone</th>
                  <th className="py-2 px-4 text-center">Status</th>
                  <th className="py-2 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] text-[13px] text-slate-700">
                {customers.map((c, i) => (
                  <tr 
                    key={c.id} 
                    className={`h-[38px] transition-colors ${i%2===0?'bg-white':'bg-[#FAFBFC]'} hover:bg-blue-50/30`}
                  >
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {c.customerName}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {c.businessName || <span className="text-slate-300 italic text-[11px]">—</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        c.customerType === 'B2B' 
                          ? 'bg-[#DBEAFE] text-[#2563EB]' 
                          : c.customerType === 'Distributor'
                          ? 'bg-[#F3E8FF] text-[#7E22CE]'
                          : 'bg-[#DCFCE7] text-[#16A34A]'
                      }`}>
                        {c.customerType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      {c.phone}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleToggleActive(c)}
                        disabled={!canWrite}
                        className={`inline-flex rounded-full text-[11px] font-bold px-2 py-0.5 select-none transition-opacity ${
                          c.status === 'Active' 
                            ? 'bg-[#DCFCE7] text-[#16A34A]' 
                            : 'bg-[#FEE2E2] text-[#DC2626]'
                        } ${canWrite ? 'hover:opacity-80 cursor-pointer' : 'cursor-not-allowed'}`}
                      >
                        {c.status}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex gap-1.5 justify-end">
                        {/* VIEW */}
                        <button 
                          onClick={() => navigate(`/company/customers/profile/${c.id}`)}
                          className="p-1 hover:bg-slate-50 hover:text-slate-700 text-slate-500 rounded transition-colors cursor-pointer"
                          title="View Profile Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* EDIT */}
                        {canWrite && (
                          <button 
                            onClick={() => handleOpenEditDrawer(c)}
                            className="p-1 hover:bg-slate-50 hover:text-slate-700 text-slate-500 rounded transition-colors cursor-pointer"
                            title="Edit Customer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* PRINT */}
                        <button 
                          onClick={() => handlePrintCustomerStatement(c)}
                          className="p-1 hover:bg-slate-50 hover:text-slate-700 text-slate-500 rounded transition-colors cursor-pointer"
                          title="Print Customer Statement"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>

                        {/* DELETE */}
                        {canWrite && (
                          <button 
                            onClick={() => handleDeleteCustomer(c)}
                            className="p-1 hover:bg-slate-50 hover:text-rose-700 text-rose-500 rounded transition-colors cursor-pointer"
                            title="Delete Customer"
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

          {/* Table Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-[#E2E8F0] flex items-center justify-between text-xs select-none bg-white">
              <span className="text-slate-400 font-medium">Page {currentPage} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  className="flex items-center gap-1 px-3 py-1.5 border border-[#E2E8F0] rounded-[8px] bg-white hover:bg-slate-50 font-bold text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="flex items-center gap-1 px-3 py-1.5 border border-[#E2E8F0] rounded-[8px] bg-white hover:bg-slate-50 font-bold text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-[12px] p-12 text-center max-w-md mx-auto">
          <AlertTriangle className="w-10 h-10 text-slate-300 mx-auto mb-4" />
          <h3 className="text-sm font-bold text-slate-800">No Customers Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            Clear your filtering conditions or register a new customer to build your master registry.
          </p>
          {canWrite && (
            <button
              onClick={handleOpenCreateDrawer}
              className="mt-4 px-4 py-2 bg-[#1A56DB] hover:bg-[#1E40AF] text-white text-xs font-semibold rounded-[8px] cursor-pointer"
            >
              Add First Customer
            </button>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* SLIDE-OVER DRAWER (Create / Edit form) */}
      {/* ======================================================== */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden select-none">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-xs transition-opacity" onClick={() => setIsDrawerOpen(false)} />
          
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-xl bg-white border-l border-[#E2E8F0] shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-250">
              
              {/* Drawer Header */}
              <div className="px-8 py-5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
                <div>
                  <h3 className="text-[20px] font-semibold text-gray-900 tracking-tight">
                    {drawerMode === 'create' ? 'Register New Customer' : `Modify Customer Settings`}
                  </h3>
                  <p className="text-[12px] text-gray-400 mt-1 font-medium">
                    {drawerMode === 'create' ? 'Generates an auto-incremented business partner code suffix' : 'Partner ID code is read-only'}
                  </p>
                </div>
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 rounded-[8px] text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tab Selector */}
              <div className="flex border-b border-[#E2E8F0] px-8 bg-[#F8FAFC]">
                {(['general', 'address', 'financials', 'logistics'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFormTab(tab)}
                    className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-[2px] transition-colors cursor-pointer ${
                      formTab === tab
                        ? 'border-[#1A56DB] text-[#1A56DB]'
                        : 'border-transparent text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Drawer Scrollable Body Form */}
              <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
                
                {formTab === 'general' && (
                  <GeneralTab formData={formData} handleFormChange={handleFormChange} />
                )}

                {formTab === 'address' && (
                  <AddressTab formData={formData} handleFormChange={handleFormChange} indianStates={indianStates} />
                )}

                {formTab === 'financials' && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <PremiumSectionHeading title="Financial Setup & GST Registry" />
                    
                    <div className="grid grid-cols-1 gap-5">
                      <PremiumInput
                        label={formData.customerType === 'B2B' ? "PAN Card Number *" : "PAN Card Number"}
                        name="panNumber"
                        value={formData.panNumber}
                        onChange={handleFormChange}
                        placeholder="e.g. ABCDE1234F"
                        required={formData.customerType === 'B2B'}
                      />
                    </div>

                    {formData.customerType === 'B2B' && (
                      <div className="space-y-5 animate-in slide-in-from-top duration-200">
                        <div className="grid grid-cols-2 gap-5">
                          <PremiumInput
                            label="GST Number *"
                            name="gstNumber"
                            value={formData.gstNumber}
                            onChange={handleFormChange}
                            placeholder="e.g. 27ABCDE1234F1Z5"
                            required
                          />
                          <PremiumSelect
                            label="GST Registered State *"
                            name="gstState"
                            value={formData.gstState}
                            onChange={handleFormChange}
                            required
                          >
                            <option value="">Select Registered State</option>
                            {indianStates.map(state => (
                              <option key={state} value={state}>{state}</option>
                            ))}
                          </PremiumSelect>
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                          <PremiumInput
                            label="Trade License Number"
                            name="tradeLicense"
                            value={formData.tradeLicense}
                            onChange={handleFormChange}
                            placeholder="e.g. LIC/2026/001"
                          />
                          <PremiumSelect
                            label="Tax Status"
                            name="taxExempt"
                            value={formData.taxExempt ? 'true' : 'false'}
                            onChange={(e) => setFormData(prev => ({ ...prev, taxExempt: e.target.value === 'true' }))}
                          >
                            <option value="false">Taxable Partner</option>
                            <option value="true">Tax Exempt Partner</option>
                          </PremiumSelect>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-5">
                      <PremiumSelect
                        label="Balance Type *"
                        name="balanceType"
                        value={formData.balanceType}
                        onChange={handleFormChange}
                        required
                      >
                        <option value="Zero">Zero Balance</option>
                        <option value="Receivable">Receivable (Debit)</option>
                        <option value="Payable">Payable (Credit)</option>
                      </PremiumSelect>

                      <PremiumInput
                        label="Credit Limit (INR)"
                        name="creditLimit"
                        type="number"
                        step="1"
                        value={formData.creditLimit}
                        onChange={handleFormChange}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <PremiumSelect
                        label="Payment Terms *"
                        name="paymentTerms"
                        value={formData.paymentTerms}
                        onChange={handleFormChange}
                        required
                      >
                        <option value="COD">Cash on Delivery (COD)</option>
                        <option value="Net 7">Net 7 Days</option>
                        <option value="Net 15">Net 15 Days</option>
                        <option value="Net 30">Net 30 Days</option>
                        <option value="Net 60">Net 60 Days</option>
                        <option value="Due on Receipt">Due on Receipt</option>
                      </PremiumSelect>
                      
                      <PremiumSelect
                        label="Operations Status *"
                        name="status"
                        value={formData.status}
                        onChange={handleFormChange}
                        required
                      >
                        <option value="Active">Active Registry</option>
                        <option value="Inactive">Inactive Registry</option>
                      </PremiumSelect>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <PremiumInput
                        label="Price"
                        name="price"
                        type="number"
                        min={0}
                        step="any"
                        value={formData.price}
                        onChange={(e: any) => {
                          const val = parseFloat(e.target.value);
                          const finalVal = isNaN(val) ? 0 : val;
                          if (finalVal < 0) {
                            showToast('Price cannot be negative.', 'warning');
                          }
                          handleFormChange({
                            target: { name: 'price', value: finalVal < 0 ? 0 : finalVal }
                          } as any);
                        }}
                        placeholder="Enter price"
                      />
                      <PremiumInput
                        label="Discount"
                        name="discount"
                        type="number"
                        min={0}
                        step="any"
                        value={formData.discount}
                        onChange={(e: any) => {
                          const val = parseFloat(e.target.value);
                          const finalVal = isNaN(val) ? 0 : val;
                          if (finalVal < 0) {
                            showToast('Discount cannot be negative.', 'warning');
                          }
                          handleFormChange({
                            target: { name: 'discount', value: finalVal < 0 ? 0 : finalVal }
                          } as any);
                        }}
                        placeholder="Enter discount"
                      />
                    </div>

                    <PremiumInput
                      label="Tax Category"
                      name="taxCategory"
                      value={formData.taxCategory}
                      onChange={handleFormChange}
                      placeholder="e.g. GST_18"
                    />
                  </div>
                )}

                {formTab === 'logistics' && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <PremiumSectionHeading title="Distributor Settings & Jar Operations (20L Water Plant)" />
                    
                    {formData.customerType === 'Distributor' && (
                      <div className="p-4 bg-blue-50 border border-blue-100 rounded-[10px] space-y-4 animate-in slide-in-from-top duration-150 text-left">
                        <h5 className="text-[13px] font-semibold text-blue-900">Distributor Profile Details</h5>
                        <div className="grid grid-cols-2 gap-5">
                          <PremiumSelect
                            label="Distributor Type"
                            name="distributorType"
                            value={formData.distributorType}
                            onChange={handleFormChange}
                          >
                            <option value="">Select Type</option>
                            <option value="Company Owned">Company Owned (Employee)</option>
                            <option value="Commission">Commission Agent</option>
                            <option value="Salary">Salary Based</option>
                            <option value="Independent">Independent Operator</option>
                          </PremiumSelect>
                          <PremiumInput
                            label="Commission Percentage (%)"
                            name="commissionPercentage"
                            type="number"
                            step="0.1"
                            value={formData.commissionPercentage}
                            onChange={handleFormChange}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-5">
                          <PremiumInput
                            label="Monthly Salary (INR)"
                            name="monthlySalary"
                            type="number"
                            value={formData.monthlySalary}
                            onChange={handleFormChange}
                          />
                          <PremiumInput
                            label="Security Deposit (INR)"
                            name="securityDeposit"
                            type="number"
                            value={formData.securityDeposit}
                            onChange={handleFormChange}
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-5">
                      <PremiumInput
                        label="Assigned Delivery Route"
                        name="assignedRoute"
                        value={formData.assignedRoute}
                        onChange={handleFormChange}
                        placeholder="e.g. Route 4 (Downtown)"
                      />
                      <PremiumInput
                        label="Assigned Vehicle Number"
                        name="assignedVehicle"
                        value={formData.assignedVehicle}
                        onChange={handleFormChange}
                        placeholder="e.g. MH-12-PQ-9876"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <PremiumInput
                        label="Assigned Driver Name"
                        name="assignedDriver"
                        value={formData.assignedDriver}
                        onChange={handleFormChange}
                        placeholder="Driver Name"
                      />
                      <PremiumInput
                        label="Assigned Sales Executive"
                        name="assignedSalesExecutive"
                        value={formData.assignedSalesExecutive}
                        onChange={handleFormChange}
                        placeholder="Sales Exec Name"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-5">
                      <PremiumSelect
                        label="Default Delivery Priority"
                        name="defaultDeliveryPriority"
                        value={formData.defaultDeliveryPriority}
                        onChange={handleFormChange}
                      >
                        <option value="Low">Low Priority</option>
                        <option value="Normal">Normal Priority</option>
                        <option value="High">High Priority</option>
                        <option value="Critical">Critical Priority</option>
                      </PremiumSelect>
                    </div>

                    <div className="grid grid-cols-1 gap-5">
                      <PremiumSelect
                        label="Seal Inspection Required?"
                        name="sealRequired"
                        value={formData.sealRequired ? 'true' : 'false'}
                        onChange={(e) => setFormData(prev => ({ ...prev, sealRequired: e.target.value === 'true' }))}
                      >
                        <option value="false">No (Standard jars)</option>
                        <option value="true">Yes (Hygienic double seals)</option>
                      </PremiumSelect>
                    </div>

                    <div className="p-4 bg-[#F8FAFC] border border-gray-200 rounded-[10px] space-y-4 text-left">
                      <h5 className="text-[13px] font-semibold text-gray-800">20L Jar Inventory Settings</h5>
                      
                      <div className="grid grid-cols-1 gap-4">
                        <PremiumInput
                          label="Max Jar Limit"
                          name="maxJarLimit"
                          type="number"
                          value={formData.maxJarLimit}
                          onChange={handleFormChange}
                        />
                        <PremiumInput
                          label="Reserved Empty Jars"
                          name="reservedEmptyJars"
                          type="number"
                          value={formData.reservedEmptyJars}
                          onChange={(e: any) => {
                            const val = parseInt(e.target.value);
                            handleFormChange({
                              target: { name: 'reservedEmptyJars', value: isNaN(val) || val < 0 ? 0 : val }
                            } as any);
                          }}
                          helpText="Current reserved empty jars available for this customer."
                        />
                        <PremiumInput
                          label="Outstanding Jars"
                          name="outstandingJars"
                          type="number"
                          min={0}
                          value={formData.outstandingJars}
                          onChange={(e: any) => {
                            const val = parseInt(e.target.value);
                            const finalVal = isNaN(val) ? 0 : val;
                            if (finalVal < 0) {
                              showToast('Outstanding jars cannot be negative.', 'warning');
                            }
                            handleFormChange({
                              target: { name: 'outstandingJars', value: finalVal < 0 ? 0 : finalVal }
                            } as any);
                          }}
                          helpText="Current number of 20L jars physically held by customer and expected to be returned."
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <SearchableDropdown
                          label="Preferred Jar Brand"
                          value={formData.preferredJarBrand}
                          onChange={(val) => setFormData(prev => ({ ...prev, preferredJarBrand: val }))}
                          items={brandItems}
                          placeholder="Search & Select Jar Brand"
                          isLoading={isLoadingBrands}
                        />
                        <SearchableDropdown
                          label="Preferred Cap Material"
                          value={formData.preferredCapMaterial}
                          onChange={(val) => setFormData(prev => ({ ...prev, preferredCapMaterial: val }))}
                          items={capItems}
                          placeholder="Search & Select Cap Material"
                          isLoading={isLoadingMaterials}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <PremiumSelect
                          label="Delivery Frequency"
                          name="deliveryFrequency"
                          value={formData.deliveryFrequency}
                          onChange={handleFormChange}
                        >
                          <option value="Daily">Daily</option>
                          <option value="Alternate Day">Alternate Day</option>
                          <option value="Weekly">Weekly</option>
                          <option value="On Demand">On Demand</option>
                        </PremiumSelect>
                      </div>

                      <div className="flex gap-6 pt-2">
                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            name="emergencyDelivery"
                            checked={formData.emergencyDelivery}
                            onChange={(e) => setFormData(prev => ({ ...prev, emergencyDelivery: e.target.checked }))}
                            className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                          />
                          <span>Allow Emergency/Express Deliveries</span>
                        </label>

                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            name="priorityCustomer"
                            checked={formData.priorityCustomer}
                            onChange={(e) => setFormData(prev => ({ ...prev, priorityCustomer: e.target.checked }))}
                            className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                          />
                          <span>Mark as Priority Business Partner</span>
                        </label>
                      </div>
                    </div>


                  </div>
                )}

                {formTab !== 'general' && (
                  <div className="pt-4 border-t border-gray-100 space-y-4 text-left">
                    <PremiumTextarea
                      label="Remark"
                      name="remarks"
                      rows={2}
                      value={formData.remarks}
                      onChange={handleFormChange}
                      placeholder="Add any remarks or notes..."
                    />
                  </div>
                )}

              </form>

              {/* Drawer Action Footer */}
              <div className="px-8 py-5 border-t border-[#E2E8F0] flex gap-3 justify-end bg-[#F8FAFC] select-none">
                {formTab !== 'general' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (formTab === 'logistics') setFormTab('financials')
                      else if (formTab === 'financials') setFormTab('address')
                      else if (formTab === 'address') setFormTab('general')
                    }}
                    className="h-[44px] px-5 border border-gray-300 hover:border-gray-400 rounded-[10px] bg-white text-gray-700 hover:bg-gray-50 text-sm font-semibold select-none cursor-pointer transition-all duration-150 active:scale-[0.99]"
                  >
                    Back
                  </button>
                )}
                {formTab !== 'logistics' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (formTab === 'general') setFormTab('address')
                      else if (formTab === 'address') setFormTab('financials')
                      else if (formTab === 'financials') setFormTab('logistics')
                    }}
                    className="h-[44px] px-5 border border-gray-300 hover:border-gray-400 rounded-[10px] bg-white text-gray-700 hover:bg-gray-50 text-sm font-semibold select-none cursor-pointer transition-all duration-150 active:scale-[0.99]"
                  >
                    Next Tab
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleFormSubmit}
                  disabled={createCustomerMutation.isPending || updateCustomerMutation.isPending}
                  className="h-[44px] px-6 bg-[#1A56DB] hover:bg-[#1E40AF] active:bg-[#123E97] text-white text-sm font-semibold rounded-[10px] shadow-sm select-none cursor-pointer transition-all duration-150 active:scale-[0.99] disabled:opacity-50 flex items-center gap-2"
                >
                  {(createCustomerMutation.isPending || updateCustomerMutation.isPending) ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{drawerMode === 'create' ? 'Register Customer' : 'Save Changes'}</span>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* PRINT PREVIEW MODAL */}
      {printModalOpen && printDocData && (
        <PrintPreviewModal
          isOpen={printModalOpen}
          onClose={() => {
            setPrintModalOpen(false)
            setPrintDocData(null)
          }}
          documentData={printDocData}
        />
      )}
    </PageContainer>
  )
}

export default CustomersPage
