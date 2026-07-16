import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Search, Plus, Eye, Edit2, Trash2, X, AlertTriangle, 
  MapPin, Phone as PhoneIcon, FileText, Landmark, ShieldAlert,
  ArrowUpDown, Filter, ChevronLeft, ChevronRight, CheckCircle2, XCircle
} from 'lucide-react'
import { customersService } from '../../services/customers'
import type { Customer } from '../../services/customers'
import { useNotificationStore } from '../../store/useNotificationStore'
import { useAuthStore } from '../../store/useAuthStore'
import EnterpriseHeader from '../../components/ui/EnterpriseHeader'
import EnterpriseBadge from '../../components/ui/EnterpriseBadge'
import EnterpriseInput from '../../components/ui/EnterpriseInput'
import EnterpriseSelect from '../../components/ui/EnterpriseSelect'
import EnterpriseButton from '../../components/ui/EnterpriseButton'
import EnterpriseModal from '../../components/ui/EnterpriseModal'
import { CustomerProfilePage } from './CustomerProfilePage'

// Premium theme components for a clean, Vercel/Stripe-like SaaS ERP styling
const PremiumLabel: React.FC<{ label: string; required?: boolean }> = ({ label, required }) => {
  const hasAsterisk = required || label.endsWith('*');
  const cleanLabel = hasAsterisk ? label.replace('*', '').trim() : label;
  
  return (
    <label className="text-[13px] font-semibold text-gray-700 select-none mb-1.5 flex items-center">
      <span>{cleanLabel}</span>
      {hasAsterisk && <span className="text-[#F04438] ml-1 font-bold text-xs select-none">*</span>}
    </label>
  );
};

interface PremiumInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const PremiumInput: React.FC<PremiumInputProps> = ({ label, error, required, className = '', ...props }) => {
  return (
    <div className="flex flex-col w-full text-left">
      <PremiumLabel label={label} required={required} />
      <input
        className={`w-full h-[44px] px-3.5 border text-[14px] text-gray-900 bg-white placeholder-gray-400 rounded-[10px] transition-all duration-150 focus:outline-none focus:border-[#1A56DB] focus:ring-4 focus:ring-blue-100/50 hover:border-gray-300 disabled:bg-gray-50 disabled:text-gray-400 ${
          error ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-100' : 'border-gray-200'
        } ${className}`}
        {...props}
      />
      {error && <span className="text-xs font-medium text-red-500 mt-1">{error}</span>}
    </div>
  );
};

interface PremiumSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
}

const PremiumSelect: React.FC<PremiumSelectProps> = ({ label, children, error, required, className = '', ...props }) => {
  return (
    <div className="flex flex-col w-full text-left">
      <PremiumLabel label={label} required={required} />
      <div className="relative">
        <select
          className={`w-full h-[44px] px-3.5 pr-10 border text-[14px] text-gray-900 bg-white rounded-[10px] transition-all duration-150 focus:outline-none focus:border-[#1A56DB] focus:ring-4 focus:ring-blue-100/50 hover:border-gray-300 disabled:bg-gray-50 disabled:text-gray-400 appearance-none cursor-pointer ${
            error ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-100' : 'border-gray-200'
          } ${className}`}
          {...props}
        >
          {children}
        </select>
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error && <span className="text-xs font-medium text-red-500 mt-1">{error}</span>}
    </div>
  );
};

interface PremiumTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

const PremiumTextarea: React.FC<PremiumTextareaProps> = ({ label, error, required, className = '', ...props }) => {
  return (
    <div className="flex flex-col w-full text-left">
      <PremiumLabel label={label} required={required} />
      <textarea
        className={`w-full p-3.5 border text-[14px] text-gray-900 bg-white placeholder-gray-400 rounded-[10px] transition-all duration-150 focus:outline-none focus:border-[#1A56DB] focus:ring-4 focus:ring-blue-100/50 hover:border-gray-300 disabled:bg-gray-50 disabled:text-gray-400 ${
          error ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-100' : 'border-gray-200'
        } ${className}`}
        {...props}
      />
      {error && <span className="text-xs font-medium text-red-500 mt-1">{error}</span>}
    </div>
  );
};

