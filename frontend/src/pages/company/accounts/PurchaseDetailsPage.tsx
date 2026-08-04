import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ShoppingBag,
  Building2,
  Calendar,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Layers,
  FileText,
  History,
  Printer,
  Edit2,
  Copy,
  XCircle,
  Download,
  Info,
  DollarSign,
  User,
  Tag
} from 'lucide-react'
import { purchaseService, type Purchase, type AddPurchasePaymentRequest } from '../../../services/purchases'
import { simpleAccountsService } from '../../../services/simpleAccounts'
import { useNotificationStore } from '../../../store/useNotificationStore'
import EnterpriseHeader from '../../../components/ui/EnterpriseHeader'
import EnterpriseCard from '../../../components/ui/EnterpriseCard'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import EnterpriseBadge from '../../../components/ui/EnterpriseBadge'
import EnterpriseModal from '../../../components/ui/EnterpriseModal'
import EnterpriseLoading from '../../../components/ui/EnterpriseLoading'
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

export const PurchaseDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast } = useNotificationStore()

  const [purchase, setPurchase] = useState<Purchase | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false)
  const [paymentSubmitting, setPaymentSubmitting] = useState<boolean>(false)
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([])
  const [cashBooks, setCashBooks] = useState<CashBookOption[]>([])

  const [paymentRequest, setPaymentRequest] = useState<AddPurchasePaymentRequest>({
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'BankAccount',
    bankAccountId: '',
    cashBookId: '',
    amount: 0,
    referenceNo: '',
    notes: ''
  })

  const fetchPurchaseDetails = async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await purchaseService.getPurchaseById(id)
      setPurchase(data)
      if (data) {
        setPaymentRequest((prev) => ({
          ...prev,
          amount: data.balanceAmount
        }))
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to load purchase details', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPurchaseDetails()
    loadBankAccounts()
    loadCashBooks()
  }, [id])

  const loadBankAccounts = async () => {
    try {
      const res = await simpleAccountsService.getBankAccountDropdown()
      setBankAccounts(Array.isArray(res) ? res : [])
    } catch {
      setBankAccounts([])
    }
  }

  const loadCashBooks = async () => {
    try {
      const res = await simpleAccountsService.getCashBookDropdown()
      setCashBooks(Array.isArray(res) ? res : [])
    } catch {
      setCashBooks([])
    }
  }

  const handleCancel = async () => {
    if (!purchase || !id) return
    if (!window.confirm(`Are you sure you want to cancel purchase ${purchase.purchaseNo}? This will reverse inventory stock and vendor balance.`)) return
    try {
      await purchaseService.cancelPurchase(id)
      showToast(`Purchase ${purchase.purchaseNo} cancelled successfully`, 'info')
      fetchPurchaseDetails()
    } catch (err: any) {
      showToast(err?.message || 'Failed to cancel purchase', 'error')
    }
  }

  const handleDuplicate = async () => {
    if (!id) return
    try {
      const draft = await purchaseService.duplicatePurchase(id)
      if (draft) {
        showToast('Duplicate draft generated!', 'success')
        navigate('/company/accounts/purchases/new', { state: { draftData: draft } })
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to duplicate purchase', 'error')
    }
  }

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !purchase) return

    const amt = typeof paymentRequest.amount === 'number' ? paymentRequest.amount : (parseFloat(paymentRequest.amount) || 0)
    if (amt <= 0) {
      showToast('Payment amount must be greater than zero.', 'error')
      return
    }

    setPaymentSubmitting(true)
    try {
      await purchaseService.addPayment(id, { ...paymentRequest, amount: amt })
      showToast('Payment recorded successfully', 'success')
      setShowPaymentModal(false)
      fetchPurchaseDetails()
    } catch (err: any) {
      showToast(err?.message || 'Failed to add payment', 'error')
    } finally {
      setPaymentSubmitting(false)
    }
  }

  if (loading) {
    return <EnterpriseLoading label="Loading ERP Purchase Dashboard..." />
  }

  if (!purchase) {
    return (
      <div className="p-12 text-center text-slate-500 space-y-3 select-none">
        <p className="font-semibold text-slate-700">Purchase Record Not Found</p>
        <EnterpriseButton variant="primary" size="sm" onClick={() => navigate('/company/accounts/purchases')}>
          Back to Purchases Directory
        </EnterpriseButton>
      </div>
    )
  }

  const parseMetadata = () => {
    if (!purchase.categoryMetadataJson) return null
    try {
      return JSON.parse(purchase.categoryMetadataJson)
    } catch {
      return null
    }
  }

  const categoryMeta = parseMetadata()
  const cgstAmount = (purchase.taxAmount || 0) / 2
  const sgstAmount = (purchase.taxAmount || 0) / 2

  const getStatusBadge = () => {
    if (purchase.isCancelled || purchase.paymentStatus === 'Cancelled') {
      return <EnterpriseBadge variant="danger">Cancelled</EnterpriseBadge>
    }
    switch (purchase.paymentStatus) {
      case 'Paid':
        return <EnterpriseBadge variant="success">Paid</EnterpriseBadge>
      case 'PartiallyPaid':
        return <EnterpriseBadge variant="warning">Partially Paid</EnterpriseBadge>
      default:
        return <EnterpriseBadge variant="danger">Credit / Unpaid</EnterpriseBadge>
    }
  }

  return (
    <div className="space-y-6 select-none w-full">
      {/* Header */}
      <EnterpriseHeader
        title={`Purchase Order: ${purchase.purchaseNo}`}
        description={`Vendor: ${purchase.vendorName} | Category: ${purchase.purchaseCategory} | Date: ${new Date(purchase.purchaseDate).toLocaleDateString('en-IN')}`}
        actions={
          <div className="flex items-center gap-2">
            <EnterpriseButton variant="secondary" size="sm" onClick={() => navigate('/company/accounts/purchases')}>
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
            </EnterpriseButton>
            <EnterpriseButton variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1.5" /> Print Invoice
            </EnterpriseButton>
            {!purchase.isCancelled && (
              <>
                <EnterpriseButton variant="secondary" size="sm" onClick={() => navigate(`/company/accounts/purchases/edit/${purchase.id}`)}>
                  <Edit2 className="w-4 h-4 mr-1.5 text-blue-600" /> Edit
                </EnterpriseButton>
                <EnterpriseButton variant="secondary" size="sm" onClick={handleDuplicate}>
                  <Copy className="w-4 h-4 mr-1.5 text-purple-600" /> Duplicate
                </EnterpriseButton>
                {purchase.balanceAmount > 0 && (
                  <EnterpriseButton variant="primary" size="sm" onClick={() => setShowPaymentModal(true)}>
                    <Plus className="w-4 h-4 mr-1.5" /> Record Payment
                  </EnterpriseButton>
                )}
                <EnterpriseButton variant="danger" size="sm" onClick={handleCancel}>
                  <XCircle className="w-4 h-4 mr-1.5" /> Cancel
                </EnterpriseButton>
              </>
            )}
          </div>
        }
      />

      {/* KPI Cards Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <EnterpriseCard className="p-4 border-l-4 border-l-blue-600">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Grand Total</span>
          <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
            ₹{purchase.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-4 border-l-4 border-l-emerald-600">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Amount Paid</span>
          <div className="text-2xl font-extrabold text-emerald-600 font-mono mt-1">
            ₹{purchase.amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-4 border-l-4 border-l-red-600">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Remaining Balance</span>
          <div className="text-2xl font-extrabold text-red-600 font-mono mt-1">
            ₹{purchase.balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-4 border-l-4 border-l-purple-600">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Payment Status</span>
          <div className="mt-2 flex items-center justify-between">
            {getStatusBadge()}
            <span className="text-xs text-slate-400 font-mono">{purchase.paymentMethod}</span>
          </div>
        </EnterpriseCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2-Column Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* General & Vendor Info */}
          <EnterpriseCard title="General & Vendor Information">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Purchase Number</span>
                <span className="font-bold text-[#1A56DB] font-mono">{purchase.purchaseNo}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Purchase Date</span>
                <span className="font-semibold text-slate-900">{new Date(purchase.purchaseDate).toLocaleDateString('en-IN')}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Vendor Name</span>
                <span className="font-bold text-slate-900">{purchase.vendorName}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Vendor Code</span>
                <span className="font-mono text-slate-700">{purchase.vendorCode || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Invoice Number</span>
                <span className="font-mono text-slate-900 font-bold">{purchase.invoiceNumber || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Tax Mode</span>
                <span className="font-semibold text-slate-900">{purchase.taxAmount > 0 ? 'GST Purchase' : 'Non-GST Purchase'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Created By</span>
                <span className="font-semibold text-slate-900">{purchase.createdByName || 'Unknown User'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Posting Status</span>
                <span className="text-emerald-700 font-bold">Posted to Ledger</span>
              </div>
            </div>
            {purchase.notes && (
              <div className="pt-3 mt-3 border-t border-[#E5E9F2]">
                <span className="text-xs text-slate-400 block font-medium mb-1">Remarks & Notes</span>
                <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-[8px] border border-[#E5E9F2]">{purchase.notes}</p>
              </div>
            )}
          </EnterpriseCard>

          {/* Full Width Line Items Table */}
          {purchase.items && purchase.items.length > 0 && (
            <EnterpriseCard title={`Purchase Item Register (${purchase.items.length})`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E5E9F2] text-slate-600 font-bold uppercase tracking-wider">
                      <th className="p-3">Item Name</th>
                      <th className="p-3">Quantity</th>
                      <th className="p-3 text-right">Unit Rate (₹)</th>
                      {purchase.taxAmount > 0 && <th className="p-3 text-right">GST %</th>}
                      <th className="p-3 text-right">Discount</th>
                      <th className="p-3 text-right">Taxable Amt</th>
                      <th className="p-3 text-right font-mono">Row Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E9F2]">
                    {purchase.items.map((item) => {
                      const base = item.quantity * item.unitPrice
                      return (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-900">
                            {item.rawMaterialName || item.itemName}
                          </td>
                          <td className="p-3 text-slate-600">{item.quantity} {item.unit}</td>
                          <td className="p-3 text-right font-mono">₹{item.unitPrice.toFixed(2)}</td>
                          {purchase.taxAmount > 0 && <td className="p-3 text-right font-mono">{item.gstPercent}%</td>}
                          <td className="p-3 text-right font-mono">₹{item.discountAmount.toFixed(2)}</td>
                          <td className="p-3 text-right font-mono text-slate-700">₹{base.toFixed(2)}</td>
                          <td className="p-3 text-right font-extrabold font-mono text-slate-900">₹{item.totalAmount.toFixed(2)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </EnterpriseCard>
          )}

          {/* ERP Subsystem Impacts: Accounting Ledger & Inventory */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EnterpriseCard title="Accounting Entry Impact">
              <div className="space-y-2 text-xs">
                <div className="p-2.5 bg-emerald-50/70 rounded-[6px] border border-emerald-200 text-emerald-950 flex items-center justify-between">
                  <div>
                    <span className="font-bold block">Debit: {purchase.purchaseCategory} Account</span>
                    <span className="text-[11px] text-emerald-800">Inventory Stock / Asset Account</span>
                  </div>
                  <span className="font-extrabold font-mono text-emerald-700">₹{purchase.grandTotal.toFixed(2)}</span>
                </div>
                <div className="p-2.5 bg-blue-50/70 rounded-[6px] border border-blue-200 text-blue-950 flex items-center justify-between">
                  <div>
                    <span className="font-bold block">Credit: {purchase.paymentMethod === 'Credit' ? 'Vendor Creditors' : purchase.paymentMethod}</span>
                    <span className="text-[11px] text-blue-800">{purchase.vendorName}</span>
                  </div>
                  <span className="font-extrabold font-mono text-blue-700">₹{purchase.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </EnterpriseCard>

            <EnterpriseCard title="Subsystem Impact Status">
              <div className="space-y-2 text-xs">
                {purchase.purchaseCategory === 'RawMaterial' && (
                  <div className="p-3 bg-emerald-50 rounded-[8px] border border-emerald-200 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-emerald-900 block">Inventory Stock Increased</span>
                      <span className="text-[11px] text-emerald-700">Raw materials automatically logged as Stock IN movements.</span>
                    </div>
                  </div>
                )}
                {(purchase.purchaseCategory === 'Machine' || purchase.purchaseCategory === 'OfficeAsset') && (
                  <div className="p-3 bg-purple-50 rounded-[8px] border border-purple-200 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-purple-900 block">Capital Asset Registered</span>
                      <span className="text-[11px] text-purple-700">Asset record and audit history timeline automatically generated.</span>
                    </div>
                  </div>
                )}
                {['OfficeExpense', 'Service', 'Maintenance', 'Utility', 'Vehicle', 'Software', 'Other'].includes(purchase.purchaseCategory) && (
                  <div className="p-3 bg-blue-50 rounded-[8px] border border-blue-200 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-blue-900 block">Operating Expense Posted</span>
                      <span className="text-[11px] text-blue-700">Expense voucher posted into general ledger balances.</span>
                    </div>
                  </div>
                )}
              </div>
            </EnterpriseCard>
          </div>

          {/* Payment History */}
          <EnterpriseCard
            title={`Payment Settlement History (${purchase.payments.length})`}
            extra={
              purchase.balanceAmount > 0 && !purchase.isCancelled ? (
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="text-xs text-[#1A56DB] hover:underline font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Payment
                </button>
              ) : null
            }
          >
            {purchase.payments.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-2">No payments recorded for this purchase yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E5E9F2] text-slate-600 font-bold uppercase tracking-wider">
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Method</th>
                      <th className="p-2.5">Ref / UTR</th>
                      <th className="p-2.5 text-right font-mono">Amount Paid</th>
                      <th className="p-2.5">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E9F2]">
                    {purchase.payments.map((pay) => (
                      <tr key={pay.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-semibold text-slate-900">{new Date(pay.paymentDate).toLocaleDateString('en-IN')}</td>
                        <td className="p-2.5"><EnterpriseBadge variant="info">{pay.paymentMethod}</EnterpriseBadge></td>
                        <td className="p-2.5 font-mono text-slate-600">{pay.referenceNo || '-'}</td>
                        <td className="p-2.5 text-right font-extrabold font-mono text-emerald-600">₹{pay.amount.toFixed(2)}</td>
                        <td className="p-2.5 text-slate-600">{pay.createdByName || 'Unknown User'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </EnterpriseCard>
        </div>

        {/* Right 1-Column Section: Financial Summary & Timeline */}
        <div className="space-y-6">
          {/* Financial Breakdown Card */}
          <EnterpriseCard title="Financial Breakdown">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Amount:</span>
                <span className="font-mono font-bold text-slate-900">₹{purchase.subTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Discount Allowed:</span>
                <span className="font-mono text-emerald-600">- ₹{purchase.discountAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Freight & Other Charges:</span>
                <span className="font-mono text-slate-800">+ ₹{purchase.otherCharges.toFixed(2)}</span>
              </div>

              {purchase.taxAmount > 0 && (
                <div className="pt-2 border-t border-[#E5E9F2] space-y-1 text-[11px] text-slate-500">
                  <div className="flex justify-between">
                    <span>CGST (Central Tax):</span>
                    <span className="font-mono">₹{cgstAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SGST (State Tax):</span>
                    <span className="font-mono">₹{sgstAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-800 font-bold">
                    <span>Total Tax (GST):</span>
                    <span className="font-mono">₹{purchase.taxAmount.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between text-slate-900 font-extrabold text-sm border-t border-[#E5E9F2] pt-2.5">
                <span>Grand Total:</span>
                <span className="font-mono text-[#1A56DB]">₹{purchase.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </EnterpriseCard>

          {/* Audit Lifecycle Timeline */}
          <EnterpriseCard title="Audit Lifecycle Timeline">
            {purchase.timelineEvents.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-2">No timeline events recorded.</p>
            ) : (
              <div className="relative border-l-2 border-slate-200 ml-3 space-y-5 py-2">
                {purchase.timelineEvents.map((t) => (
                  <div key={t.id} className="relative pl-5">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#1A56DB] border-2 border-white" />
                    <p className="text-xs font-bold text-slate-900">{t.action}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{t.details}</p>
                    <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                      {new Date(t.eventDate).toLocaleString('en-IN')} | {t.performedByName || 'Unknown User'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </EnterpriseCard>
        </div>
      </div>

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <EnterpriseModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          title="Record Subsequent Payment"
        >
          <form onSubmit={handleAddPayment} className="space-y-4">
            <EnterpriseNumberInput
              label="Payment Amount (₹)"
              value={paymentRequest.amount}
              onValueChange={(val) => setPaymentRequest({ ...paymentRequest, amount: Number(val) || 0 })}
              placeholder="0.00"
            />
            <span className="text-[11px] text-slate-400 block -mt-2">Max payable balance: ₹{purchase.balanceAmount.toFixed(2)}</span>

            <div>
              <label className="block text-xs font-semibold text-[#344054] mb-1">Payment Method</label>
              <select
                value={paymentRequest.paymentMethod}
                onChange={(e) => setPaymentRequest({ ...paymentRequest, paymentMethod: e.target.value })}
                className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] font-semibold text-slate-900"
              >
                <option value="BankAccount">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>

            {paymentRequest.paymentMethod === 'BankAccount' && (
              <div>
                <label className="block text-xs font-semibold text-[#344054] mb-1">Bank Account</label>
                <select
                  value={paymentRequest.bankAccountId || ''}
                  onChange={(e) => setPaymentRequest({ ...paymentRequest, bankAccountId: e.target.value })}
                  className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px]"
                >
                  <option value="">-- Choose Bank Account --</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>{b.bankName} - {b.accountName}</option>
                  ))}
                </select>
              </div>
            )}

            {paymentRequest.paymentMethod === 'Cash' && (
              <div>
                <label className="block text-xs font-semibold text-[#344054] mb-1">Cash Book</label>
                <select
                  value={paymentRequest.cashBookId || ''}
                  onChange={(e) => setPaymentRequest({ ...paymentRequest, cashBookId: e.target.value })}
                  className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px]"
                >
                  <option value="">-- Choose Cash Book --</option>
                  {cashBooks.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#344054] mb-1">Reference Number / UTR</label>
              <input
                type="text"
                placeholder="e.g. UTR-99812739"
                value={paymentRequest.referenceNo || ''}
                onChange={(e) => setPaymentRequest({ ...paymentRequest, referenceNo: e.target.value })}
                className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] font-mono"
              />
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-[#E5E9F2]">
              <EnterpriseButton
                type="button"
                variant="secondary"
                onClick={() => setShowPaymentModal(false)}
              >
                Cancel
              </EnterpriseButton>
              <EnterpriseButton
                type="submit"
                variant="primary"
                loading={paymentSubmitting}
              >
                Confirm Payment
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
      )}
    </div>
  )
}

export default PurchaseDetailsPage
