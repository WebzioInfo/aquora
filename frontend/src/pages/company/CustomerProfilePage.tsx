import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, Edit3, Landmark, Activity, FileText, 
  MapPin, Phone, Mail, User, ShieldAlert,
  Coins, Briefcase, FileSignature, Clock, BookOpen, Truck
} from 'lucide-react'
import { customersService } from '../../services/customers'
import EnterpriseBadge from '../../components/ui/EnterpriseBadge'
import EnterpriseButton from '../../components/ui/EnterpriseButton'
import PageContainer from '../../components/ui/layout/PageContainer'
import Breadcrumb from '../../components/ui/layout/Breadcrumb'
import DetailTabs from '../../components/ui/layout/DetailTabs'
import type { TabItem } from '../../components/ui/layout/DetailTabs'

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
    <PageContainer>
      <Breadcrumb
        items={[
          { label: 'Company' },
          { label: 'Customers', href: '/company/customers' },
          { label: customer.customerName }
        ]}
        backHref="/company/customers"
        backLabel="Back to Customers"
      />

      {/* 2. TOP SUMMARY PROFILE CARD */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
            className="inline-flex items-center gap-1.5 h-8 px-3 font-bold text-xs"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit
          </EnterpriseButton>
          <EnterpriseButton variant="secondary" disabled className="h-8 px-3 font-bold text-xs opacity-50">Deactivate</EnterpriseButton>
          <EnterpriseButton variant="danger" disabled className="h-8 px-3 font-bold text-xs opacity-50">Delete</EnterpriseButton>
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



      {/* 4. ACTIVE VIEW RENDERING */}
      <div className="min-h-[400px]">
        {activeTab === 'overview' ? (
          <div className="space-y-6">
            {/* STATISTICS ROW */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Opening Balance</span>
                <div className="text-lg font-black text-slate-800">₹{customer.openingBalance.toLocaleString('en-IN')}</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Outstanding Jars</span>
                <div className="text-lg font-black text-blue-600">{customer.outstandingJars || 0}</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Reserved Empty</span>
                <div className="text-lg font-black text-orange-600">{customer.reservedEmptyJars || 0}</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Max Inventory</span>
                <div className="text-lg font-black text-slate-800">{customer.maxJarLimit || 0}</div>
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
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Payment Terms</span>
                    <span className="block font-semibold text-slate-800">{customer.paymentTerms}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Price List Code</span>
                    <span className="block font-mono font-semibold text-slate-800">{customer.priceList || 'Default List'}</span>
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
                  {customer.addressesJson && customer.addressesJson !== '[]' && (
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Secondary Branches</span>
                      <div className="max-h-[100px] overflow-y-auto text-[11px] font-medium text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed">
                        {customer.addressesJson}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2 */}
              {/* Left: Logistics & Distributor Configuration (colspan 2) */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm lg:col-span-2 flex flex-col">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-blue-500" /> Logistics & Setup
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs flex-1">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Assigned Driver</span>
                    <span className="block font-semibold text-slate-800">{customer.assignedDriver || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Assigned Sales Exec</span>
                    <span className="block font-semibold text-slate-800">{customer.assignedSalesExecutive || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Working Coverage Area</span>
                    <span className="block font-semibold text-slate-800">{customer.workingArea || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Working Days</span>
                    <span className="block font-semibold text-slate-800">{customer.workingDays || 'N/A'}</span>
                  </div>
                  {customer.customerType === 'Distributor' && (
                    <>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Commission Rate</span>
                        <span className="block font-semibold text-slate-800">{customer.commissionPercentage}%</span>
                      </div>
                      <div>
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
                <div className="space-y-4 text-xs flex-1">
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
                      <BookOpen className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Preferred Brand</span>
                      <span className="block font-semibold text-slate-800 leading-none">{customer.preferredJarBrand || 'Default (Aquora)'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Seal Required</span>
                      <span className="block font-semibold text-slate-800 leading-none">{customer.sealRequired ? 'Double seal check' : 'Standard'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                      <Truck className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Delivery Schedule</span>
                      <span className="block font-semibold text-slate-800 leading-none">{customer.deliveryFrequency || 'Daily'} ({customer.preferredDeliveryTime || 'Morning'})</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Internal Notes & Remarks */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm lg:col-span-3">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2 mb-3 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-500" /> Internal Notes & Remarks
                </h4>
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg min-h-[60px] text-left">
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
        ) : (
          /* Visual Placeholders for other tabs */
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm flex flex-col items-center justify-center gap-4 select-none">
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
              <Landmark className="w-6 h-6 animate-pulse text-blue-500" />
            </div>
            <div>
              <h5 className="text-sm font-bold text-slate-800">Module Integration Placeholder</h5>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-2 leading-relaxed">
                The {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} subview is a visual placeholder for the upcoming ERP module implementation. 
                Transaction logs, outstanding ledger mappings, and analytical reports are currently out of scope.
              </p>
            </div>
            <div className="flex gap-2.5 mt-2">
              <EnterpriseButton variant="secondary" size="sm" disabled className="opacity-50 text-[11px] font-bold h-8 px-3">
                Create Sales Order
              </EnterpriseButton>
              <EnterpriseButton variant="secondary" size="sm" disabled className="opacity-50 text-[11px] font-bold h-8 px-3">
                Record Payment
              </EnterpriseButton>
              <EnterpriseButton variant="secondary" size="sm" disabled className="opacity-50 text-[11px] font-bold h-8 px-3">
                Create Dispatch
              </EnterpriseButton>
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