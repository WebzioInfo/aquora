import React from 'react'
import type { Owner } from '../../../../services/simpleAccounts'

/**
 * Format currency with Indian grouping (lakhs/crores).
 * Displays decimals only if paise exist (or when forceDecimals is true).
 */
export const formatINR = (val: number | string | undefined | null, forceDecimals: boolean = false): string => {
  if (val === undefined || val === null || isNaN(Number(val))) return '₹0'
  const num = Number(val)
  const hasPaise = Math.abs(num % 1) > 0.001
  const decimals = (forceDecimals || hasPaise) ? 2 : 0
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

/**
 * Extract clean initials from owner full name
 */
export const getOwnerInitials = (name?: string): string => {
  if (!name || !name.trim()) return 'OW'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export interface OwnerColorMeta {
  hex: string
  bg: string
  text: string
  border: string
  dot: string
  lightBg: string
}

/**
 * Curated 10-color palette for owners (no gray, deterministic by ID or Name hash)
 */
export const OWNER_PALETTE: OwnerColorMeta[] = [
  { hex: '#1A56DB', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', dot: 'bg-blue-600', lightBg: '#EFF6FF' },
  { hex: '#7C3AED', bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', dot: 'bg-purple-600', lightBg: '#F5F3FF' },
  { hex: '#059669', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-600', lightBg: '#ECFDF5' },
  { hex: '#D97706', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300', dot: 'bg-amber-600', lightBg: '#FFFBEB' },
  { hex: '#0891B2', bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300', dot: 'bg-cyan-600', lightBg: '#ECFEFF' },
  { hex: '#4F46E5', bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300', dot: 'bg-indigo-600', lightBg: '#EEF2FF' },
  { hex: '#E11D48', bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300', dot: 'bg-rose-600', lightBg: '#FFF1F2' },
  { hex: '#0D9488', bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-300', dot: 'bg-teal-600', lightBg: '#F0FDFA' },
  { hex: '#DB2777', bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-300', dot: 'bg-pink-600', lightBg: '#FDF2F8' },
  { hex: '#EA580C', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', dot: 'bg-orange-600', lightBg: '#FFF7ED' }
]

/**
 * Returns consistent color metadata for an owner across the entire app
 */
export const getOwnerColor = (idOrName?: string): OwnerColorMeta => {
  if (!idOrName) return OWNER_PALETTE[0]
  let hash = 0
  for (let i = 0; i < idOrName.length; i++) {
    hash = idOrName.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % OWNER_PALETTE.length
  return OWNER_PALETTE[index]
}

/**
 * Calculates additional invested and total withdrawn for a single owner
 */
export const getOwnerTransactionTotals = (owner: Owner) => {
  let additionalInvested = 0
  let totalWithdrawn = 0

  if (owner.transactions && owner.transactions.length > 0) {
    for (const t of owner.transactions) {
      const type = (t.transactionType || '').toLowerCase()
      const amt = Number(t.amount || 0)
      if (type === 'investment') {
        additionalInvested += amt
      } else if (type === 'withdrawal') {
        totalWithdrawn += amt
      }
    }
  }

  return { additionalInvested, totalWithdrawn }
}

/**
 * Calculate full company owner metrics
 */
export const calculateOwnersMetrics = (owners: Owner[]) => {
  let totalCurrentInvestment = 0
  let totalInitialInvestment = 0
  let totalAdditionalInvested = 0
  let totalWithdrawn = 0
  let totalOwnership = 0

  for (const o of owners) {
    totalCurrentInvestment += Number(o.currentInvestment || 0)
    totalInitialInvestment += Number(o.initialInvestment || 0)
    totalOwnership += Number(o.ownershipPercentage || 0)

    const { additionalInvested, totalWithdrawn: withdrawn } = getOwnerTransactionTotals(o)
    totalAdditionalInvested += additionalInvested
    totalWithdrawn += withdrawn
  }

  // Format to 2 decimal places to prevent float drift
  totalOwnership = Math.round(totalOwnership * 100) / 100
  const unallocatedOwnership = Math.max(0, Math.round((100 - totalOwnership) * 100) / 100)
  const overAllocatedOwnership = Math.max(0, Math.round((totalOwnership - 100) * 100) / 100)

  return {
    totalCurrentInvestment,
    totalInitialInvestment,
    totalAdditionalInvested,
    totalWithdrawn,
    totalOwnership,
    unallocatedOwnership,
    overAllocatedOwnership,
    totalOwnersCount: owners.length
  }
}
