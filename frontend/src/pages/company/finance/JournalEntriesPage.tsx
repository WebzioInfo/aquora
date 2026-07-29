import React from 'react'

export const JournalEntriesPage: React.FC = () => {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Journal Entries</h1>
          <p className="text-slate-500 mt-1">General ledger day book and vouchers</p>
        </div>
      </div>
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center min-h-[400px]">
        <p className="text-slate-500 font-medium">Data grid will be rendered here...</p>
      </div>
    </div>
  )
}
export default JournalEntriesPage
