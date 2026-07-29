import React, { useState, useEffect } from 'react'
import { Folder, FileText, ChevronRight, ChevronDown, Plus } from 'lucide-react'

export const ChartOfAccountsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<any[]>([])
  
  useEffect(() => {
    // Mock fetch for now, you will replace with API call
    setAccounts([
      { id: 1, code: '1000', name: 'Assets', type: 'Asset', isGroup: true, children: [
        { id: 11, code: '1100', name: 'Cash & Equivalents', type: 'Asset', isGroup: true, children: [
          { id: 111, code: '1101', name: 'Petty Cash', type: 'Asset', balance: 5000 },
          { id: 112, code: '1102', name: 'HDFC Bank', type: 'Asset', balance: 445000 }
        ]}
      ]},
      { id: 2, code: '2000', name: 'Liabilities', type: 'Liability', isGroup: true, children: [] },
      { id: 3, code: '3000', name: 'Equity', type: 'Equity', isGroup: true, children: [] },
      { id: 4, code: '4000', name: 'Revenue', type: 'Revenue', isGroup: true, children: [] },
      { id: 5, code: '5000', name: 'Expenses', type: 'Expense', isGroup: true, children: [] },
    ])
  }, [])

  const AccountNode = ({ node, level = 0 }: any) => {
    const [expanded, setExpanded] = useState(level < 2)
    return (
      <div className="select-none">
        <div 
          className={`flex items-center justify-between py-2.5 px-4 hover:bg-slate-50 transition-colors border-b border-slate-100 ${level === 0 ? 'bg-slate-50/50 font-bold' : ''}`}
          style={{ paddingLeft: `${level * 24 + 16}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-3">
            {node.isGroup ? (
              <button className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors">
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <div className="w-5"></div>
            )}
            
            <div className={`flex items-center gap-2 ${node.isGroup ? 'text-indigo-900' : 'text-slate-700'}`}>
              {node.isGroup ? <Folder className="w-4 h-4 text-indigo-400" /> : <FileText className="w-4 h-4 text-slate-400" />}
              <span className="font-mono text-xs text-slate-500 mr-2">{node.code}</span>
              <span className={node.isGroup ? 'font-semibold' : 'font-medium'}>{node.name}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${
              node.type === 'Asset' ? 'bg-blue-100 text-blue-700' :
              node.type === 'Liability' ? 'bg-rose-100 text-rose-700' :
              node.type === 'Equity' ? 'bg-purple-100 text-purple-700' :
              node.type === 'Revenue' ? 'bg-emerald-100 text-emerald-700' :
              'bg-orange-100 text-orange-700'
            }`}>{node.type}</span>
            
            <div className="w-32 text-right">
              {!node.isGroup && (
                <span className="font-semibold text-slate-900">₹{node.balance?.toLocaleString()}</span>
              )}
            </div>
          </div>
        </div>
        
        {expanded && node.children && (
          <div className="animate-in slide-in-from-top-2 duration-200">
            {node.children.map((child: any) => (
              <AccountNode key={child.id} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Chart of Accounts</h1>
          <p className="text-slate-500 mt-1">Hierarchical view of all enterprise financial ledgers</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all focus:ring-4 focus:ring-indigo-500/30 active:scale-95">
          <Plus className="w-5 h-5" /> Add Account
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between py-3 px-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-500 uppercase tracking-wider">
          <div className="ml-12">Account Code & Name</div>
          <div className="flex gap-6 pr-4">
            <div className="w-20 text-center">Type</div>
            <div className="w-28 text-right">Balance</div>
          </div>
        </div>
        
        <div className="divide-y divide-slate-100">
          {accounts.map(acc => (
            <AccountNode key={acc.id} node={acc} />
          ))}
        </div>
      </div>
    </div>
  )
}
export default ChartOfAccountsPage
