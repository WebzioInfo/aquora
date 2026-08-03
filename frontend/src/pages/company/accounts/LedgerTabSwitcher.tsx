import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Landmark, Wallet } from 'lucide-react'

export const LedgerTabSwitcher: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  // Determine active tab reactively from pathname
  const isCash = location.pathname.includes('/cash-books')
  const activeTab = isCash ? 'cash' : 'bank'

  const handleTabChange = (tab: 'bank' | 'cash') => {
    if (tab === 'bank') {
      navigate('/company/accounts/ledger/bank-accounts')
    } else {
      navigate('/company/accounts/ledger/cash-books')
    }
  }

  return (
    <div className="flex p-1 bg-slate-100/80 rounded-xl max-w-sm border border-slate-200/60 shadow-inner">
      <button
        type="button"
        onClick={() => handleTabChange('bank')}
        className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 text-xs font-bold rounded-lg transition-all duration-200 select-none cursor-pointer ${
          activeTab === 'bank'
            ? 'bg-indigo-600 text-white shadow-sm font-black'
            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
        }`}
      >
        <Landmark className="w-3.5 h-3.5" />
        Bank Accounts
      </button>
      <button
        type="button"
        onClick={() => handleTabChange('cash')}
        className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 text-xs font-bold rounded-lg transition-all duration-200 select-none cursor-pointer ${
          activeTab === 'cash'
            ? 'bg-indigo-600 text-white shadow-sm font-black'
            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
        }`}
      >
        <Wallet className="w-3.5 h-3.5" />
        Cash Books
      </button>
    </div>
  )
}

export default LedgerTabSwitcher
