import React, { useState } from 'react'
import { X, UserPlus, Building2, Truck, Check, AlertCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { customerService } from '../../services/customers'
import type { Customer, QuickCreateCustomerRequest } from '../../services/customers'

export interface QuickAddCustomerModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (customer: Customer) => void
  defaultCustomerType?: 'Distributor' | 'B2B' | 'B2C'
  title?: string
}

export const QuickAddCustomerModal: React.FC<QuickAddCustomerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultCustomerType = 'Distributor',
  title
}) => {
  const queryClient = useQueryClient()
  const [customerType, setCustomerType] = useState<'Distributor' | 'B2B' | 'B2C'>(defaultCustomerType)
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [email, setEmail] = useState('')
  const [distributorType, setDistributorType] = useState('EXTERNAL')
  const [assignedVehicle, setAssignedVehicle] = useState('')
  const [assignedRoute, setAssignedRoute] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [city, setCity] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('Immediate')
  const [openingBalance, setOpeningBalance] = useState('')
  const [balanceType, setBalanceType] = useState<'Receivable' | 'Payable' | 'Zero'>('Zero')

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!customerName.trim()) {
      setError('Customer / Distributor name is required.')
      return
    }

    const cleanPhone = phone.trim()
    if (!cleanPhone) {
      setError('Phone number is required.')
      return
    }
    if (cleanPhone.length < 7) {
      setError('Please enter a valid phone number.')
      return
    }

    setIsLoading(true)
    try {
      const payload: QuickCreateCustomerRequest = {
        customerName: customerName.trim(),
        phone: cleanPhone,
        customerType: customerType,
        businessName: businessName.trim() || undefined,
        email: email.trim() || undefined,
        distributorType: customerType === 'Distributor' ? distributorType : undefined,
        assignedVehicle: assignedVehicle.trim() || undefined,
        assignedRoute: assignedRoute.trim() || undefined,
        addressLine1: addressLine1.trim() || undefined,
        city: city.trim() || undefined,
        paymentTerms: paymentTerms || 'Immediate',
        openingBalance: openingBalance ? parseFloat(openingBalance) : 0,
        balanceType: openingBalance && parseFloat(openingBalance) > 0 ? balanceType : 'Zero'
      }

      const res = await customerService.quickCreateCustomer(payload)
      const created = res.data

      // Invalidate relevant caches across the app
      queryClient.invalidateQueries({ queryKey: ['activeCustomersForSales'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['distributors'] })
      queryClient.invalidateQueries({ queryKey: ['20l-distributor-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['20l-distributors'] })

      onSuccess(created)
      onClose()
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.detail || err.message || 'Failed to create record.'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-2xs">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                {title || (customerType === 'Distributor' ? 'Quick Add Distributor' : 'Quick Add Customer')}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Create & immediately select in your current workflow
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs animate-in shake duration-150">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="font-medium">{error}</div>
            </div>
          )}

          {/* Type Selector Tabs */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Account Type *
            </label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => setCustomerType('Distributor')}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  customerType === 'Distributor'
                    ? 'bg-white text-blue-700 shadow-xs border border-blue-200/50'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Distributor</span>
              </button>
              <button
                type="button"
                onClick={() => setCustomerType('B2B')}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  customerType === 'B2B'
                    ? 'bg-white text-blue-700 shadow-xs border border-blue-200/50'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>B2B Commercial</span>
              </button>
              <button
                type="button"
                onClick={() => setCustomerType('B2C')}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  customerType === 'B2C'
                    ? 'bg-white text-blue-700 shadow-xs border border-blue-200/50'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>B2C Retail</span>
              </button>
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                {customerType === 'Distributor' ? 'Distributor / Partner Name' : 'Customer Name'} *
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Apex Beverages"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-50 transition-colors font-medium text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-50 transition-colors font-mono text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Business / Trade Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Apex Traders Pvt Ltd"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-50 transition-colors text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Email Address (Optional)
              </label>
              <input
                type="email"
                placeholder="orders@partner.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-50 transition-colors text-slate-900"
              />
            </div>
          </div>

          {/* Distributor Specific Details */}
          {customerType === 'Distributor' && (
            <div className="p-3.5 bg-blue-50/70 border border-blue-200/60 rounded-xl space-y-3">
              <div className="text-[10px] font-extrabold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-blue-600" />
                <span>Distributor Logistics & Operations</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Distributor Model
                  </label>
                  <select
                    value={distributorType}
                    onChange={(e) => setDistributorType(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="EXTERNAL">External / Independent</option>
                    <option value="INTERNAL_SALES_REP">In-House Staff</option>
                    <option value="ROUTE_PARTNER">Route Delivery Partner</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Assigned Vehicle
                  </label>
                  <input
                    type="text"
                    placeholder="KL-07-AW-2020"
                    value={assignedVehicle}
                    onChange={(e) => setAssignedVehicle(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-lg font-mono text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Assigned Route
                  </label>
                  <input
                    type="text"
                    placeholder="Route 1 — North"
                    value={assignedRoute}
                    onChange={(e) => setAssignedRoute(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Payment Terms & Commercial Agreement */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Payment Terms (Flexible)
              </label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 font-medium text-slate-900 cursor-pointer"
              >
                <option value="Immediate">Immediate Payment (Cash / UPI / Bank)</option>
                <option value="COD">Cash on Delivery (COD)</option>
                <option value="Net 7">Net 7 Days Credit</option>
                <option value="Net 15">Net 15 Days Credit</option>
                <option value="Net 30">Net 30 Days Credit</option>
                <option value="Credit">Custom Credit Line</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                City / Location (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Ernakulam"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Address (Optional)
            </label>
            <input
              type="text"
              placeholder="Building, Street, Landmark"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 text-slate-900"
            />
          </div>

          {/* Opening Balance (Optional) */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
            <div className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
              Opening Balance / Ledger Setup (Optional)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Balance Type
                </label>
                <select
                  value={balanceType}
                  onChange={(e) => setBalanceType(e.target.value as any)}
                  className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="Zero">Zero / Clean</option>
                  <option value="Receivable">Receivable (Customer owes us)</option>
                  <option value="Payable">Payable (We owe customer / deposit)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Persisting Record...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Create & Select</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
