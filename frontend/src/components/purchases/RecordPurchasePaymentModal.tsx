import React, { useState, useEffect } from 'react'
import EnterpriseModal from '../ui/EnterpriseModal'
import EnterpriseButton from '../ui/EnterpriseButton'
import EnterpriseNumberInput from '../ui/EnterpriseNumberInput'
import { purchaseService, type Purchase, type AddPurchasePaymentRequest } from '../../services/purchases'
import { simpleAccountsService } from '../../services/simpleAccounts'
import { useNotificationStore } from '../../store/useNotificationStore'

interface BankAccountOption {
  id: string
  accountName: string
  bankName: string
}

interface CashBookOption {
  id: string
  name: string
}

export interface RecordPurchasePaymentModalProps {
  isOpen: boolean
  onClose: () => void
  purchase: Purchase
  onSuccess: (updatedPurchase: Purchase) => void
}

export const RecordPurchasePaymentModal: React.FC<RecordPurchasePaymentModalProps> = ({
  isOpen,
  onClose,
  purchase,
  onSuccess
}) => {
  const { showToast } = useNotificationStore()
  const [submitting, setSubmitting] = useState(false)

  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState<'BankAccount' | 'Cash' | 'UPI' | 'Cheque'>('BankAccount')
  const [amount, setAmount] = useState<number>(purchase.balanceAmount || 0)
  const [bankAccountId, setBankAccountId] = useState<string>('')
  const [cashBookId, setCashBookId] = useState<string>('')
  const [referenceNo, setReferenceNo] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([])
  const [cashBooks, setCashBooks] = useState<CashBookOption[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setAmount(purchase.balanceAmount > 0 ? purchase.balanceAmount : 0)
      setPaymentDate(new Date().toISOString().slice(0, 10))
      setPaymentMethod('BankAccount')
      setBankAccountId('')
      setCashBookId('')
      setReferenceNo('')
      setNotes('')
      fetchDropdowns()
    }
  }, [isOpen, purchase])

  const fetchDropdowns = async () => {
    setLoadingAccounts(true)
    try {
      const [banksRes, cashRes] = await Promise.all([
        simpleAccountsService.getBankAccountDropdown().catch(() => []),
        simpleAccountsService.getCashBookDropdown().catch(() => [])
      ])
      const banks = Array.isArray(banksRes) ? banksRes : []
      const cash = Array.isArray(cashRes) ? cashRes : []
      setBankAccounts(banks)
      setCashBooks(cash)

      if (banks.length > 0) setBankAccountId(banks[0].id)
      if (cash.length > 0) setCashBookId(cash[0].id)
    } finally {
      setLoadingAccounts(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const amt = typeof amount === 'number' ? amount : parseFloat(amount) || 0
    if (amt <= 0) {
      showToast('Payment amount must be greater than zero.', 'error')
      return
    }

    if (amt > purchase.balanceAmount + 0.01) {
      showToast(`Payment amount cannot exceed balance amount (₹${purchase.balanceAmount.toFixed(2)}).`, 'error')
      return
    }

    // Sanitize GUID fields: NEVER send empty strings for Nullable<Guid>
    const cleanBankAccountId = (['BankAccount', 'UPI', 'Cheque'].includes(paymentMethod) && bankAccountId.trim())
      ? bankAccountId.trim()
      : undefined

    const cleanCashBookId = (paymentMethod === 'Cash' && cashBookId.trim())
      ? cashBookId.trim()
      : undefined

    const payload: AddPurchasePaymentRequest = {
      paymentDate: paymentDate || new Date().toISOString().slice(0, 10),
      paymentMethod,
      amount: amt,
      bankAccountId: cleanBankAccountId,
      cashBookId: cleanCashBookId,
      referenceNo: referenceNo.trim() || undefined,
      notes: notes.trim() || undefined
    }

    setSubmitting(true)
    try {
      const updatedPurchase = await purchaseService.addPayment(purchase.id, payload)
      showToast(`Payment of ₹${amt.toLocaleString('en-IN')} recorded successfully`, 'success')
      onSuccess(updatedPurchase)
      onClose()
    } catch (err: any) {
      showToast(err?.message || 'Failed to record payment', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <EnterpriseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Record Payment — Purchase #${purchase.purchaseNo}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Vendor & Balance Info */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
          <div>
            <span className="text-slate-500 font-medium block">Vendor</span>
            <span className="font-bold text-slate-900">{purchase.vendorName || 'General Vendor'}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 font-medium block">Outstanding Balance</span>
            <span className="font-mono font-bold text-red-600">₹{purchase.balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Payment Amount */}
        <div>
          <EnterpriseNumberInput
            label="Payment Amount (₹)"
            value={amount}
            onValueChange={(val) => setAmount(Number(val) || 0)}
            placeholder="0.00"
          />
          <span className="text-[11px] text-slate-400 block mt-1">
            Max balance payable: ₹{purchase.balanceAmount.toFixed(2)}
          </span>
        </div>

        {/* Payment Date & Method */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#344054] mb-1">Payment Date</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] font-medium text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#344054] mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
              className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] font-semibold text-slate-900"
            >
              <option value="BankAccount">Bank Transfer</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>
        </div>

        {/* Account Selection */}
        {['BankAccount', 'UPI', 'Cheque'].includes(paymentMethod) && (
          <div>
            <label className="block text-xs font-semibold text-[#344054] mb-1">Bank Account</label>
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px]"
              disabled={loadingAccounts}
            >
              <option value="">-- Choose Bank Account --</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>{b.bankName} - {b.accountName}</option>
              ))}
            </select>
          </div>
        )}

        {paymentMethod === 'Cash' && (
          <div>
            <label className="block text-xs font-semibold text-[#344054] mb-1">Cash Book</label>
            <select
              value={cashBookId}
              onChange={(e) => setCashBookId(e.target.value)}
              className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px]"
              disabled={loadingAccounts}
            >
              <option value="">-- Choose Cash Book --</option>
              {cashBooks.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Reference No */}
        <div>
          <label className="block text-xs font-semibold text-[#344054] mb-1">Reference Number / UTR / Cheque No</label>
          <input
            type="text"
            placeholder="e.g. UTR-99812739"
            value={referenceNo}
            onChange={(e) => setReferenceNo(e.target.value)}
            className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px] font-mono"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-[#344054] mb-1">Notes / Remarks</label>
          <input
            type="text"
            placeholder="Optional remarks"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full h-[40px] px-3 text-xs bg-white border border-[#D0D5DD] rounded-[8px]"
          />
        </div>

        {/* Buttons */}
        <div className="pt-3 flex justify-end gap-2 border-t border-[#E5E9F2]">
          <EnterpriseButton
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </EnterpriseButton>
          <EnterpriseButton
            type="submit"
            variant="primary"
            loading={submitting}
          >
            Confirm Payment
          </EnterpriseButton>
        </div>
      </form>
    </EnterpriseModal>
  )
}
