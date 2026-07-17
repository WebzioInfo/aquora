import React from 'react'

interface Column<T> {
  key: string
  title: string
  render?: (row: T) => React.ReactNode
  className?: string
}

interface EnterpriseTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
}

export function EnterpriseTable<T extends { id: string | number }>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No records found.'
}: EnterpriseTableProps<T>) {
  return (
    <div className="w-full overflow-hidden border border-[#E5E7EB] rounded-[12px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="h-[48px] border-b border-[#E5E7EB] text-[#374151] font-semibold select-none bg-[#F8FAFC]">
              {columns.map((col) => (
                <th key={col.key} className={`py-3 px-4 text-sm ${col.className || ''}`}>
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center">
                  <div className="flex items-center justify-center gap-2 text-slate-400 select-none">
                    <svg className="animate-spin h-5 w-5 text-[#1A56DB]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Loading data grid...</span>
                  </div>
                </td>
              </tr>
            ) : data.length > 0 ? (
              data.map((row) => (
                <tr key={row.id} className="h-[48px] bg-white hover:bg-[#F9FAFB] text-[#111827] transition-colors">
                  {columns.map((col) => (
                    <td key={col.key} className={`py-3 px-4 ${col.className || ''}`}>
                      {col.render ? col.render(row) : (row as any)[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-slate-400 italic select-none">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default EnterpriseTable