const PremiumSectionHeading: React.FC<{ title: string }> = ({ title }) => {
  return (
    <div className="pt-2 pb-1.5 border-b border-gray-100 mb-4 select-none">
      <h4 className="text-[15px] font-semibold text-gray-800 tracking-tight">
        {title}
      </h4>
    </div>
  );
};

const parseErrorResponse = (err: any): string => {
  const data = err.response?.data
  if (!data) return 'Error occurred.'
  
  if (data.errors && typeof data.errors === 'object') {
    const errorList: string[] = []
    Object.entries(data.errors).forEach(([_, val]) => {
      if (Array.isArray(val)) {
        errorList.push(...val)
      } else if (typeof val === 'string') {
        errorList.push(val)
      }
    })
    if (errorList.length > 0) {
      return errorList.join(', ')
    }
  }
  
  return data.message || data.title || 'Error occurred.'
}

export const CustomersPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { showToast } = useNotificationStore()
  const { user } = useAuthStore()
  const navigate = useNavigate()
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

  // Debounced search logic
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setCurrentPage(1)
    }, 400)
    return () => clearTimeout(handler)
  }, [searchTerm])

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
    internalNotes: ''
  })

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

  // Create Customer Mutation
  const createCustomerMutation = useMutation({
    mutationFn: customersService.createCustomer,
    onSuccess: (data) => {
      if (data.success) {
        showToast(`Customer ${data.data?.customerCode} created successfully.`, 'success')
        queryClient.invalidateQueries({ queryKey: ['customersList'] })
        setIsDrawerOpen(false)
        resetForm()
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
        paymentTerms: customer.paymentTerms,
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
      internalNotes: ''
    })
    setEditingCustomerId(null)
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
      paymentTerms: customer.paymentTerms,
      status: customer.status,
      remarks: customer.remarks || '',
      internalNotes: '' // Placed inside remarks in db structure
    })
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

    // Conditional B2B validation
    const isB2B = formData.customerType === 'B2B'
    if (isB2B) {
      if (!formData.gstNumber.trim()) {
        showToast('GST Number is required for B2B customers.', 'warning')
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
        panNumber: isB2B ? formData.panNumber.trim().toUpperCase() : undefined,
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
        remarks: notesCombined || undefined
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
          panNumber: isB2B ? formData.panNumber.trim().toUpperCase() : undefined,
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
          remarks: notesCombined || undefined
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
    <div className="flex flex-col gap-6 font-sans text-slate-800 bg-[#F7F9FC] min-h-screen p-6 relative overflow-x-hidden">
      
      {/* Executive Clean Header */}
      <EnterpriseHeader
        title="Customer Registry"
        description="Single source of truth for managing all B2B and B2C operational customer master profiles."
        actions={
          canWrite && (
            <button
              onClick={handleOpenCreateDrawer}
              className="flex items-center gap-1.5 px-4 h-[40px] bg-[#1A56DB] hover:bg-[#1E40AF] text-white text-sm font-semibold rounded-[8px] shadow-sm transition-all duration-150 active:scale-[0.98] select-none cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Customer</span>
            </button>
          )
        }
      />

      {/* Filter and Search Bar Card */}
      <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-[12px] p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Search Input */}
        <div className="relative w-full md:w-[320px] shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by code, name, phone, GST..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 h-[40px] border border-[#E2E8F0] rounded-[8px] bg-white text-slate-900 text-sm focus:outline-none focus:border-[#1A56DB] focus:ring-1 focus:ring-[#1A56DB] focus:shadow-[0_0_0_2px_rgba(26,86,219,0.15)] transition-all"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap md:flex-nowrap gap-3 w-full justify-end select-none">
          {/* Customer Type Filter */}
          <select
            value={customerTypeFilter}
            onChange={(e) => { setCustomerTypeFilter(e.target.value); setCurrentPage(1); }}
            className="h-[40px] px-3.5 border border-[#E2E8F0] rounded-[8px] bg-white text-sm text-slate-700 font-medium focus:outline-none cursor-pointer"
          >
            <option value="">All Types</option>
            <option value="B2B">B2B Only</option>
            <option value="B2C">B2C Only</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="h-[40px] px-3.5 border border-[#E2E8F0] rounded-[8px] bg-white text-sm text-slate-700 font-medium focus:outline-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          {/* State Filter */}
          <select
            value={stateFilter}
            onChange={(e) => { setStateFilter(e.target.value); setCurrentPage(1); }}
            className="h-[40px] px-3.5 border border-[#E2E8F0] rounded-[8px] bg-white text-sm text-slate-700 font-medium focus:outline-none cursor-pointer max-w-[160px]"
          >
            <option value="">All States</option>
            {indianStates.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>

          {/* Sorting */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-[40px] px-3.5 border border-[#E2E8F0] rounded-[8px] bg-white text-sm text-slate-700 font-medium focus:outline-none cursor-pointer"
          >
            <option value="newest">Newest Created</option>
            <option value="oldest">Oldest Created</option>
            <option value="name">Customer Name</option>
            <option value="balance">Highest Balance</option>
          </select>

          {/* Export Button (Placeholder) */}
          <button
            onClick={() => showToast('Export action triggered (mock Excel extraction).', 'info')}
            className="flex items-center gap-2 h-[40px] px-4 border border-[#E2E8F0] rounded-[8px] bg-white text-slate-600 hover:bg-slate-50 text-sm font-semibold transition-colors duration-150 select-none cursor-pointer"
          >
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Main Content Table Area */}
      {isLoading ? (
        <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-[12px] p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-[#1A56DB] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-slate-500">Querying Customer Database...</span>
        </div>
      ) : customers.length > 0 ? (
        <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-[12px] overflow-hidden flex flex-col">
          
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="h-[48px] border-b border-[#E2E8F0] text-[#344054] font-semibold bg-[#F4F6F9] select-none">
                  <th className="py-3 px-4 text-sm font-semibold">Code</th>
                  <th className="py-3 px-4 text-sm font-semibold">Customer Name</th>
                  <th className="py-3 px-4 text-sm font-semibold">Business Name</th>
                  <th className="py-3 px-4 text-sm font-semibold">Type</th>
                  <th className="py-3 px-4 text-sm font-semibold">Phone</th>
                  <th className="py-3 px-4 text-sm font-semibold">GST Number</th>
                  <th className="py-3 px-4 text-sm font-semibold">City</th>
                  <th className="py-3 px-4 text-sm font-semibold text-right">Opening Bal.</th>
                  <th className="py-3 px-4 text-sm font-semibold text-center">Status</th>
                  <th className="py-3 px-4 text-sm font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {customers.map((c) => (
                  <tr 
                    key={c.id} 
                    className="h-[48px] hover:bg-[#E8F0FE] text-slate-900 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-[#1A56DB]">
                      {c.customerCode}
                    </td>
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
                          : 'bg-[#DCFCE7] text-[#16A34A]'
                      }`}>
                        {c.customerType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      {c.phone}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      {c.gstNumber || <span className="text-slate-300 italic text-[11px]">B2C (None)</span>}
                    </td>
                    <td className="py-3.5 px-4 font-medium">
                      {c.city}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-right">
                      <span className={c.balanceType === 'Receivable' ? 'text-blue-600' : c.balanceType === 'Payable' ? 'text-red-500' : 'text-slate-400'}>
                        {c.balanceType === 'Receivable' ? '+' : c.balanceType === 'Payable' ? '—' : ''}₹{c.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
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
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex gap-1.5 justify-end">
                        <button 
                          onClick={() => navigate(`/company/customers/profile/${c.id}`)}
                          className="p-1.5 hover:bg-slate-100 hover:text-[#1A56DB] text-slate-400 rounded-[6px] transition-colors cursor-pointer"
                          title="View Profile Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canWrite && (
                          <>
                            <button 
                              onClick={() => handleOpenEditDrawer(c)}
                              className="p-1.5 hover:bg-slate-100 hover:text-amber-600 text-slate-400 rounded-[6px] transition-colors cursor-pointer"
                              title="Edit Customer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteCustomer(c)}
                              className="p-1.5 hover:bg-slate-100 hover:text-red-600 text-slate-400 rounded-[6px] transition-colors cursor-pointer"
                              title="Delete (Soft Delete)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
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
                    {drawerMode === 'create' ? 'Generates an auto-incremented customer code suffix' : 'Customer ID code is read-only'}
                  </p>
                </div>
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 rounded-[8px] text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Scrollable Body Form */}
              <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
                
                {/* SECTION 1: Basic Information */}
                <div className="space-y-5">
                  <PremiumSectionHeading title="Basic Information" />
                  
                  <div className="grid grid-cols-2 gap-5">
                    <PremiumSelect
                      label="Customer Type *"
                      name="customerType"
                      value={formData.customerType}
                      onChange={handleFormChange}
                      required
                    >
                      <option value="B2C">B2C (Individual / Retail)</option>
                      <option value="B2B">B2B (Business / Corporate)</option>
                    </PremiumSelect>

                    <PremiumInput
                      label="Customer Name *"
                      name="customerName"
                      value={formData.customerName}
                      onChange={handleFormChange}
                      placeholder="e.g. John Doe / Apex Inc"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <PremiumInput
                      label="Contact Person Name"
                      name="contactPerson"
                      value={formData.contactPerson}
                      onChange={handleFormChange}
                      placeholder="e.g. Vance R."
                    />
                    <PremiumInput
                      label="Business Name"
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleFormChange}
                      placeholder={formData.customerType === 'B2B' ? 'Required business name' : 'Optional'}
                      required={formData.customerType === 'B2B'}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-5">
                    <PremiumInput
                      label="Primary Phone *"
                      name="phone"
                      value={formData.phone}
                      onChange={handleFormChange}
                      placeholder="e.g. +91 9999999999"
                      required
                    />
                    <PremiumInput
                      label="Alternate Phone"
                      name="alternatePhone"
                      value={formData.alternatePhone}
                      onChange={handleFormChange}
                      placeholder="Optional"
                    />
                    <PremiumInput
                      label="Email Address"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleFormChange}
                      placeholder="e.g. name@domain.com"
                    />
                  </div>
                </div>

                {/* SECTION 2: B2B Specific details */}
                {formData.customerType === 'B2B' && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <PremiumSectionHeading title="Business Information (B2B Only)" />
                    
                    <div className="grid grid-cols-2 gap-5">
                      <PremiumInput
                        label="GST Registration Number *"
                        name="gstNumber"
                        value={formData.gstNumber}
                        onChange={handleFormChange}
                        placeholder="15-digit GSTIN (e.g. 27AAAAA1111A1Z1)"
                        required
                      />
                      <PremiumInput
                        label="PAN Card Number *"
                        name="panNumber"
                        value={formData.panNumber}
                        onChange={handleFormChange}
                        placeholder="10-digit PAN (e.g. ABCDE1234F)"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <PremiumSelect
                        label="Business Registration Type"
                        name="businessType"
                        value={formData.businessType}
                        onChange={handleFormChange}
                      >
                        <option value="Proprietorship">Proprietorship</option>
                        <option value="Partnership">Partnership Firm</option>
                        <option value="Private Limited">Private Limited (Pvt Ltd)</option>
                        <option value="Public Limited">Public Limited Ltd</option>
                        <option value="LLP">LLP</option>
                        <option value="Government">Government / PSU</option>
                      </PremiumSelect>
                      <PremiumSelect
                        label="GST Registered State"
                        name="gstState"
                        value={formData.gstState}
                        onChange={handleFormChange}
                      >
                        <option value="">Select Registered State</option>
                        {indianStates.map(state => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </PremiumSelect>
                    </div>
                  </div>
                )}

                {/* SECTION 3: Address Line */}
                <div className="space-y-5">
                  <PremiumSectionHeading title="Shipping & Billing Address" />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <PremiumInput
                      label="Address Line 1 *"
                      name="addressLine1"
                      value={formData.addressLine1}
                      onChange={handleFormChange}
                      placeholder="Building, street name"
                      required
                    />
                    <PremiumInput
                      label="Address Line 2"
                      name="addressLine2"
                      value={formData.addressLine2}
                      onChange={handleFormChange}
                      placeholder="Area, landmark"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-5">
                    <PremiumInput
                      label="City *"
                      name="city"
                      value={formData.city}
                      onChange={handleFormChange}
                      placeholder="City Name"
                      required
                    />
                    <PremiumInput
                      label="District *"
                      name="district"
                      value={formData.district}
                      onChange={handleFormChange}
                      placeholder="District Name"
                      required
                    />
                    <PremiumSelect
                      label="State *"
                      name="state"
                      value={formData.state}
                      onChange={handleFormChange}
                      required
                    >
                      <option value="">Select State</option>
                      {indianStates.map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </PremiumSelect>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <PremiumInput
                      label="Country *"
                      name="country"
                      value={formData.country}
                      onChange={handleFormChange}
                      required
                    />
                    <PremiumInput
                      label="PIN/Zip Code *"
                      name="pinCode"
                      value={formData.pinCode}
                      onChange={handleFormChange}
                      placeholder="6-digit PIN"
                      required
                    />
                  </div>
                </div>

                {/* SECTION 4: Financial Setup */}
                <div className="space-y-5">
                  <PremiumSectionHeading title="Initial Financial Accounting" />
                  
                  <div className="grid grid-cols-3 gap-5">
                    <PremiumInput
                      label="Opening Balance (INR) *"
                      name="openingBalance"
                      type="number"
                      step="0.01"
                      value={formData.openingBalance}
                      onChange={handleFormChange}
                      required
                    />
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
                </div>

                {/* SECTION 5: Remarks & Notes */}
                <div className="space-y-5">
                  <PremiumSectionHeading title="Remarks & Notes" />
                  <PremiumTextarea
                    label="Remarks / Public Notes"
                    name="remarks"
                    rows={2}
                    value={formData.remarks}
                    onChange={handleFormChange}
                    placeholder="Remarks displayed on public documents..."
                  />
                  <PremiumTextarea
                    label="Internal System Notes"
                    name="internalNotes"
                    rows={2}
                    value={formData.internalNotes}
                    onChange={handleFormChange}
                    placeholder="Confidential internal notes only visible to staff..."
                  />
                </div>

              </form>

              {/* Drawer Action Footer */}
              <div className="px-8 py-5 border-t border-[#E2E8F0] flex gap-3 justify-end bg-[#F8FAFC] select-none">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="h-[44px] px-5 border border-gray-300 hover:border-gray-400 rounded-[10px] bg-white text-gray-700 hover:bg-gray-50 text-sm font-semibold select-none cursor-pointer transition-all duration-150 active:scale-[0.99]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFormSubmit}
                  className="h-[44px] px-6 bg-[#1A56DB] hover:bg-[#1E40AF] active:bg-[#123E97] text-white text-sm font-semibold rounded-[10px] shadow-sm select-none cursor-pointer transition-all duration-150 active:scale-[0.99]"
                >
                  {drawerMode === 'create' ? 'Register Customer' : 'Save Changes'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}


    </div>
  )
}

export default CustomersPage
