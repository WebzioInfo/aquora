import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { simpleAccountsService } from '../../../services/simpleAccounts'
import { salesService } from '../../../services/sales'
import EnterpriseHeader from '../../../components/ui/EnterpriseHeader'
import EnterpriseCard from '../../../components/ui/EnterpriseCard'
import EnterpriseLoading from '../../../components/ui/EnterpriseLoading'
import EnterpriseBadge from '../../../components/ui/EnterpriseBadge'
import {
  DollarSign, TrendingUp, RotateCcw, AlertTriangle, Wallet,
  Calendar, Package, Boxes, PieChart, Landmark
} from 'lucide-react'

export const AccountsDashboardPage: React.FC = () => {

  const { data: summary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['simpleAccountsDashboardSummary'],
    queryFn: () => simpleAccountsService.getDashboardSummary()
  })

  const { data: expensesData, isLoading: isExpensesLoading } = useQuery({
    queryKey: ['recentExpenses'],
    queryFn: () => simpleAccountsService.getExpenses({ pageNumber: 1, pageSize: 5 })
  })

  const { data: ownersData, isLoading: isOwnersLoading } = useQuery({
    queryKey: ['recentOwnerTransactions'],
    queryFn: () => simpleAccountsService.getOwners()
  })

  const { data: salesReturnsData, isLoading: isReturnsLoading } = useQuery({
    queryKey: ['recentSalesReturns'],
    queryFn: () => salesService.getTransactions(1, 5, '', '', '', 'Customer Return')
  })

  const { data: damagesData, isLoading: isDamagesLoading } = useQuery({
    queryKey: ['recentDamages'],
    queryFn: () => salesService.getTransactions(1, 5, '', '', '', 'Damage')
  })

  const isLoading = isSummaryLoading || isExpensesLoading || isOwnersLoading || isReturnsLoading || isDamagesLoading

  if (isLoading) {
    return <EnterpriseLoading label="Loading Accounts Dashboard..." />
  }

  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0)
  }

  // Extract latest investment transactions from owners
  const latestTransactions = (ownersData || [])
    .flatMap(o => (o.transactions || []).map(t => ({ ...t, ownerName: o.name })))
    .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <EnterpriseHeader
        title="Accounts Dashboard"
        description="Real-time financial summary, inventory values, and recent transaction insights"
      />

      {/* KPI CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <EnterpriseCard className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today's Sales</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-extrabold text-slate-900">
            {formatCurrency(summary?.todaysSales)}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Outstanding Sales</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-extrabold text-slate-900">
            {formatCurrency(summary?.outstandingSales)}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-4 border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today's Returns</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <RotateCcw className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-extrabold text-slate-900">
            {formatCurrency(summary?.todaysReturn)}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-4 border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today's Damage</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-extrabold text-slate-900">
            {formatCurrency(summary?.todaysDamage)}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-4 border-l-4 border-l-red-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today's Expense</span>
            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-extrabold text-slate-900">
            {formatCurrency(summary?.todaysExpense)}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-4 border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">This Month Expense</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-extrabold text-slate-900">
            {formatCurrency(summary?.thisMonthExpense)}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-4 border-l-4 border-l-indigo-600">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Bank Balance</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Landmark className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-extrabold text-indigo-600">
            {formatCurrency(summary?.totalBankBalance)}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-4 border-l-4 border-l-emerald-600">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cash Balance</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-extrabold text-emerald-600">
            {formatCurrency(summary?.cashBalance)}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-4 border-l-4 border-l-rose-600">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Expenses</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-extrabold text-rose-600">
            {formatCurrency(summary?.totalExpenses)}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-4 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Finished Goods Value</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-extrabold text-slate-900">
            {formatCurrency(summary?.finishedGoodsValue)}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-4 border-l-4 border-l-cyan-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Raw Material Value</span>
            <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-extrabold text-slate-900">
            {formatCurrency(summary?.rawMaterialValue)}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-4 border-l-4 border-l-teal-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Inventory Value</span>
            <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
              <PieChart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-extrabold text-slate-900">
            {formatCurrency(summary?.totalInventoryValue)}
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-4 border-l-4 border-l-sky-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Company Investment</span>
            <div className="p-2 bg-sky-50 text-sky-600 rounded-lg">
              <Landmark className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-extrabold text-slate-900">
            {formatCurrency(summary?.companyInvestment)}
          </div>
        </EnterpriseCard>
      </div>

      {/* TABLES / RECENT ACTIVITY GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RECENT EXPENSES TABLE */}
        <EnterpriseCard className="p-5">
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-slate-500" /> Recent Expenses
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="p-2.5">Number</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5">Amount</th>
                  <th className="p-2.5">Method</th>
                  <th className="p-2.5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expensesData?.items && expensesData.items.length > 0 ? (
                  expensesData.items.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{exp.expenseNumber}</td>
                      <td className="p-2.5"><EnterpriseBadge variant="gray">{exp.category}</EnterpriseBadge></td>
                      <td className="p-2.5 font-bold text-rose-600">{formatCurrency(exp.amount)}</td>
                      <td className="p-2.5 text-slate-600">{exp.paymentMethod}</td>
                      <td className="p-2.5 text-slate-500">{new Date(exp.expenseDate).toLocaleDateString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-400 font-medium">No recent expenses found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </EnterpriseCard>

        {/* LATEST INVESTMENT TRANSACTIONS */}
        <EnterpriseCard className="p-5">
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Landmark className="w-4 h-4 text-slate-500" /> Latest Investment Transactions
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="p-2.5">Owner</th>
                  <th className="p-2.5">Type</th>
                  <th className="p-2.5">Amount</th>
                  <th className="p-2.5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {latestTransactions.length > 0 ? (
                  latestTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{tx.ownerName}</td>
                      <td className="p-2.5">
                        <EnterpriseBadge variant={tx.transactionType === 'Investment' ? 'success' : 'warning'}>
                          {tx.transactionType}
                        </EnterpriseBadge>
                      </td>
                      <td className={`p-2.5 font-bold ${tx.transactionType === 'Investment' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="p-2.5 text-slate-500">{new Date(tx.transactionDate).toLocaleDateString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-400 font-medium">No recent investment transactions found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </EnterpriseCard>

        {/* LATEST SALES RETURNS */}
        <EnterpriseCard className="p-5">
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-slate-500" /> Latest Sales Returns
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="p-2.5">Txn #</th>
                  <th className="p-2.5">Customer</th>
                  <th className="p-2.5">Cases</th>
                  <th className="p-2.5">Type</th>
                  <th className="p-2.5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesReturnsData?.data?.items && salesReturnsData.data.items.length > 0 ? (
                  salesReturnsData.data.items.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{item.transactionNumber}</td>
                      <td className="p-2.5 text-slate-700 font-semibold">{item.customerName}</td>
                      <td className="p-2.5 font-bold text-indigo-600">{item.cases}</td>
                      <td className="p-2.5">
                        <EnterpriseBadge variant={item.isReplacementRequired ? 'info' : 'warning'}>
                          {item.isReplacementRequired ? 'Replacement' : 'Account Adj'}
                        </EnterpriseBadge>
                      </td>
                      <td className="p-2.5 text-slate-500">{new Date(item.transactionDate).toLocaleDateString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-400 font-medium">No sales returns recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </EnterpriseCard>

        {/* LATEST DAMAGES */}
        <EnterpriseCard className="p-5">
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-slate-500" /> Latest Damage Records
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="p-2.5">Txn #</th>
                  <th className="p-2.5">Product</th>
                  <th className="p-2.5">Cases</th>
                  <th className="p-2.5">Reason</th>
                  <th className="p-2.5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {damagesData?.data?.items && damagesData.data.items.length > 0 ? (
                  damagesData.data.items.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{item.transactionNumber}</td>
                      <td className="p-2.5 text-slate-700 font-semibold">{item.productName}</td>
                      <td className="p-2.5 font-bold text-rose-600">{item.cases}</td>
                      <td className="p-2.5 text-slate-600 truncate max-w-[120px]">{item.damageReason || item.remarks || 'Damage'}</td>
                      <td className="p-2.5 text-slate-500">{new Date(item.transactionDate).toLocaleDateString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-400 font-medium">No damage records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </EnterpriseCard>
      </div>
    </div>
  )
}

export default AccountsDashboardPage
