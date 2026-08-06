import React from 'react'

export interface TransactionBadgeItem {
  transactionType?: string
  eventType?: string
  eventLabel?: string
}

export const getTransactionEventBadge = (item: TransactionBadgeItem) => {
  const eventType = (item.eventType || 'CREATED').toUpperCase()
  const rawCategory = item.transactionType || 'Transaction'
  
  let label = item.eventLabel

  if (!label) {
    if (eventType === 'UPDATED') {
      if (rawCategory.toLowerCase().includes('salary')) label = 'Salary Updated'
      else if (rawCategory.toLowerCase().includes('expense')) label = 'Expense Updated'
      else if (rawCategory.toLowerCase().includes('deposit')) label = 'Bank Deposit Updated'
      else if (rawCategory.toLowerCase().includes('withdrawal')) label = 'Bank Withdrawal Updated'
      else if (rawCategory.toLowerCase().includes('purchase') || rawCategory.toLowerCase().includes('supplier')) label = 'Purchase Payment Updated'
      else if (rawCategory.toLowerCase().includes('customer') || rawCategory.toLowerCase().includes('sales')) label = 'Customer Receipt Updated'
      else if (rawCategory.toLowerCase().includes('transfer')) label = 'Transfer Updated'
      else if (rawCategory.toLowerCase().includes('cash adjustment')) label = 'Cash Adjustment Updated'
      else label = `${rawCategory} Updated`
    } else if (eventType === 'DELETED' || eventType === 'CANCELLED') {
      if (rawCategory.toLowerCase().includes('salary')) label = 'Salary Deleted'
      else if (rawCategory.toLowerCase().includes('expense')) label = 'Expense Deleted'
      else if (rawCategory.toLowerCase().includes('deposit')) label = 'Bank Deposit Deleted'
      else if (rawCategory.toLowerCase().includes('purchase')) label = 'Purchase Payment Deleted'
      else label = `${rawCategory} Deleted`
    } else if (eventType === 'REVERSED') {
      label = `${rawCategory} Reversed`
    } else if (eventType === 'ADJUSTED') {
      label = `${rawCategory} Adjusted`
    } else {
      if (rawCategory.toLowerCase().includes('salary')) label = 'Salary Paid'
      else if (rawCategory.toLowerCase().includes('expense')) label = 'Expense Added'
      else if (rawCategory.toLowerCase().includes('deposit')) label = 'Bank Deposit'
      else if (rawCategory.toLowerCase().includes('withdrawal')) label = 'Bank Withdrawal'
      else if (rawCategory.toLowerCase().includes('purchase')) label = 'Purchase Payment'
      else if (rawCategory.toLowerCase().includes('customer') || rawCategory.toLowerCase().includes('sales')) label = 'Customer Receipt'
      else if (rawCategory.toLowerCase().includes('transfer')) label = 'Transfer Between Accounts'
      else label = rawCategory
    }
  }

  // Visual Badges Color Logic
  let containerClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200'
  let dotColor = 'bg-emerald-500'

  if (eventType === 'UPDATED') {
    containerClasses = 'bg-amber-50 text-amber-800 border-amber-300 font-bold shadow-2xs'
    dotColor = 'bg-amber-500'
  } else if (eventType === 'DELETED' || eventType === 'CANCELLED') {
    containerClasses = 'bg-rose-50 text-rose-700 border-rose-200 font-bold'
    dotColor = 'bg-rose-500'
  } else if (eventType === 'REVERSED') {
    containerClasses = 'bg-purple-50 text-purple-700 border-purple-200 font-bold'
    dotColor = 'bg-purple-500'
  } else if (eventType === 'ADJUSTED') {
    containerClasses = 'bg-blue-50 text-blue-700 border-blue-200 font-bold'
    dotColor = 'bg-blue-500'
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${containerClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{label}</span>
    </span>
  )
}
