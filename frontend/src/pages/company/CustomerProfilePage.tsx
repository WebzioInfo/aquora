import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, Edit3, Landmark, Activity, FileText, 
  MapPin, Phone, Mail, User, ShieldAlert,
  Coins, Briefcase, FileSignature, Clock, BookOpen, Truck
} from 'lucide-react'
import { customersService } from '../../services/customers'
import EnterpriseHeader from '../../components/ui/EnterpriseHeader'
import EnterpriseBadge from '../../components/ui/EnterpriseBadge'
import EnterpriseButton from '../../components/ui/EnterpriseButton'

interface CustomerProfilePageProps {
  customerId: string
  onEditCustomer: (customer: any) => void
}

type TabType = 'overview' | 'sales' | 'ledger' | 'jars' | 'dispatch' | 'docs' | 'contacts' | 'notes' | 'activity'

export const CustomerProfilePage: React.FC<CustomerProfilePageProps> = ({ customerId, onEditCustomer }) => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  // Fetch customer details by ID
  const { data: customer, isLoading, error } = useQuery({
    queryKey: ['customerProfile', customerId],
    queryFn: async () => {
      const res = await customersService.getCustomerById(customerId)
      return res.data
    },
    enabled: !!customerId
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] select-none bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Loading profile data...</p>
        </div>
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 select-none">
        <div className="bg-white border border-red-100 rounded-xl p-8 text-center shadow-sm">
          <ShieldAlert className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h3 className="text-sm font-bold text-slate-900 mb-1">Customer Profile Not Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
            The customer record might have been deleted, or you do not have permission to view it.
          </p>
          <EnterpriseButton 
            variant="secondary" 
            onClick={() => navigate('/company/customers')}
            className="inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Customers
          </EnterpriseButton>
        </div>
      </div>
    )
  }

  const isB2B = customer.customerType.toUpperCase() === 'B2B'

  // Format Date Helper
  const formatDateTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="max-w-[1280px] mx-auto py-6 px-4 md:px-6 select-none bg-[#F8FAFC]">
      
      {/* 1. BREADCRUMBS & ACTION HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          {/* Back Navigation */}
          <button 
            onClick={() => navigate('/company/customers')}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-900 transition-colors text-xs font-bold mb-3 cursor-pointer group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Customers</span>
          </button>
          
          {/* Breadcrumb Title */}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
            <span>Customers</span>
            <span>&gt;</span>
            <span className="text-slate-600 font-bold">{customer.customerName}</span>
          </div>

          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 leading-none">
              {customer.customerName}
            </h2>
            <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
              {customer.customerCode}
            </span>
            <EnterpriseBadge 
              variant={customer.status === 'Active' ? 'success' : 'danger'}
              className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5"
            >
              {customer.status}
            </EnterpriseBadge>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <EnterpriseButton 
            variant="primary" 
            onClick={() => onEditCustomer(customer)}
            className="inline-flex items-center gap-1.5 h-[38px] px-4 font-bold text-xs"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit Customer
          </EnterpriseButton>
          
          <EnterpriseButton 
            variant="secondary"
            disabled
            className="h-[38px] px-4 font-bold text-xs opacity-50 cursor-not-allowed"
          >
            Deactivate
          </EnterpriseButton>

          <EnterpriseButton 
            variant="danger"
            disabled
            className="h-[38px] px-4 font-bold text-xs opacity-50 cursor-not-allowed"
          >
            Delete
          </EnterpriseButton>
        </div>
      </div>

      {/* 2. TOP SUMMARY PROFILE CARD */}
      <div className="bg-white border border-slate-100 rounded-xl p-5 mb-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-2xl uppercase">
            {customer.customerName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-base">{customer.customerName}</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isB2B ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'
              }`}>
                {customer.customerType}
              </span>
            </div>
            {customer.businessName && (
              <p className="text-xs font-semibold text-slate-500 mt-0.5">{customer.businessName}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-400 text-xs mt-1.5 font-medium">
              <span className="flex items-center gap-1 font-mono">
                <Phone className="w-3 h-3" /> {customer.phone}
              </span>
              {customer.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {customer.email}
                </span>
              )}
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {customer.city}, {customer.state}
              </span>
            </div>
          </div>
        </div>

        {/* Financial Highlights Panel */}
        <div className="flex items-center gap-8 border-l border-slate-105 pl-8 pr-4">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Opening Balance</span>
            <span className={`font-mono font-black text-lg ${
              customer.balanceType === 'Receivable' ? 'text-blue-600' : customer.balanceType === 'Payable' ? 'text-red-500' : 'text-slate-700'
            }`}>
              ₹{customer.openingBalance.toLocaleString('en-IN')}
            </span>
            <span className="text-[9px] font-bold text-slate-400 uppercase block leading-none mt-0.5">({customer.balanceType})</span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Outstanding Balance</span>
            <span className="font-mono font-black text-lg text-slate-300">
              ₹0.00
            </span>
            <span className="text-[9px] font-bold text-slate-400 uppercase block leading-none mt-0.5">(Placeholder)</span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Registered At</span>
            <span className="font-bold text-slate-600 text-xs block mt-1">
              {new Date(customer.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
            </span>
          </div>
        </div>
      </div>

      {/* 3. PROFESSIONAL TABS SELECTION */}
      <div className="flex border-b border-[#E2E8F0] gap-6 mb-6 overflow-x-auto scrollbar-none">
        {[
          { id: 'overview', label: 'Overview', icon: User },
          { id: 'sales', label: 'Sales History', icon: Coins },
          { id: 'ledger', label: 'Customer Ledger', icon: BookOpen },
          { id: 'jars', label: '20L Jar Tracking', icon: Clock },
          { id: 'dispatch', label: 'Delivery History', icon: Truck },
          { id: 'docs', label: 'Documents', icon: FileText },
          { id: 'contacts', icon: FileSignature, label: 'Contacts' },
          { id: 'notes', icon: Briefcase, label: 'Internal Notes' },
          { id: 'activity', icon: Activity, label: 'Activity Logs' }
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`pb-3 text-xs font-bold border-b-2 px-1 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                isActive 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* 4. ACTIVE VIEW RENDERING */}
      <div className="min-h-[400px]">
        {activeTab === 'overview' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Card 1: Basic Information */}
            <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-400" /> Basic Details
              </h4>
              <div className="space-y-3.5 text-xs text-left">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Partner Code</span>
                  <span className="font-mono font-bold text-[#1A56DB]">{customer.customerCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Partner Type</span>
                  <span className="font-bold text-slate-800">{customer.customerType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Partner Name</span>
                  <span className="font-bold text-slate-800">{customer.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Contact Person</span>
                  <span className="font-bold text-slate-800">{customer.contactPerson || 'None listed'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Primary Phone</span>
                  <span className="font-mono font-bold text-slate-800">{customer.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">WhatsApp Phone</span>
                  <span className="font-mono font-bold text-slate-800">{customer.whatsApp || 'None listed'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Email Address</span>
                  <span className="font-bold text-slate-800">{customer.email || 'None listed'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Website</span>
                  <span className="font-bold text-slate-800 text-blue-600 truncate max-w-[180px]">{customer.website || 'None listed'}</span>
                </div>
              </div>
            </div>

            {/* Card 2: Financial Setup & Accounting */}
            <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-slate-400" /> Financial Settings
              </h4>
              <div className="space-y-3.5 text-xs text-left">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">GSTIN</span>
                  <span className="font-mono font-bold text-slate-800">{customer.gstNumber || 'N/A (B2C)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">PAN Number</span>
                  <span className="font-mono font-bold text-slate-800">{customer.panNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Trade License</span>
                  <span className="font-bold text-slate-800">{customer.tradeLicense || 'None listed'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Tax Status</span>
                  <span className={`font-bold ${customer.taxExempt ? 'text-green-600' : 'text-slate-800'}`}>
                    {customer.taxExempt ? 'Tax Exempt' : 'Taxable'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Credit Limit</span>
                  <span className="font-mono font-bold text-slate-800">₹{customer.creditLimit?.toLocaleString('en-IN') || '0.00'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Payment Terms</span>
                  <span className="font-bold text-slate-800">{customer.paymentTerms}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Price List Code</span>
                  <span className="font-mono font-semibold text-slate-800">{customer.priceList || 'Default List'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Discount Group</span>
                  <span className="font-semibold text-slate-800">{customer.discountGroup || 'Standard'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Account Code</span>
                  <span className="font-mono text-slate-800">{customer.ledgerPlaceholder || 'None'}</span>
                </div>
              </div>
            </div>

            {/* Card 3: Billing & Locations */}
            <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-slate-400" /> Primary Address & Branches
              </h4>
              <div className="space-y-3.5 text-xs text-left">
                <div>
                  <span className="text-slate-400 font-medium block mb-1">Billing & Shipping Address</span>
                  <p className="font-semibold text-slate-800 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {customer.addressLine1}
                    {customer.addressLine2 ? `, ${customer.addressLine2}` : ''}
                    <br />
                    {customer.city}, {customer.district}, {customer.state} — {customer.pinCode}
                    <br />
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">{customer.country}</span>
                  </p>
                </div>
                {customer.addressesJson && customer.addressesJson !== '[]' && (
                  <div>
                    <span className="text-slate-400 font-medium block mb-1">Secondary Branches/Warehouses</span>
                    <div className="max-h-[80px] overflow-y-auto text-[11px] font-medium text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {customer.addressesJson}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Card 4: Logistics & Distributor Profile */}
            <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm lg:col-span-2 space-y-4">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-slate-400" /> Logistics & Distributor Configuration
              </h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs text-left">
                {customer.customerType === 'Distributor' && (
                  <>
                    <div className="flex justify-between border-b border-slate-50 pb-1">
                      <span className="text-slate-400">Distributor Profile</span>
                      <span className="font-bold text-slate-800">{customer.distributorType || 'Standard'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 pb-1">
                      <span className="text-slate-400">Commission Rate</span>
                      <span className="font-bold text-slate-800">{customer.commissionPercentage}%</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 pb-1">
                      <span className="text-slate-400">Base Salary</span>
                      <span className="font-bold text-slate-800">₹{customer.monthlySalary?.toLocaleString('en-IN') || '0.00'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 pb-1">
                      <span className="text-slate-400">Security Deposit</span>
                      <span className="font-bold text-slate-800">₹{customer.securityDeposit?.toLocaleString('en-IN') || '0.00'}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between border-b border-slate-50 pb-1">
                  <span className="text-slate-400">Assigned Route</span>
                  <span className="font-bold text-slate-850">{customer.assignedRoute || 'No route assigned'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1">
                  <span className="text-slate-400">Assigned Vehicle</span>
                  <span className="font-bold text-slate-850">{customer.assignedVehicle || 'No vehicle assigned'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1">
                  <span className="text-slate-400">Assigned Driver</span>
                  <span className="font-bold text-slate-800">{customer.assignedDriver || 'N/A'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1">
                  <span className="text-slate-400">Assigned Sales Exec</span>
                  <span className="font-bold text-slate-800">{customer.assignedSalesExecutive || 'N/A'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1 col-span-2">
                  <span className="text-slate-400">Working Coverage Area & Days</span>
                  <span className="font-semibold text-slate-800">{customer.workingArea || 'N/A'} {customer.workingDays ? `(${customer.workingDays})` : ''}</span>
                </div>
              </div>
            </div>

            {/* Card 5: 20L Jar Plant Settings */}
            <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" /> 20L Water Jar Parameters
              </h4>
              <div className="space-y-3.5 text-xs text-left">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Jar Deposit Price</span>
                  <span className="font-bold text-slate-800">₹{customer.jarDeposit || '0'} / jar</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Max Jar Inventory Limit</span>
                  <span className="font-bold text-slate-800">{customer.maxJarLimit || '0'} jars</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Outstanding Jars</span>
                  <span className="font-mono font-bold text-blue-600">{customer.outstandingJars || '0'} jars</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Preferred Brand</span>
                  <span className="font-semibold text-slate-800">{customer.preferredJarBrand || 'Default (Aquora)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Cap Material</span>
                  <span className="font-semibold text-slate-800">{customer.preferredCapMaterial || 'Standard cap'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Seal Check Required</span>
                  <span className="font-semibold text-slate-850">{customer.sealRequired ? 'Double seal check' : 'Standard'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Delivery Schedule</span>
                  <span className="font-semibold text-slate-850">{customer.deliveryFrequency || 'Daily'} ({customer.preferredDeliveryTime || 'Morning'})</span>
                </div>
              </div>
            </div>

            {/* Card 6: Remarks */}
            <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm col-span-1 md:col-span-2 lg:col-span-3">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2.5 mb-4 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-400" /> Internal Notes & Remarks
              </h4>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-lg min-h-[80px] text-left">
                {customer.remarks ? (
                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed select-text font-semibold">
                    {customer.remarks}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic">No notes or remarks listed for this partner record.</p>
                )}
              </div>
            </div>

          </div>
        ) : (
          /* Visual Placeholders for other tabs */
          <div className="bg-white border border-slate-100 rounded-xl p-12 text-center shadow-sm flex flex-col items-center justify-center gap-4 select-none">
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
              <Landmark className="w-6 h-6 animate-pulse text-blue-500" />
            </div>
            <div>
              <h5 className="text-sm font-bold text-slate-800">Module Integration Placeholder</h5>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                The {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} subview is a visual placeholder for the upcoming ERP module implementation. 
                Transaction logs, outstanding ledger mappings, and analytical reports are currently out of scope.
              </p>
            </div>
            <div className="flex gap-2.5 mt-2">
              <EnterpriseButton variant="secondary" size="sm" disabled className="opacity-50 text-[11px] font-bold h-[32px] px-3.5">
                Create Sales Order
              </EnterpriseButton>
              <EnterpriseButton variant="secondary" size="sm" disabled className="opacity-50 text-[11px] font-bold h-[32px] px-3.5">
                Record Payment
              </EnterpriseButton>
              <EnterpriseButton variant="secondary" size="sm" disabled className="opacity-50 text-[11px] font-bold h-[32px] px-3.5">
                Create Dispatch
              </EnterpriseButton>
            </div>
          </div>
        )}
      </div>

      {/* Audit Footer Details */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase mt-8 pt-4 border-t border-slate-100 select-none">
        <span>Created By: {customer.createdBy || 'System'} at {formatDateTime(customer.createdAt)}</span>
        {customer.updatedAt && (
          <span>Last Updated By: {customer.updatedBy || 'System'} at {formatDateTime(customer.updatedAt)}</span>
        )}
      </div>

    </div>
  )
}
