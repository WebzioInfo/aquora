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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Card 1: Basic Information */}
            <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2.5 mb-4 flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-400" /> Basic Information
              </h4>
              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Customer Code</span>
                  <span className="font-mono font-bold text-slate-800">{customer.customerCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Customer Type</span>
                  <span className="font-bold text-slate-800">{customer.customerType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Customer Name</span>
                  <span className="font-bold text-slate-800">{customer.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Business Name</span>
                  <span className="font-bold text-slate-800">{customer.businessName || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Contact Person</span>
                  <span className="font-bold text-slate-800">{customer.contactPerson || 'None listed'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Account Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    customer.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {customer.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Contact Information */}
            <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2.5 mb-4 flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-slate-400" /> Contact Information
              </h4>
              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Primary Phone</span>
                  <span className="font-mono font-bold text-slate-800">{customer.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Alternate Phone</span>
                  <span className="font-mono font-bold text-slate-800">{customer.alternatePhone || 'None listed'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Email Address</span>
                  <span className="font-bold text-slate-800">{customer.email || 'None listed'}</span>
                </div>
              </div>
            </div>

            {/* Card 3: Address & Location */}
            <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2.5 mb-4 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-slate-400" /> Address Details
              </h4>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 font-medium block mb-1">Billing Address</span>
                  <p className="font-bold text-slate-800 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {customer.addressLine1}
                    {customer.addressLine2 ? `, ${customer.addressLine2}` : ''}
                    <br />
                    {customer.city}, {customer.district}, {customer.state} — {customer.pinCode}
                    <br />
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">{customer.country}</span>
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block mb-1">Shipping Address</span>
                  <p className="text-slate-400 italic text-[11px]">Same as Billing Address</p>
                </div>
              </div>
            </div>

            {/* Card 4: Business Information (shown for B2B) */}
            {isB2B && (
              <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2.5 mb-4 flex items-center gap-1.5">
                  <Landmark className="w-4 h-4 text-slate-400" /> Business Details
                </h4>
                <div className="space-y-3.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">GSTIN/GST Number</span>
                    <span className="font-mono font-bold text-slate-800">{customer.gstNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">PAN Number</span>
                    <span className="font-mono font-bold text-slate-800">{customer.panNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Business Type</span>
                    <span className="font-bold text-slate-800">{customer.businessType || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">GST Registered State</span>
                    <span className="font-bold text-slate-800">{customer.gstState || 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Card 5: Financial Information */}
            <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2.5 mb-4 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-slate-400" /> Financial Settings
              </h4>
              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Opening Balance</span>
                  <span className="font-mono font-bold text-slate-800">₹{customer.openingBalance.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Balance Type</span>
                  <span className="font-bold text-slate-800">{customer.balanceType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Credit Limit</span>
                  <span className="font-mono font-bold text-slate-800">₹{customer.creditLimit.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Payment Terms</span>
                  <span className="font-bold text-slate-800">{customer.paymentTerms}</span>
                </div>
              </div>
            </div>

            {/* Card 6: Internal Remarks */}
            <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm col-span-1 md:col-span-2 lg:col-span-3">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2.5 mb-4 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-400" /> Internal Notes & Remarks
              </h4>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-lg min-h-[80px]">
                {customer.remarks ? (
                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed select-text">
                    {customer.remarks}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic">No notes or remarks listed for this customer record.</p>
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
