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
  Tag,
  Activity,
  FileSpreadsheet,
  TrendingUp,
  Wallet
} from 'lucide-react'
import { PrintPreviewModal } from '../../../components/ui/PrintPreviewModal'
import { RecordPurchasePaymentModal } from '../../../components/purchases/RecordPurchasePaymentModal'
import { purchaseService, type Purchase } from '../../../services/purchases'
import { vendorService, type Vendor } from '../../../services/vendors'
import { simpleAccountsService } from '../../../services/simpleAccounts'
import { useNotificationStore } from '../../../store/useNotificationStore'
import EnterpriseHeader from '../../../components/ui/EnterpriseHeader'
import EnterpriseCard from '../../../components/ui/EnterpriseCard'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import EnterpriseBadge from '../../../components/ui/EnterpriseBadge'
import EnterpriseModal from '../../../components/ui/EnterpriseModal'
import EnterpriseLoading from '../../../components/ui/EnterpriseLoading'
import EnterpriseNumberInput from '../../../components/ui/EnterpriseNumberInput'
import { formatDate, formatTime, formatDateTime } from '../../../utils/dateFormatter'

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
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false)

  // Print Preview Modal States
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [printDocData, setPrintDocData] = useState<any>(null)

  const handlePrintPurchase = (p: Purchase) => {
    setPrintDocData({
      title: 'Purchase Invoice',
      docNumber: p.purchaseNo,
      date: formatDate(p.purchaseDate),
      partyLabel: 'Vendor',
      partyInfo: {
        name: p.vendorName || 'General Vendor',
        details1: p.vendorCode || '—',
        details2: '—'
      },
      preparedBy: p.createdByName || 'System',
      paymentDetails: {
        method: p.paymentMethod || 'N/A',
        reference: p.referenceNumber || '—'
      },
      items: p.items?.map((item, index) => ({
        sno: index + 1,
        description: item.rawMaterialName || item.itemName || 'Raw Material Item',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.totalAmount
      })) || [
        {
          sno: 1,
          description: `Purchase record: ${p.purchaseCategory || ''}`,
          quantity: 1,
          unitPrice: p.grandTotal,
          amount: p.grandTotal
        }
      ],
      financialSummary: {
        subTotal: p.subTotal || p.grandTotal,
        taxAmount: p.taxAmount || 0,
        discountAmount: p.discountAmount || 0,
        grandTotal: p.grandTotal,
        amountPaid: p.amountPaid || 0,
        balance: p.balanceAmount || 0
      },
      notes: p.notes || 'No remarks provided.'
    });
    setPrintModalOpen(true);
  };

  const fetchPurchaseDetails = async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await purchaseService.getPurchaseById(id)
      setPurchase(data)
      if (data && data.vendorId) {
        try {
          const v = await vendorService.getVendorById(data.vendorId)
          setVendor(v)
        } catch (vErr) {
          console.error('Failed to prefetch vendor details:', vErr)
        }
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to load purchase details', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPurchaseDetails()
  }, [id])

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

  const renderCategoryDetails = () => {
    const meta = categoryMeta || {}
    switch (purchase.purchaseCategory) {
      case 'RawMaterial':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Raw Material Name</span>
              <span className="text-xs font-semibold text-slate-800">{meta.rawMaterialName || purchase.items[0]?.rawMaterialName || purchase.items[0]?.itemName || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Grade / Specification</span>
              <span className="text-xs font-semibold text-slate-800">{meta.grade || meta.specification || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Quantity & Unit</span>
              <span className="text-xs font-semibold text-slate-800">{purchase.items[0]?.quantity} {purchase.items[0]?.unit || 'Pcs'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Supplier Batch</span>
              <span className="text-xs font-semibold font-mono text-slate-800">{meta.supplierBatch || '—'}</span>
            </div>
          </div>
        )
      case 'Machine':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Machine Name</span>
              <span className="text-xs font-semibold text-slate-800">{meta.machineName || purchase.assetName || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Brand & Model</span>
              <span className="text-xs font-semibold text-slate-800">{meta.brand || '—'} / {meta.model || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Serial Number</span>
              <span className="text-xs font-semibold font-mono text-slate-800">{meta.serialNumber || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Warranty</span>
              <span className="text-xs font-semibold text-slate-800">{meta.warranty || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Asset ID</span>
              <span className="text-xs font-semibold font-mono text-slate-800">{purchase.assetId || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Installation Status</span>
              <span className="text-xs font-semibold text-slate-800">{meta.installationStatus || '—'}</span>
            </div>
          </div>
        )
      case 'OfficeAsset':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Asset Name</span>
              <span className="text-xs font-semibold text-slate-800">{meta.assetName || purchase.assetName || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Asset Type</span>
              <span className="text-xs font-semibold text-slate-800">{meta.assetType || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Department</span>
              <span className="text-xs font-semibold text-slate-800">{meta.department || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Assigned Location</span>
              <span className="text-xs font-semibold text-slate-800">{meta.assignedLocation || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Useful Life</span>
              <span className="text-xs font-semibold text-slate-800">{meta.usefulLife || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Depreciation Method</span>
              <span className="text-xs font-semibold text-slate-800">{meta.depreciationMethod || '—'}</span>
            </div>
          </div>
        )
      case 'Service':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Service Name</span>
              <span className="text-xs font-semibold text-slate-800">{meta.serviceName || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Service Period</span>
              <span className="text-xs font-semibold text-slate-800">{meta.servicePeriod || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Provider</span>
              <span className="text-xs font-semibold text-slate-800">{meta.provider || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Remarks</span>
              <span className="text-xs font-semibold text-slate-800">{meta.remarks || meta.notes || purchase.notes || '—'}</span>
            </div>
          </div>
        )
      case 'Vehicle':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Vehicle Name</span>
              <span className="text-xs font-semibold text-slate-800">{meta.vehicleName || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Registration Number</span>
              <span className="text-xs font-semibold font-mono text-slate-800">{meta.registrationNumber || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Chassis Number</span>
              <span className="text-xs font-semibold font-mono text-slate-800">{meta.chassisNumber || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Engine Number</span>
              <span className="text-xs font-semibold font-mono text-slate-800">{meta.engineNumber || '—'}</span>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  // Double entry accounting helper titles
  const getDebitAccount = () => {
    switch (purchase.purchaseCategory) {
      case 'RawMaterial':
        return 'Raw Material Inventory Stock'
      case 'Machine':
      case 'OfficeAsset':
        return 'Capitalized Fixed Asset'
      default:
        return 'General Operating Expense'
    }
  }

  const getCreditAccount = () => {
    if (purchase.paymentMethod === 'Credit') {
      return `Accounts Payable - ${purchase.vendorName}`
    } else if (purchase.paymentMethod === 'BankAccount' || purchase.paymentMethod === 'UPI' || purchase.paymentMethod === 'Cheque') {
      return `Cash at Bank - ${purchase.bankAccountName || 'Bank Account'}`
    } else {
      return `Cash on Hand - ${purchase.cashBookName || 'Cash Book'}`
    }
  }

  return (
    <div className="space-y-6 select-none w-full pb-12">
      {/* Header */}
      <EnterpriseHeader
        title={`Purchase: ${purchase.purchaseNo}`}
        description={`Record Created: ${formatDate(purchase.createdAt)} | Invoice: ${purchase.invoiceNumber || '—'}`}
        actions={
          <div className="flex items-center gap-2">
            <EnterpriseButton variant="secondary" size="sm" onClick={() => navigate('/company/accounts/purchases')}>
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Directory
            </EnterpriseButton>
            <EnterpriseButton variant="secondary" size="sm" onClick={() => handlePrintPurchase(purchase)}>
              <Printer className="w-4 h-4 mr-1.5" /> Print
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
                    <Plus className="w-4 h-4 mr-1.5" /> Pay Balance
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main Left Columns: Purchased Items register takes center stage */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 1. Large Purchased Items register */}
          <EnterpriseCard title={`Purchased Items Register (${purchase.items?.length || 0})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <th className="p-3">Item Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Quantity</th>
                    <th className="p-3 text-right">Unit Rate (₹)</th>
                    <th className="p-3 text-right">Discount (₹)</th>
                    <th className="p-3 text-right">GST %</th>
                    <th className="p-3 text-right">Taxable Amt (₹)</th>
                    <th className="p-3 text-right">Total Amt (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchase.items && purchase.items.length > 0 ? (
                    purchase.items.map((item) => {
                      const taxable = (item.quantity * item.unitPrice) - item.discountAmount
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-900">
                            {item.rawMaterialName || item.itemName}
                          </td>
                          <td className="p-3 text-slate-500">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                              {purchase.purchaseCategory}
                            </span>
                          </td>
                          <td className="p-3 text-right font-medium text-slate-700">{item.quantity} {item.unit}</td>
                          <td className="p-3 text-right font-mono text-slate-600">₹{item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 text-right font-mono text-emerald-600">₹{item.discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 text-right font-mono text-slate-500">{item.gstPercent}%</td>
                          <td className="p-3 text-right font-mono text-slate-700">₹{taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 text-right font-bold font-mono text-slate-900">₹{item.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-4 text-center text-slate-400 italic">No purchase items recorded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Category-Specific Specifications Adaptable View */}
            {renderCategoryDetails()}
          </EnterpriseCard>

          {/* 2. Purchase Summary directly below the items table */}
          <EnterpriseCard title="Financial Breakdown Summary">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-2 text-slate-600">
                <div className="flex justify-between">
                  <span>Number of Items:</span>
                  <span className="font-semibold text-slate-900">{purchase.items?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Quantity:</span>
                  <span className="font-semibold text-slate-900">
                    {purchase.items?.reduce((sum, item) => sum + item.quantity, 0) || 0} units
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Gross Subtotal:</span>
                  <span className="font-mono text-slate-900">₹{purchase.subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Discount Allowed:</span>
                  <span className="font-mono text-emerald-600">- ₹{purchase.discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="space-y-2 text-slate-600 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-6">
                <div className="flex justify-between">
                  <span>Freight & Other Charges:</span>
                  <span className="font-mono text-slate-800">+ ₹{purchase.otherCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST Tax amount:</span>
                  <span className="font-mono text-slate-800">₹{purchase.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-extrabold text-sm border-t border-slate-200 pt-2">
                  <span>Grand Total:</span>
                  <span className="font-mono text-blue-600">₹{purchase.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </EnterpriseCard>

          {/* 3. Accounting Ledger double entry impact display */}
          <EnterpriseCard title="General Ledger Journal Impact">
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <th className="p-2.5">Account Ledger Description</th>
                    <th className="p-2.5 text-right">Debit (₹)</th>
                    <th className="p-2.5 text-right">Credit (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-3 font-semibold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      {getDebitAccount()}
                    </td>
                    <td className="p-3 text-right font-extrabold font-mono text-slate-900">
                      ₹{purchase.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right text-slate-400 font-mono">—</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-800 pl-8 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      {getCreditAccount()}
                    </td>
                    <td className="p-3 text-right text-slate-400 font-mono">—</td>
                    <td className="p-3 text-right font-extrabold font-mono text-slate-900">
                      ₹{purchase.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </EnterpriseCard>

          {/* 4. Subsystem status updates */}
          <EnterpriseCard title="Integrated Subsystem Posting Impact">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 block">General Ledger Posted</span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Double-entry accounting journal vouchers generated & committed.</span>
                </div>
              </div>

              {purchase.purchaseCategory === 'RawMaterial' ? (
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900 block">Inventory Stock Increased</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">Raw materials added to current stock balances and registered.</span>
                  </div>
                </div>
              ) : (purchase.purchaseCategory === 'Machine' || purchase.purchaseCategory === 'OfficeAsset') ? (
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900 block">Capital Asset Registered</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">Capitalized assets generated & linked to asset registers.</span>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900 block">Operating Expense Post</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">Expense voucher logged against corporate operating budgets.</span>
                  </div>
                </div>
              )}

              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 block">Vendor Balance Updated</span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Outstanding balance for {purchase.vendorName} adjusted.</span>
                </div>
              </div>

              {purchase.amountPaid > 0 && (
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900 block">Bank / Cash Balance Reduced</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">Settled funds deducted from {purchase.bankAccountName || purchase.cashBookName || 'General Account'}.</span>
                  </div>
                </div>
              )}
            </div>
          </EnterpriseCard>

          {/* 5. Payment Settlement history logs */}
          <EnterpriseCard
            title={`Payment Settlements Ledger (${purchase.payments?.length || 0})`}
            extra={
              purchase.balanceAmount > 0 && !purchase.isCancelled ? (
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Record Payment
                </button>
              ) : null
            }
          >
            {purchase.payments && purchase.payments.length > 0 ? (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Payment Method</th>
                      <th className="p-2.5">Reference No / UTR</th>
                      <th className="p-2.5 text-right">Amount Settled (₹)</th>
                      <th className="p-2.5">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchase.payments.map((pay) => (
                      <tr key={pay.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-slate-800">{formatDate(pay.paymentDate)}</td>
                        <td className="p-3 text-slate-600">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                            {pay.paymentMethod}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-500">{pay.referenceNo || '—'}</td>
                        <td className="p-3 text-right font-extrabold font-mono text-emerald-600">
                          ₹{pay.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-slate-600">{pay.createdByName || 'System'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic p-3 text-center">No payment settlements found for this invoice.</p>
            )}
          </EnterpriseCard>

        </div>

        {/* Sidebar columns: Vendor Profile & Payment Summary */}
        <div className="space-y-6">

          {/* 1. Standardized Vendor Profile Card */}
          <EnterpriseCard title="Vendor Profile Summary">
            <div className="space-y-4 text-xs">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 font-extrabold flex items-center justify-center text-sm border border-blue-100">
                  {purchase.vendorName.charAt(0)}
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm leading-tight">{purchase.vendorName}</h4>
                  <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">{purchase.vendorCode || 'VENDOR-CODE-NA'}</span>
                </div>
              </div>

              <div className="space-y-2.5 text-slate-600">
                <div className="flex justify-between">
                  <span>Contact Person:</span>
                  <span className="font-semibold text-slate-850">{vendor?.name || purchase.vendorName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Phone Number:</span>
                  <span className="font-semibold font-mono text-slate-800">{vendor?.phone || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Email Address:</span>
                  <span className="font-semibold text-slate-800">{vendor?.email || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>GSTIN Identifier:</span>
                  <span className="font-semibold font-mono text-slate-800">{vendor?.gst || '—'}</span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Outstanding balance:</span>
                  <span className="font-bold text-red-600 font-mono">
                    ₹{(vendor?.currentBalance ?? purchase.balanceAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Purchase Value:</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    ₹{(vendor?.totalPurchaseValue ?? purchase.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Last Purchase date:</span>
                  <span className="font-semibold text-slate-700">
                    {vendor?.lastPurchaseDate ? formatDate(vendor.lastPurchaseDate) : formatDate(purchase.purchaseDate)}
                  </span>
                </div>
              </div>

              {purchase.vendorId && (
                <EnterpriseButton
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/company/accounts/vendors/${purchase.vendorId}`)}
                  className="w-full mt-2 font-bold"
                >
                  View Vendor Details
                </EnterpriseButton>
              )}
            </div>
          </EnterpriseCard>

          {/* 2. Core Payment Information Card */}
          <EnterpriseCard title="Payment & Settlements Status">
            <div className="space-y-3.5 text-xs text-slate-600">
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                <span>Payment Status:</span>
                {getStatusBadge()}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Settlement Method:</span>
                  <span className="font-bold text-slate-800">{purchase.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span>Bank Account / Cash Book:</span>
                  <span className="font-semibold text-slate-700">
                    {purchase.bankAccountName || purchase.cashBookName || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Amount Settled:</span>
                  <span className="font-mono font-bold text-slate-800">
                    ₹{purchase.amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Unpaid Balance:</span>
                  <span className="font-mono font-bold text-red-600">
                    ₹{purchase.balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Reference Number / UTR:</span>
                  <span className="font-mono text-slate-700">{purchase.referenceNumber || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Settlement Date:</span>
                  <span className="font-medium text-slate-800">{formatDate(purchase.purchaseDate)}</span>
                </div>
              </div>
            </div>
          </EnterpriseCard>

          {/* 3. visual Audit & Timeline Card */}
          <EnterpriseCard title="Audit Lifecycle History">
            {purchase.timelineEvents && purchase.timelineEvents.length > 0 ? (
              <div className="relative border-l-2 border-slate-200 ml-2 space-y-4 py-1 text-xs">
                {purchase.timelineEvents.map((t) => (
                  <div key={t.id} className="relative pl-4">
                    <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-blue-600 border border-white" />
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 leading-tight">{t.action}</span>
                      <span className="text-[11px] text-slate-500 mt-0.5">{t.details}</span>
                      <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                        {formatDateTime(t.eventDate)} • {t.performedByName || 'System'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic text-center p-3">No timeline events recorded.</p>
            )}
          </EnterpriseCard>

        </div>
      </div>

      {/* Shared Record Payment Modal */}
      {showPaymentModal && purchase && (
        <RecordPurchasePaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          purchase={purchase}
          onSuccess={(updatedPurchase) => {
            setPurchase(updatedPurchase)
            fetchPurchaseDetails()
          }}
        />
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
    </div>
  )
}

export default PurchaseDetailsPage
