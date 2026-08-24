import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Edit3, Landmark, Activity, FileText,
  MapPin, Phone, Mail, User, ShieldAlert,
  Coins, Briefcase, FileSignature, Clock, BookOpen, Truck,
  Wallet, Eye
} from 'lucide-react'
import { customersService } from '../../services/customers'
import { salesService } from '../../services/sales'
import EnterpriseBadge from '../../components/ui/EnterpriseBadge'
import EnterpriseButton from '../../components/ui/EnterpriseButton'
import PageContainer from '../../components/ui/layout/PageContainer'
import DetailTabs from '../../components/ui/layout/DetailTabs'
import type { TabItem } from '../../components/ui/layout/DetailTabs'

interface CustomerProfilePageProps {
  customerId: string
  onEditCustomer: (customer: any) => void
  onCollectPayment?: (customer: any) => void
}

type TabType = 'overview' | 'sales' | 'ledger' | 'jars' | 'dispatch' | 'docs' | 'contacts' | 'notes' | 'activity'

export const CustomerProfilePage: React.FC<CustomerProfilePageProps> = ({ customerId, onEditCustomer, onCollectPayment }) => {
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

  // Fetch customer-specific sales history
  const { data: salesData, isLoading: isSalesLoading } = useQuery({
    queryKey: ['customerSalesHistory', customerId],
    queryFn: async () => {
      const res = await salesService.getTransactions(1, 100, '', '', customerId)
      return res.data
    },
    enabled: activeTab === 'sales' && !!customerId
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
            className="inline-flex items-center gap-1.5 cursor-pointer"
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

  const formatDateOnly = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  const salesTransactions = salesData?.items || []
  const hasOutstanding = (customer.outstandingPlaceholder || 0) > 0

  return (
    <PageContainer>
      {/* 2. TOP SUMMARY PROFILE CARD */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden mb-6">
        {/* Top bar: back button */}
        <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-[#F1F5F9] bg-slate-50/50">
          <button
            onClick={() => navigate('/company/customers')}
            className="h-[30px] px-3 text-[12px] font-bold text-slate-700 border border-[#E5E7EB] hover:bg-white rounded-lg flex items-center gap-1.5 cursor-pointer transition-all active:scale-[0.97]"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
            Back to Customers
          </button>

          {hasOutstanding && onCollectPayment && (
            <button
              onClick={() => onCollectPayment(customer)}
              className="h-[30px] px-3 text-[12px] font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
            >
              <Wallet className="w-3.5 h-3.5" />
              Collect Payment (₹{(customer.outstandingPlaceholder || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })})
            </button>
          )}
        </div>

        <div className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xl uppercase shrink-0">
              {customer.customerName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 leading-none">{customer.customerName}</h2>
                <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  {customer.customerCode}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isB2B ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'}`}>
                  {customer.customerType}
                </span>
                <EnterpriseBadge
                  variant={customer.status === 'Active' ? 'success' : 'danger'}
                  className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5"
                >
                  {customer.status}
                </EnterpriseBadge>
              </div>
              {customer.businessName && (
                <p className="text-xs font-medium text-slate-500 mt-1">{customer.businessName}</p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500 text-xs mt-2">
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3.5 h-3.5" /> {customer.phone}
                </span>
                {customer.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" /> {customer.email}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {customer.city}, {customer.state}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <EnterpriseButton
              variant="primary"
              onClick={() => onEditCustomer(customer)}
              className="inline-flex items-center gap-1.5 h-8 px-3 font-bold text-xs cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit Profile
            </EnterpriseButton>
          </div>
        </div>
      </div>

      {/* TABS */}
      <DetailTabs
        tabs={[
          { id: 'overview', label: 'Overview', icon: User },
          { id: 'sales', label: 'Sales History', icon: Coins },
          { id: 'ledger', label: 'Customer Ledger', icon: BookOpen },
          { id: 'jars', label: '20L Jar Tracking', icon: Clock },
          { id: 'dispatch', label: 'Delivery History', icon: Truck },
          { id: 'docs', label: 'Documents', icon: FileText },
          { id: 'contacts', label: 'Contacts', icon: FileSignature },
          { id: 'notes', label: 'Internal Notes', icon: Briefcase },
          { id: 'activity', label: 'Activity Logs', icon: Activity }
        ] as TabItem[]}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabType)}
      />

      {/* TAB CONTENT AREA */}
      <div className="mt-4">
        {activeTab === 'overview' ? (
          <div className="space-y-6 select-none">
            {/* KPI STAT CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Opening Balance</span>
                <div className="text-sm font-bold text-slate-900 mt-1 font-mono">
                  ₹{Number(customer.openingBalance)?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Outstanding Balance</span>
                <div className={`text-sm font-bold mt-1 font-mono ${hasOutstanding ? 'text-amber-700' : 'text-emerald-700'}`}>
                  ₹{(customer.outstandingPlaceholder || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Outstanding Jars</span>
                <div className="text-sm font-bold text-slate-800 mt-1">{customer.outstandingJars || 0} Jars</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Max Inventory</span>
                <div className="text-sm font-bold text-slate-800 mt-1">{customer.maxJarLimit || 0} Jars</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Assigned Route</span>
                <div className="text-sm font-bold text-slate-800 mt-1 truncate">{customer.assignedRoute || 'None'}</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Assigned Vehicle</span>
                <div className="text-sm font-bold text-slate-800 mt-1 truncate">{customer.assignedVehicle || 'None'}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Basic Details */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-blue-500" /> Basic Details
                </h4>
                <div className="space-y-4 text-xs flex-1">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Contact Person</span>
                    <span className="block font-semibold text-slate-800">{customer.contactPerson || 'None listed'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Primary Phone</span>
                    <span className="block font-mono font-semibold text-slate-800">{customer.phone}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">WhatsApp Phone</span>
                    <span className="block font-mono font-semibold text-slate-800">{customer.whatsApp || 'None listed'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Email Address</span>
                    <span className="block font-semibold text-slate-800">{customer.email || 'None listed'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Website</span>
                    <span className="block font-semibold text-blue-600 truncate">{customer.website || 'None listed'}</span>
                  </div>
                </div>
              </div>

              {/* Middle: Financial Settings */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Landmark className="w-4 h-4 text-blue-500" /> Financial Settings
                </h4>
                <div className="space-y-4 text-xs flex-1">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">GSTIN</span>
                    <span className="block font-mono font-semibold text-slate-800">{customer.gstNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">PAN Number</span>
                    <span className="block font-mono font-semibold text-slate-800">{customer.panNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Credit Limit</span>
                    <span className="block font-mono font-semibold text-slate-800">₹{customer.creditLimit?.toLocaleString('en-IN') || '0.00'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Price</span>
                    <span className="block font-mono font-semibold text-slate-800">₹{customer.price?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Discount</span>
                    <span className="block font-mono font-semibold text-slate-800">₹{customer.discount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}</span>
                  </div>
                </div>
              </div>

              {/* Right: Primary Address */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-blue-500" /> Locations
                </h4>
                <div className="space-y-4 text-xs flex-1">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Billing & Shipping Address</span>
                    <div className="font-medium text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed">
                      {customer.addressLine1}
                      {customer.addressLine2 ? `, ${customer.addressLine2}` : ''}
                      <br />
                      {customer.city}, {customer.district}, {customer.state} — {customer.pinCode}
                      <br />
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mt-1 block">{customer.country}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Compact Logistics & Setup Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm lg:col-span-2">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <Truck className="w-4 h-4 text-blue-500" /> Logistics & Setup
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Assigned Driver</span>
                    <span className="block font-semibold text-slate-800">{customer.assignedDriver || 'N/A'}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Assigned Sales Exec</span>
                    <span className="block font-semibold text-slate-800">{customer.assignedSalesExecutive || 'N/A'}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Working Coverage Area</span>
                    <span className="block font-semibold text-slate-800">{customer.workingArea || 'N/A'}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Working Days</span>
                    <span className="block font-semibold text-slate-800">{customer.workingDays || 'N/A'}</span>
                  </div>
                  {customer.customerType === 'Distributor' && (
                    <>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Commission Rate</span>
                        <span className="block font-semibold text-slate-800">{customer.commissionPercentage}%</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Base Salary</span>
                        <span className="block font-semibold text-slate-800">₹{customer.monthlySalary?.toLocaleString('en-IN') || '0.00'}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right: 20L Jar Parameters */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-500" /> 20L Jar Parameters
                </h4>
                <div className="space-y-3 text-xs flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                      <Coins className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Jar Deposit Price</span>
                      <span className="block font-semibold text-slate-800 leading-none">₹{customer.jarDeposit || '0'} / jar</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Outstanding Jars</span>
                      <span className="block font-semibold text-slate-800 leading-none">{customer.outstandingJars || 0} Jars with customer</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Internal Notes & Remarks */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm lg:col-span-3">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2 mb-3 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-500" /> Internal Notes & Remarks
                </h4>
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg min-h-[50px] text-left">
                  {customer.remarks ? (
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                      {customer.remarks}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No notes or remarks listed for this partner record.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        ) : activeTab === 'sales' ? (
          /* LIVE SALES HISTORY TAB */
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden select-none">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-blue-600" />
                  Customer Sales Transactions History
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">Complete record of sales dispatches, invoices, and payment statuses for {customer.customerName}</p>
              </div>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {salesTransactions.length} Transactions
              </span>
            </div>

            {isSalesLoading ? (
              <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-400">Loading sales transactions...</span>
              </div>
            ) : salesTransactions.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <Coins className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                No sales transactions recorded for this customer yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider h-9">
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Sales Type</th>
                      <th className="py-2.5 px-4">Product</th>
                      <th className="py-2.5 px-4 text-right">Quantity</th>
                      <th className="py-2.5 px-4 text-right">Subtotal</th>
                      <th className="py-2.5 px-4 text-right">Discount</th>
                      <th className="py-2.5 px-4 text-right">GST</th>
                      <th className="py-2.5 px-4 text-right">Total</th>
                      <th className="py-2.5 px-4 text-right">Paid</th>
                      <th className="py-2.5 px-4 text-right">Outstanding</th>
                      <th className="py-2.5 px-4 text-center">Payment Method</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {salesTransactions.map((t) => {
                      const total = t.totalAmount || 0
                      const outstanding = t.outstandingAmount !== undefined ? t.outstandingAmount : (t.paymentStatus === 'Paid' ? 0 : total)
                      const paid = t.amountReceived !== undefined ? t.amountReceived : Math.max(0, total - outstanding)
                      const status = t.paymentStatus || (outstanding <= 0 ? 'Paid' : (paid > 0 ? 'Partially Paid' : 'Pending'))

                      const rawType = (t.transactionType || 'Sales Dispatch').trim()
                      const lowerType = rawType.toLowerCase()

                      let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-200'
                      let dotStyle = 'bg-slate-400'

                      if (lowerType.includes('dispatch') || lowerType === 'sales') {
                        badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        dotStyle = 'bg-emerald-500'
                      } else if (lowerType.includes('return')) {
                        badgeStyle = 'bg-rose-50 text-rose-700 border-rose-200'
                        dotStyle = 'bg-rose-500'
                      } else if (lowerType.includes('invoice')) {
                        badgeStyle = 'bg-blue-50 text-blue-700 border-blue-200'
                        dotStyle = 'bg-blue-500'
                      } else if (lowerType.includes('credit')) {
                        badgeStyle = 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        dotStyle = 'bg-indigo-500'
                      } else if (lowerType.includes('payment')) {
                        badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200'
                        dotStyle = 'bg-amber-500'
                      } else if (lowerType.includes('adjust') || lowerType.includes('damage')) {
                        badgeStyle = 'bg-purple-50 text-purple-700 border-purple-200'
                        dotStyle = 'bg-purple-500'
                      }

                      return (
                        <tr key={t.id} className="hover:bg-slate-50/60 font-mono">
                          <td className="py-3 px-4 font-sans font-medium text-slate-600">
                            {formatDateOnly(t.transactionDate)}
                          </td>
                          <td className="py-3 px-4 font-sans">
                            <div className="flex flex-col items-start gap-0.5">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${badgeStyle}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${dotStyle}`} />
                                <span>{rawType}</span>
                              </span>
                              {t.transactionNumber && (
                                <span className="font-mono text-[11px] font-medium text-slate-500">
                                  {t.transactionNumber}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-sans font-semibold text-slate-800">
                            {t.productName}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold">
                            {t.cases} Cases
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600">
                            ₹{((t.unitPrice || 0) * t.cases).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-500">
                            ₹{(t.discountAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-500">
                            ₹{(t.taxAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-700">
                            ₹{paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-amber-700">
                            ₹{outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-center font-sans">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {t.paymentMethod || 'Credit'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-sans">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                              status === 'Partially Paid' || status === 'Partial' ? 'bg-amber-100 text-amber-800' :
                              'bg-rose-100 text-rose-800'
                            }`}>
                              {status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-sans">
                            {outstanding > 0 && onCollectPayment ? (
                              <button
                                onClick={() => onCollectPayment(customer)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] rounded border border-emerald-200 transition-colors cursor-pointer"
                                title="Collect Payment against Customer Receivable"
                              >
                                <Wallet className="w-3 h-3" />
                                Collect
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === 'ledger' ? (
          /* LIVE CUSTOMER LEDGER TAB */
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden select-none">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-blue-600" />
                  Customer Credit Ledger & Statements
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">Chronological record of dispatches, credit notes, and collection receipts</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block font-semibold">Current Outstanding</span>
                <span className="text-sm font-bold text-slate-900 font-mono">
                  ₹{(customer.outstandingPlaceholder || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {(() => {
              let entries: any[] = []
              if (customer.ledgerPlaceholder) {
                try {
                  entries = JSON.parse(customer.ledgerPlaceholder)
                } catch {}
              }

              if (entries.length === 0) {
                return (
                  <div className="p-12 text-center text-xs text-slate-400">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No ledger transactions recorded for this customer yet.
                  </div>
                )
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider h-9">
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Transaction Type</th>
                        <th className="py-2.5 px-4">Reference #</th>
                        <th className="py-2.5 px-4 text-right">Debit (Sales)</th>
                        <th className="py-2.5 px-4 text-right">Credit (Paid)</th>
                        <th className="py-2.5 px-4 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                      {entries.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60">
                          <td className="py-3 px-4 font-sans font-medium text-slate-600">
                            {formatDateTime(entry.Date || entry.date)}
                          </td>
                          <td className="py-3 px-4 font-sans font-bold text-slate-800">
                            {entry.TransactionType || entry.transactionType}
                          </td>
                          <td className="py-3 px-4 font-semibold text-blue-600">
                            {entry.Reference || entry.reference || '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            {(entry.Debit || entry.debit) > 0 ? `₹${(entry.Debit || entry.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-700">
                            {(entry.Credit || entry.credit) > 0 ? `₹${(entry.Credit || entry.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            ₹{(entry.Balance ?? entry.balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>
        ) : (
          /* Visual Placeholders for other tabs */
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm flex flex-col items-center justify-center gap-4 select-none">
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
              <Landmark className="w-6 h-6 animate-pulse text-blue-500" />
            </div>
            <div>
              <h5 className="text-sm font-bold text-slate-800">Module Integration</h5>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-2 leading-relaxed">
                The {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} tab is ready for detailed sub-analytics.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Audit Footer Details */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase mt-6 pt-4 border-t border-slate-200 select-none">
        <span>Created By: {customer.createdBy || 'System'} at {formatDateTime(customer.createdAt)}</span>
        {customer.updatedAt && (
          <span>Last Updated By: {customer.updatedBy || 'System'} at {formatDateTime(customer.updatedAt)}</span>
        )}
      </div>
    </PageContainer>
  )
}
