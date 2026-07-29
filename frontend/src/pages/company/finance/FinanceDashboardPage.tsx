import React, { useState, useEffect } from 'react'
import { TrendingUp, DollarSign, Activity, FileText, ArrowUpRight, ArrowDownRight, Wallet } from 'lucide-react'


export const FinanceDashboardPage: React.FC = () => {
  const [stats, setStats] = useState({
    cashInHand: 450000,
    receivables: 125000,
    payables: 65000,
    monthlyRevenue: 850000
  })

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Finance Overview</h1>
          <p className="text-slate-500 mt-1">Enterprise financial metrics and cash flow</p>
        </div>
        <div className="flex gap-3">
          <button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl shadow-sm hover:bg-slate-50 transition-all focus:ring-2 focus:ring-indigo-500/20 active:scale-95">Download Report</button>
          <button className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all focus:ring-4 focus:ring-indigo-500/30 active:scale-95">New Journal Entry</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Cash & Bank</p>
              <h3 className="text-2xl font-bold text-slate-900">₹{stats.cashInHand.toLocaleString()}</h3>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm font-medium text-emerald-600">
            <ArrowUpRight className="w-4 h-4 mr-1" />
            <span>+12.5% from last month</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Receivables</p>
              <h3 className="text-2xl font-bold text-slate-900">₹{stats.receivables.toLocaleString()}</h3>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm font-medium text-slate-500">
            <span>Awaiting from 42 customers</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-all"></div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Payables</p>
              <h3 className="text-2xl font-bold text-slate-900">₹{stats.payables.toLocaleString()}</h3>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm font-medium text-rose-600">
            <ArrowDownRight className="w-4 h-4 mr-1" />
            <span>Due within 15 days</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all"></div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Net Revenue</p>
              <h3 className="text-2xl font-bold text-slate-900">₹{stats.monthlyRevenue.toLocaleString()}</h3>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm font-medium text-indigo-600">
            <ArrowUpRight className="w-4 h-4 mr-1" />
            <span>+24.1% MTD</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 min-h-[400px]">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Cash Flow Analytics</h3>
          <div className="h-full flex items-center justify-center text-slate-400 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
            [Chart Area: Recharts / Chart.js will be rendered here]
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Recent Transactions</h3>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">Payment Received</p>
                    <p className="text-xs text-slate-500">From Customer #{1000 + i}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-600 text-sm">+₹{(i * 1500).toLocaleString()}</p>
                  <p className="text-[10px] font-medium text-slate-400">2h ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
export default FinanceDashboardPage
