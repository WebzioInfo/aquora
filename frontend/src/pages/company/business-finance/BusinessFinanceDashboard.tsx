import React, { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Activity, AlertCircle, CheckCircle2, ChevronRight, BarChart3, Package, Users, Factory, Target, Zap } from 'lucide-react'
import * as api from './financeApi'

const MetricCard = ({ title, value, prefix = '₹', trend, subtext, icon: Icon, colorClass }: any) => (
  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-shadow group">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl ${colorClass} bg-opacity-10 text-${colorClass.split('-')[1]}-600 group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6" />
      </div>
      {trend && (
        <div className={`flex items-center text-sm font-semibold ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {trend > 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <h3 className="text-slate-500 font-medium text-sm mb-1">{title}</h3>
    <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">{prefix}{value?.toLocaleString('en-IN') || '0'}</h2>
    {subtext && <p className="text-xs text-slate-400 mt-2 font-medium">{subtext}</p>}
  </div>
)

const InsightCard = ({ insight, type }: any) => {
  const isWarning = type === 'Warning'
  const isSuccess = type === 'Success'
  return (
    <div className={`p-4 rounded-xl border flex items-start gap-3 ${
      isWarning ? 'bg-amber-50 border-amber-100 text-amber-900' : 
      isSuccess ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 
      'bg-blue-50 border-blue-100 text-blue-900'
    }`}>
      {isWarning ? <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" /> : 
       isSuccess ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" /> : 
       <Activity className="w-5 h-5 shrink-0 text-blue-600 mt-0.5" />}
      <p className="text-sm font-medium leading-relaxed">{insight}</p>
    </div>
  )
}

export const BusinessFinanceDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>({
    kpis: null,
    insights: [],
    expenses: [],
    production: null,
    loss: []
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [kpis, insights, expenses, production, loss] = await Promise.all([
          api.getDashboardKpis(),
          api.getInsights(),
          api.getExpenseAnalytics(),
          api.getProductionCost(),
          api.getMaterialLoss()
        ])
        setData({ kpis, insights, expenses, production, loss })
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  )

  const { kpis, insights, expenses, production, loss } = data

  return (
    <div className="p-8 max-w-[1600px] mx-auto bg-slate-50/50 min-h-screen">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">Business Intelligence</h1>
        <p className="text-slate-500 font-medium text-lg">Real-time financial and operational insights across your enterprise.</p>
      </div>

      {/* Top Level KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <MetricCard title="Today's Revenue" value={kpis?.todayRevenue} icon={Target} colorClass="bg-blue-500" trend={12.5} subtext="vs Yesterday" />
        <MetricCard title="Today's Profit" value={kpis?.todayProfit} icon={DollarSign} colorClass="bg-emerald-500" trend={8.2} subtext="32% Margin" />
        <MetricCard title="Cash & Bank Balance" value={(kpis?.cashInHand || 0) + (kpis?.bankBalance || 0)} icon={Zap} colorClass="bg-indigo-500" subtext="Liquid Assets available" />
        <MetricCard title="Pending Collections" value={kpis?.pendingReceivables} icon={Users} colorClass="bg-rose-500" trend={-4.1} subtext="Awaiting from customers" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: AI Insights & Operations */}
        <div className="lg:col-span-1 space-y-8">
          
          <div className="bg-white rounded-3xl p-7 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Activity className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">AI Insights</h2>
            </div>
            <div className="space-y-4">
              {insights?.map((ins: any, i: number) => (
                <InsightCard key={i} insight={ins.insight} type={ins.type} />
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-7 shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Production Cost Rollup</h2>
            <div className="space-y-5">
              <div className="flex justify-between items-end border-b border-slate-100 pb-4">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Total Manufacturing Cost</p>
                  <p className="text-3xl font-extrabold text-slate-900">₹{production?.totalCost?.toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">Cost Per Bottle</p>
                  <p className="text-xl font-bold text-slate-700">₹{production?.costPerBottle?.toFixed(2)}</p>
                </div>
              </div>
              
              <div className="pt-2">
                {[{label: 'Raw Materials', val: production?.materialCost, color: 'bg-blue-500'},
                  {label: 'Labour', val: production?.labourCost, color: 'bg-emerald-500'},
                  {label: 'Electricity', val: production?.electricityCost, color: 'bg-amber-500'},
                  {label: 'Machine Overheads', val: production?.machineCost, color: 'bg-rose-500'}
                ].map((item, i) => (
                  <div key={i} className="mb-4 last:mb-0">
                    <div className="flex justify-between text-sm mb-1.5 font-medium">
                      <span className="text-slate-600">{item.label}</span>
                      <span className="text-slate-900">₹{item.val?.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className={`${item.color} h-2 rounded-full`} style={{ width: `${(item.val / production?.totalCost) * 100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Deep Analytics */}
        <div className="lg:col-span-2 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-3xl p-7 shadow-sm border border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Expense Radar</h2>
              <div className="space-y-4">
                {expenses?.slice(0, 5).map((exp: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                        i === 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{exp.category}</p>
                        <p className={`text-xs font-bold mt-0.5 flex items-center gap-1 ${exp.trend === 'Up' ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {exp.trend === 'Up' ? '↑' : '↓'} {exp.percentageChange}% vs last month
                        </p>
                      </div>
                    </div>
                    <div className="text-right font-extrabold text-slate-900">
                      ₹{exp.amount?.toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-3xl p-7 shadow-sm border border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Material Loss Vector</h2>
              <div className="space-y-4">
                {loss?.map((l: any, i: number) => (
                  <div key={i} className="group flex flex-col p-4 rounded-2xl bg-slate-50/50 hover:bg-rose-50/50 border border-transparent hover:border-rose-100 transition-colors">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-slate-900">{l.materialName}</span>
                      <span className="font-extrabold text-rose-600">₹{l.totalLossValue?.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                      <span>{l.lossPercentage}% wastage rate</span>
                      <span className="text-rose-500 flex items-center">{l.trend === 'Up' ? 'Trending Worse ↑' : 'Improving ↓'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-7 shadow-sm border border-slate-100 min-h-[300px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">Profitability Matrix</h2>
              <button className="text-indigo-600 font-semibold text-sm hover:text-indigo-700 flex items-center">
                View Full Report <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 text-slate-400 font-medium">
              [Visual Chart Area: Recharts / Chart.js Canvas]
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
export default BusinessFinanceDashboard
