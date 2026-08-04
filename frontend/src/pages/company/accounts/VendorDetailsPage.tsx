import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  FileText,
  CreditCard,
  ShoppingBag,
  DollarSign,
  Calendar,
  Clock,
  History,
  CheckCircle2,
  Edit2,
  Plus,
  Eye,
  Copy,
  XCircle,
  Trash2,
  Printer,
  RefreshCw,
  ToggleLeft,
  ToggleRight
} from 'lucide-react'
import { PrintPreviewModal } from '../../../components/ui/PrintPreviewModal'
import { vendorService, type VendorDetails } from '../../../services/vendors'
import { purchaseService, type Purchase } from '../../../services/purchases'
import { useNotificationStore } from '../../../store/useNotificationStore'
import EnterpriseHeader from '../../../components/ui/EnterpriseHeader'
import EnterpriseCard from '../../../components/ui/EnterpriseCard'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import EnterpriseBadge from '../../../components/ui/EnterpriseBadge'
import EnterpriseLoading from '../../../components/ui/EnterpriseLoading'

export const VendorDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast } = useNotificationStore()

  const [details, setDetails] = useState<VendorDetails | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [activeTab, setActiveTab] = useState<'purchases' | 'ledger' | 'timeline' | 'summary'>('purchases')

  // Print Preview Modal States
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [printDocData, setPrintDocData] = useState<any>(null)

  const handlePrintVendorStatement = () => {
    if (!details) return
    const vendor = details.vendor
    setPrintDocData({
      title: 'Vendor Statement',
      docNumber: vendor.vendorCode || `VND-${vendor.id.substring(0, 4).toUpperCase()}`,
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      partyLabel: 'Vendor Info',
      partyInfo: {
        name: vendor.name,
        details1: `Email: ${vendor.email || 'N/A'} | Phone: ${vendor.phone || 'N/A'}`,
        details2: `GST: ${vendor.gst || 'N/A'} | Address: ${vendor.address || '—'}`
      },
      preparedBy: 'Accounts Admin',
      paymentDetails: {
        method: 'Statement Record'
      },
      items: [
        {
          sno: 1,
          description: 'Opening Balance Statement Mapping',
          amount: Number(vendor.openingBalance) || 0
        },
        {
          sno: 2,
          description: 'Accumulated Purchases Value',
          amount: details.purchases?.length > 0 ? details.purchases.reduce((acc, curr) => acc + curr.grandTotal, 0) : 0
        }
      ],
      financialSummary: {
        subTotal: (Number(vendor.openingBalance) || 0) + details.purchases.reduce((acc, curr) => acc + curr.grandTotal, 0),
        grandTotal: (Number(vendor.openingBalance) || 0) + details.purchases.reduce((acc, curr) => acc + curr.grandTotal, 0),
        amountPaid: ((Number(vendor.openingBalance) || 0) + details.purchases.reduce((acc, curr) => acc + curr.grandTotal, 0)) - (vendor.currentBalance || 0),
        balance: vendor.currentBalance || 0
      },
      notes: vendor.notes || 'This statement summarizes the ledger standing for the vendor accounts.'
    });
    setPrintModalOpen(true);
  };

  const handlePrintPurchase = (p: Purchase) => {
    if (!details) return
    setPrintDocData({
      title: 'Purchase Invoice',
      docNumber: p.purchaseNo,
      date: new Date(p.purchaseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      partyLabel: 'Vendor',
      partyInfo: {
        name: details.vendor.name,
        details1: details.vendor.email || '—',
        details2: details.vendor.phone || '—'
      },
      preparedBy: p.createdByName || 'System',
      paymentDetails: {
        method: p.paymentMethod || 'N/A',
        reference: '—'
      },
      items: [
        {
          sno: 1,
          description: `Purchase record: ${p.purchaseCategory || ''}`,
          quantity: 1,
          unitPrice: p.grandTotal,
          amount: p.grandTotal
        }
      ],
      financialSummary: {
        subTotal: p.grandTotal,
        taxAmount: 0,
        discountAmount: 0,
        grandTotal: p.grandTotal,
        amountPaid: p.amountPaid || 0,
        balance: p.balanceAmount || 0
      },
      notes: p.notes || 'No remarks provided.'
    });
    setPrintModalOpen(true);
  };

  const fetchVendorDetails = async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await vendorService.getVendorDetails(id)
      setDetails(res)
    } catch (err: any) {
      showToast(err?.message || 'Failed to load vendor details', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVendorDetails()
  }, [id])

  const handleToggleStatus = async () => {
    if (!id || !details) return
    try {
      await vendorService.toggleVendorStatus(id)
      showToast(`Toggled status for vendor ${details.vendor.name}`, 'info')
      fetchVendorDetails()
    } catch (err: any) {
      showToast(err?.message || 'Failed to toggle status', 'error')
    }
  }

  const handleCancelPurchase = async (pId: string, pNo: string) => {
    if (!window.confirm(`Are you sure you want to cancel purchase ${pNo}?`)) return
    try {
      await purchaseService.cancelPurchase(pId)
      showToast(`Purchase ${pNo} cancelled`, 'info')
      fetchVendorDetails()
    } catch (err: any) {
      showToast(err?.message || 'Failed to cancel purchase', 'error')
    }
  }

  const handleDuplicatePurchase = async (pId: string) => {
    try {
      const draft = await purchaseService.duplicatePurchase(pId)
      if (draft) {
        showToast('Duplicate purchase draft generated!', 'success')
        navigate('/company/accounts/purchases/new', { state: { draftData: draft } })
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to duplicate purchase', 'error')
    }
  }

  if (loading) {
    return <EnterpriseLoading label="Loading Vendor Master File..." />
  }

  if (!details) {
    return (
      <div className="p-12 text-center text-slate-500 space-y-3 select-none">
        <p className="font-semibold text-slate-700">Vendor Profile Not Found</p>
        <EnterpriseButton variant="primary" size="sm" onClick={() => navigate('/company/accounts/vendors')}>
          Back to Vendors Directory
        </EnterpriseButton>
      </div>
    )
  }

  const { vendor, summaryStats, purchases, ledger, timeline } = details

  return (
    <div className="space-y-6 select-none w-full">
      {/* Header */}
      <EnterpriseHeader
        title={`Vendor: ${vendor.name}`}
        description={`Code: ${vendor.vendorCode || '-'} | GST: ${vendor.gst || 'Non-GST'} | Phone: ${vendor.phone || '-'}`}
        actions={
          <div className="flex items-center gap-2">
            <EnterpriseButton variant="secondary" size="sm" onClick={() => navigate('/company/accounts/vendors')}>
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Vendors
            </EnterpriseButton>
            <EnterpriseButton variant="secondary" size="sm" onClick={handlePrintVendorStatement}>
              <Printer className="w-4 h-4 mr-1.5" /> Print Statement
            </EnterpriseButton>
            <EnterpriseButton variant="secondary" size="sm" onClick={fetchVendorDetails}>
              <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
            </EnterpriseButton>
            <EnterpriseButton variant="secondary" size="sm" onClick={handleToggleStatus}>
              {vendor.isActive ? <ToggleRight className="w-4 h-4 mr-1.5 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 mr-1.5 text-slate-400" />}
              {vendor.isActive ? 'Active' : 'Inactive'}
            </EnterpriseButton>
            <EnterpriseButton variant="primary" size="sm" onClick={() => navigate('/company/accounts/purchases/new')}>
              <Plus className="w-4 h-4 mr-1.5" /> New Purchase Order
            </EnterpriseButton>
          </div>
        }
      />

      {/* Dynamic KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <EnterpriseCard className="p-3 border-l-4 border-l-red-600">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">Outstanding Balance</span>
          <div className="text-lg font-extrabold text-red-600 font-mono mt-0.5 truncate">
            ₹{summaryStats.outstandingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-3 border-l-4 border-l-blue-600">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">Total Purchases</span>
          <div className="text-lg font-extrabold text-slate-900 font-mono mt-0.5">
            {summaryStats.totalPurchasesCount}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-3 border-l-4 border-l-indigo-600">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">Total Value</span>
          <div className="text-lg font-extrabold text-indigo-600 font-mono mt-0.5 truncate">
            ₹{summaryStats.totalPurchaseValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-3 border-l-4 border-l-emerald-600">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">Paid Amount</span>
          <div className="text-lg font-extrabold text-emerald-600 font-mono mt-0.5 truncate">
            ₹{summaryStats.paidAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-3 border-l-4 border-l-amber-600">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">Average Purchase</span>
          <div className="text-lg font-extrabold text-amber-600 font-mono mt-0.5 truncate">
            ₹{summaryStats.averagePurchaseValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-3 border-l-4 border-l-purple-600">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">Last Purchase</span>
          <div className="text-xs font-bold text-purple-900 font-mono mt-1 truncate">
            {summaryStats.lastPurchaseDate ? new Date(summaryStats.lastPurchaseDate).toLocaleDateString('en-IN') : 'None'}
          </div>
        </EnterpriseCard>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-[#E5E9F2] gap-6 text-sm font-bold text-slate-600">
        <button
          onClick={() => setActiveTab('purchases')}
          className={`pb-2.5 transition-colors border-b-2 ${activeTab === 'purchases' ? 'border-[#1A56DB] text-[#1A56DB]' : 'border-transparent hover:text-slate-900'}`}
        >
          Purchase History ({purchases.length})
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`pb-2.5 transition-colors border-b-2 ${activeTab === 'ledger' ? 'border-[#1A56DB] text-[#1A56DB]' : 'border-transparent hover:text-slate-900'}`}
        >
          Running Account Ledger ({ledger.length})
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`pb-2.5 transition-colors border-b-2 ${activeTab === 'timeline' ? 'border-[#1A56DB] text-[#1A56DB]' : 'border-transparent hover:text-slate-900'}`}
        >
          Vendor Audit Timeline ({timeline.length})
        </button>
        <button
          onClick={() => setActiveTab('summary')}
          className={`pb-2.5 transition-colors border-b-2 ${activeTab === 'summary' ? 'border-[#1A56DB] text-[#1A56DB]' : 'border-transparent hover:text-slate-900'}`}
        >
          Vendor Profile Summary
        </button>
      </div>

      {/* TAB 1: PURCHASE HISTORY */}
      {activeTab === 'purchases' && (
        <EnterpriseCard className="p-0 overflow-hidden">
          {purchases.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs italic">
              No purchase orders recorded for vendor {vendor.name} yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E5E9F2] text-slate-600 font-bold uppercase tracking-wider">
                    <th className="px-4 py-3">Purchase No</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Invoice No</th>
                    <th className="px-4 py-3 text-right">Gross Total</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E9F2]">
                  {purchases.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-[#1A56DB] font-mono whitespace-nowrap">{p.purchaseNo}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{new Date(p.purchaseDate).toLocaleDateString('en-IN')}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><EnterpriseBadge variant="info">{p.purchaseCategory}</EnterpriseBadge></td>
                      <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">{p.invoiceNumber || '-'}</td>
                      <td className="px-4 py-3 text-right font-extrabold text-slate-900 font-mono whitespace-nowrap">₹{p.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-semibold font-mono whitespace-nowrap">₹{p.amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-right text-red-600 font-semibold font-mono whitespace-nowrap">₹{p.balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {p.isCancelled ? (
                          <EnterpriseBadge variant="danger">Cancelled</EnterpriseBadge>
                        ) : p.paymentStatus === 'Paid' ? (
                          <EnterpriseBadge variant="success">Paid</EnterpriseBadge>
                        ) : p.paymentStatus === 'PartiallyPaid' ? (
                          <EnterpriseBadge variant="warning">Partial</EnterpriseBadge>
                        ) : (
                          <EnterpriseBadge variant="danger">Credit</EnterpriseBadge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* VIEW */}
                          <button
                            onClick={() => navigate(`/company/accounts/purchases/${p.id}`)}
                            className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors"
                            title="View Purchase"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* EDIT */}
                          {!p.isCancelled && (
                            <button
                              onClick={() => navigate(`/company/accounts/purchases/edit/${p.id}`)}
                              className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors"
                              title="Edit Purchase"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* PRINT */}
                          <button
                            onClick={() => handlePrintPurchase(p)}
                            className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors"
                            title="Print Purchase Invoice"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* MODULE SPECIFIC EXTRA ACTIONS */}
                          <button
                            onClick={() => handleDuplicatePurchase(p.id)}
                            className="p-1 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded transition-colors"
                            title="Duplicate"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {!p.isCancelled && (
                            <button
                              onClick={() => handleCancelPurchase(p.id, p.purchaseNo)}
                              className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded transition-colors"
                              title="Cancel"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </EnterpriseCard>
      )}

      {/* TAB 2: VENDOR RUNNING ACCOUNT LEDGER */}
      {activeTab === 'ledger' && (
        <EnterpriseCard className="p-0 overflow-hidden">
          {ledger.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs italic">
              No account ledger entries found for vendor {vendor.name}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E5E9F2] text-slate-600 font-bold uppercase tracking-wider">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Transaction Type</th>
                    <th className="px-4 py-3">Voucher / Ref No</th>
                    <th className="px-4 py-3 text-right">Debit (Paid)</th>
                    <th className="px-4 py-3 text-right">Credit (Billed)</th>
                    <th className="px-4 py-3 text-right">Running Balance</th>
                    <th className="px-4 py-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E9F2]">
                  {ledger.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                        {new Date(entry.date).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800">
                        {entry.transactionType}
                      </td>
                      <td className="px-4 py-3 font-mono text-[#1A56DB] whitespace-nowrap">
                        {entry.voucherNo}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-600 font-bold">
                        {entry.debit > 0 ? `₹${entry.debit.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-900 font-bold">
                        {entry.credit > 0 ? `₹${entry.credit.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold font-mono text-red-600">
                        ₹{entry.runningBalance.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-normal">
                        {entry.remarks || entry.reference || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </EnterpriseCard>
      )}

      {/* TAB 3: VENDOR AUDIT TIMELINE */}
      {activeTab === 'timeline' && (
        <EnterpriseCard title="Vendor Audit Event History">
          {timeline.length === 0 ? (
            <p className="text-xs text-slate-400 italic p-2">No timeline events recorded.</p>
          ) : (
            <div className="relative border-l-2 border-slate-200 ml-3 space-y-5 py-2">
              {timeline.map((t) => (
                <div key={t.id} className="relative pl-5">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#1A56DB] border-2 border-white" />
                  <p className="text-xs font-bold text-slate-900">{t.action}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{t.details}</p>
                  <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                    {new Date(t.eventDate).toLocaleString('en-IN')} | Performed By: {t.performedByName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </EnterpriseCard>
      )}

      {/* TAB 4: VENDOR PROFILE SUMMARY */}
      {activeTab === 'summary' && (
        <EnterpriseCard title="Vendor Master File Details">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Vendor Name</span>
              <span className="font-bold text-slate-900">{vendor.name}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Vendor Code</span>
              <span className="font-mono text-[#1A56DB] font-bold">{vendor.vendorCode || '-'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">GST Number</span>
              <span className="font-mono text-slate-900">{vendor.gst || 'Unregistered'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Phone</span>
              <span className="font-semibold text-slate-900">{vendor.phone || '-'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Email</span>
              <span className="font-semibold text-slate-900">{vendor.email || '-'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Opening Balance</span>
              <span className="font-mono font-bold text-slate-900">₹{vendor.openingBalance.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Credit Limit</span>
              <span className="font-mono font-bold text-slate-900">₹{vendor.creditLimit.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Account Status</span>
              <span className="font-bold text-emerald-600">{vendor.isActive ? 'Active Supplier' : 'Inactive'}</span>
            </div>
          </div>

          {vendor.address && (
            <div className="pt-3 mt-3 border-t border-[#E5E9F2]">
              <span className="text-xs text-slate-400 block font-medium mb-1">Registered Address</span>
              <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-[8px] border border-[#E5E9F2]">{vendor.address}</p>
            </div>
          )}
        </EnterpriseCard>
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

export default VendorDetailsPage
