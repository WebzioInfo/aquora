import React from 'react'

export const toPaise = (val: number): number => Math.round((Number(val) || 0) * 100)
export const fromPaise = (val: number): number => (Number(val) || 0) / 100

export const formatINR = (val: number): string => {
  const safe = Number(val) || 0
  return '₹' + safe.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

export const formatINRShort = (val: number): string => {
  const safe = Number(val) || 0
  return '₹' + Math.round(safe).toLocaleString('en-IN')
}

export type PurchasePaymentStatus = 'Paid' | 'Partial' | 'PartiallyPaid' | 'Unpaid' | 'Cancelled'

export const normalizePaymentStatus = (status?: string, isCancelled?: boolean): 'Paid' | 'Partial' | 'Unpaid' | 'Cancelled' => {
  if (isCancelled || status?.toLowerCase() === 'cancelled') return 'Cancelled'
  const s = status?.toLowerCase()
  if (s === 'paid') return 'Paid'
  if (s === 'partial' || s === 'partiallypaid') return 'Partial'
  return 'Unpaid'
}

export interface StatusStyle {
  label: string
  bg: string
  text: string
  border: string
  dot: string
}

export const getStatusStyle = (status?: string, isCancelled?: boolean): StatusStyle => {
  const normalized = normalizePaymentStatus(status, isCancelled)
  switch (normalized) {
    case 'Paid':
      return {
        label: 'Paid',
        bg: '#DCFCE7',
        text: '#166534',
        border: 'rgba(34, 197, 94, 0.3)',
        dot: '#22C55E'
      }
    case 'Partial':
      return {
        label: 'Partial',
        bg: '#FEF3C7',
        text: '#92400E',
        border: 'rgba(245, 158, 11, 0.3)',
        dot: '#F59E0B'
      }
    case 'Cancelled':
      return {
        label: 'Cancelled',
        bg: '#F1F5F9',
        text: '#475569',
        border: 'rgba(100, 116, 139, 0.3)',
        dot: '#64748B'
      }
    case 'Unpaid':
    default:
      return {
        label: 'Unpaid',
        bg: '#FFE4E6',
        text: '#9F1239',
        border: 'rgba(244, 63, 94, 0.3)',
        dot: '#E11D48'
      }
  }
}
