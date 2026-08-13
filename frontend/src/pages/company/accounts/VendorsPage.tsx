import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  Plus,
  Search,
  Building2,
  Phone,
  Mail,
  FileText,
  Trash2,
  Edit2,
  RefreshCw,
  Eye,
  ToggleLeft,
  ToggleRight,
  ShoppingBag,
  DollarSign,
  Printer
} from 'lucide-react'
import { PrintPreviewModal } from '../../../components/ui/PrintPreviewModal'
import { vendorService, type Vendor, type CreateVendorRequest } from '../../../services/vendors'
import { useNotificationStore } from '../../../store/useNotificationStore'
import { useAuthStore } from '../../../store/useAuthStore'
import EnterpriseHeader from '../../../components/ui/EnterpriseHeader'
import EnterpriseCard from '../../../components/ui/EnterpriseCard'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import EnterpriseBadge from '../../../components/ui/EnterpriseBadge'
import EnterpriseModal from '../../../components/ui/EnterpriseModal'
import EnterpriseLoading from '../../../components/ui/EnterpriseLoading'
import EnterpriseNumberInput from '../../../components/ui/EnterpriseNumberInput'

export const VendorsPage: React.FC = () => {
  const navigate = useNavigate()
  const { showToast } = useNotificationStore()
  const { user } = useAuthStore()
  const isOwner = (user?.roles?.some(r => ['owner', 'companyowner', 'platformowner'].includes(r.toLowerCase())) || user?.roleName?.toLowerCase() === 'owner') ?? false
  const canWrite = !isOwner && (user?.roles?.some(r => ['CompanyAdmin', 'Admin', 'Manager', 'Accountant'].includes(r)) ?? false)

  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [search, setSearch] = useState<string>('')
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [pageSize] = useState<number>(10)
  const [totalCount, setTotalCount] = useState<number>(0)

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [submitting, setSubmitting] = useState<boolean>(false)

  // Print Preview Modal States
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [printDocData, setPrintDocData] = useState<any>(null)

  // Form State
  const [formData, setFormData] = useState<{
    name: string
    phone: string
    email: string
    gst: string
    address: string
    openingBalance: number | string
    creditLimit: number | string
    notes: string
  }>({
    name: '',
    phone: '',
    email: '',
    gst: '',
    address: '',
    openingBalance: 0,
    creditLimit: 0,
    notes: ''
  })

  const fetchVendors = async () => {
    setLoading(true)
    try {
      const data = await vendorService.getVendors({
        pageNumber,
        pageSize,
        search
      })
      setVendors(data.items || [])
      setTotalCount(data.totalCount || 0)
    } catch (err: any) {
      showToast(err?.message || 'Failed to load vendors', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVendors()
  }, [pageNumber, search])

  const handlePrintVendorStatement = (vendor: Vendor) => {
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
          amount: (vendor.totalPurchasesCount || 0) > 0 ? (vendor.totalPurchaseValue || 0) : 0
        }
      ],
      financialSummary: {
        subTotal: (Number(vendor.openingBalance) || 0) + (vendor.totalPurchaseValue || 0),
        grandTotal: (Number(vendor.openingBalance) || 0) + (vendor.totalPurchaseValue || 0),
        amountPaid: ((Number(vendor.openingBalance) || 0) + (vendor.totalPurchaseValue || 0)) - (vendor.currentBalance || 0),
        balance: vendor.currentBalance || 0
      },
      notes: vendor.notes || 'This statement summarizes the ledger standing for the vendor accounts.'
    });
    setPrintModalOpen(true);
  };

  const handleOpenCreateModal = () => {
    setEditingVendor(null)
    setFormData({
      name: '',
      phone: '',
      email: '',
      gst: '',
      address: '',
      openingBalance: 0,
      creditLimit: 0,
      notes: ''
    })
    setShowModal(true)
  }

  const handleOpenEditModal = (vendor: Vendor) => {
    setEditingVendor(vendor)
    setFormData({
      name: vendor.name,
      phone: vendor.phone || '',
      email: vendor.email || '',
      gst: vendor.gst || '',
      address: vendor.address || '',
      openingBalance: vendor.openingBalance,
      creditLimit: vendor.creditLimit || 0,
      notes: vendor.notes || ''
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      showToast('Vendor Name is required.', 'error')
      return
    }

    setSubmitting(true)
    try {
      const parsedBalance = typeof formData.openingBalance === 'number' ? formData.openingBalance : (parseFloat(formData.openingBalance) || 0)
      const parsedCreditLimit = typeof formData.creditLimit === 'number' ? formData.creditLimit : (parseFloat(formData.creditLimit) || 0)

      if (editingVendor) {
        await vendorService.updateVendor(editingVendor.id, {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          gst: formData.gst,
          address: formData.address,
          creditLimit: parsedCreditLimit,
          notes: formData.notes
        })
        showToast('Vendor updated successfully.', 'success')
      } else {
        await vendorService.createVendor({
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          gst: formData.gst,
          address: formData.address,
          openingBalance: parsedBalance,
          creditLimit: parsedCreditLimit,
          notes: formData.notes
        })
        showToast('Vendor created successfully.', 'success')
      }
      setShowModal(false)
      fetchVendors()
    } catch (err: any) {
      showToast(err?.message || 'Operation failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async (id: string, name: string) => {
    try {
      await vendorService.toggleVendorStatus(id)
      showToast(`Status toggled for vendor "${name}".`, 'info')
      fetchVendors()
    } catch (err: any) {
      showToast(err?.message || 'Failed to toggle status', 'error')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete vendor "${name}"?`)) return
    try {
      await vendorService.deleteVendor(id)
      showToast('Vendor deleted successfully.', 'info')
      fetchVendors()
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete vendor', 'error')
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1

  return (
    <div className="space-y-6 select-none w-full">
      {/* Header */}
      <EnterpriseHeader
        title="Vendor Management"
        description="Supplier directory, creditor ledgers, purchasing history, and balance tracking"
        actions={
          <div className="flex items-center gap-2">
            <EnterpriseButton variant="secondary" size="sm" onClick={fetchVendors} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </EnterpriseButton>
            {canWrite && (
              <EnterpriseButton variant="primary" size="sm" onClick={handleOpenCreateModal}>
                <Plus className="w-4 h-4 mr-1.5" /> Add New Vendor
              </EnterpriseButton>
            )}
          </div>
        }
      />

      {/* Search & Statistics Bar */}
      <EnterpriseCard className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search vendor code, name, phone, GST..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPageNumber(1)
              }}
              className="w-full h-[40px] pl-9 pr-4 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
            />
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Showing {vendors.length} of {totalCount} Vendors
          </div>
        </div>
      </EnterpriseCard>

      {/* Vendors High-Density Data Table */}
      <EnterpriseCard className="p-0 overflow-hidden">
        {loading ? (
          <EnterpriseLoading label="Loading Vendors Directory..." />
        ) : vendors.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Building2 className="w-10 h-10 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-700">No Vendors Found</p>
            <p className="text-xs">Add your first supplier or business partner to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E5E9F2] text-slate-600 font-bold uppercase tracking-wider">
                  {/* <th className="px-4 py-3">Vendor Code</th> */}
                  <th className="px-4 py-3">Vendor Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">GST Number</th>
                  <th className="px-4 py-3 text-right">Purchases</th>
                  <th className="px-4 py-3 text-right">Total Value</th>
                  <th className="px-4 py-3 text-right">Outstanding Balance</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E9F2]">
                {vendors.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-slate-50 transition-colors">
                    {/* <td className="px-4 py-3 font-bold font-mono text-[#1A56DB]">
                      {vendor.vendorCode || `VND-${vendor.id.substring(0, 4).toUpperCase()}`}
                    </td> */}
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {vendor.name}
                      {vendor.address && (
                        <p className="text-[11px] font-normal text-slate-400 truncate max-w-xs">{vendor.address}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium whitespace-nowrap">
                      {vendor.phone || <span className="text-slate-400">-</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium whitespace-nowrap">
                      {vendor.email || <span className="text-slate-400">-</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs whitespace-nowrap">
                      {vendor.gst ? <EnterpriseBadge variant="info">{vendor.gst}</EnterpriseBadge> : <span className="text-slate-400">-</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 font-mono">
                      {vendor.totalPurchasesCount || 0}
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold text-slate-900 font-mono">
                      ₹{(vendor.totalPurchaseValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold text-red-600 font-mono">
                      ₹{vendor.currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {vendor.isActive ? (
                        <EnterpriseBadge variant="success">Active</EnterpriseBadge>
                      ) : (
                        <EnterpriseBadge variant="danger">Inactive</EnterpriseBadge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* VIEW */}
                        <button
                          onClick={() => navigate(`/company/accounts/vendors/${vendor.id}`)}
                          className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* EDIT */}
                        {canWrite && (
                          <button
                            onClick={() => handleOpenEditModal(vendor)}
                            className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors"
                            title="Edit Vendor"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* PRINT */}
                        <button
                          onClick={() => handlePrintVendorStatement(vendor)}
                          className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors"
                          title="Print Vendor Statement"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>

                        {/* DELETE */}
                        {canWrite && (
                          <button
                            onClick={() => handleDelete(vendor.id, vendor.name)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                            title="Delete Vendor"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* STATUS TOGGLE */}
                        {canWrite && (
                          <button
                            onClick={() => handleToggleStatus(vendor.id, vendor.name)}
                            className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors"
                            title={vendor.isActive ? 'Deactivate Vendor' : 'Activate Vendor'}
                          >
                            {vendor.isActive ? <ToggleRight className="w-3.5 h-3.5 text-emerald-600" /> : <ToggleLeft className="w-3.5 h-3.5 text-slate-400" />}
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

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-[#E5E9F2] flex items-center justify-between bg-slate-50/50">
            <EnterpriseButton
              variant="secondary"
              size="sm"
              disabled={pageNumber <= 1}
              onClick={() => setPageNumber((p) => p - 1)}
            >
              Previous
            </EnterpriseButton>
            <span className="text-xs text-slate-500 font-medium">
              Page {pageNumber} of {totalPages}
            </span>
            <EnterpriseButton
              variant="secondary"
              size="sm"
              disabled={pageNumber >= totalPages}
              onClick={() => setPageNumber((p) => p + 1)}
            >
              Next
            </EnterpriseButton>
          </div>
        )}
      </EnterpriseCard>

      {/* Add / Edit Vendor Modal */}
      {showModal && (
        <EnterpriseModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={editingVendor ? 'Edit Vendor Details' : 'Add New Vendor'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#344054] mb-1">
                Vendor Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Acme Raw Materials Pvt Ltd"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] focus:outline-none focus:border-[#1A56DB]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#344054] mb-1">Phone</label>
                <input
                  type="text"
                  placeholder="+91 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#344054] mb-1">GST Number</label>
                <input
                  type="text"
                  placeholder="27AAAAA0000A1Z5"
                  value={formData.gst}
                  onChange={(e) => setFormData({ ...formData, gst: e.target.value })}
                  className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] uppercase font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#344054] mb-1">Email</label>
              <input
                type="email"
                placeholder="vendor@company.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#344054] mb-1">Address</label>
              <textarea
                rows={2}
                placeholder="Street, City, State, Pincode"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-white border border-[#D0D5DD] rounded-[8px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {!editingVendor && (
                <EnterpriseNumberInput
                  label="Opening Balance (₹)"
                  value={formData.openingBalance}
                  onValueChange={(val) => setFormData({ ...formData, openingBalance: val })}
                  placeholder="0.00"
                />
              )}
              <EnterpriseNumberInput
                label="Credit Limit (₹)"
                value={formData.creditLimit}
                onValueChange={(val) => setFormData({ ...formData, creditLimit: val })}
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#344054] mb-1">Notes</label>
              <input
                type="text"
                placeholder="Additional vendor terms or details"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px]"
              />
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#E5E9F2]">
              <EnterpriseButton
                type="button"
                variant="secondary"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </EnterpriseButton>
              <EnterpriseButton
                type="submit"
                variant="primary"
                loading={submitting}
              >
                {editingVendor ? 'Save Changes' : 'Create Vendor'}
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
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

export default VendorsPage
