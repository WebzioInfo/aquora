import React from 'react'
import {
  Armchair,
  Laptop,
  Wrench,
  Truck,
  Printer,
  Building,
  Package,
  Cpu,
  Boxes
} from 'lucide-react'
import type { DetailedAsset } from '../../../../services/assets'

/**
 * Format currency with Indian grouping (lakhs/crores).
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
 * Format UTC string or Date to "4 Aug 2026"
 */
export const formatDisplayDate = (dateStr?: string | null): string => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

export interface AssetCategoryMeta {
  icon: React.ElementType
  hex: string
  bg: string
  text: string
  border: string
  lightBg: string
}

/**
 * Category-appropriate icon and visual color map
 */
export const getCategoryMeta = (category?: string): AssetCategoryMeta => {
  const cat = (category || '').toLowerCase().trim()

  if (cat.includes('furniture') || cat.includes('fixture')) {
    return {
      icon: Armchair,
      hex: '#D97706',
      bg: 'bg-amber-100',
      text: 'text-amber-800',
      border: 'border-amber-200',
      lightBg: '#FEF3C7'
    }
  }

  if (cat.includes('computer') || cat.includes('laptop') || cat.includes('it equipment') || cat.includes('electronics')) {
    return {
      icon: Laptop,
      hex: '#1A56DB',
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-200',
      lightBg: '#EFF6FF'
    }
  }

  if (cat.includes('machinery') || cat.includes('machine') || cat.includes('plant')) {
    return {
      icon: Wrench,
      hex: '#7C3AED',
      bg: 'bg-purple-100',
      text: 'text-purple-800',
      border: 'border-purple-200',
      lightBg: '#F5F3FF'
    }
  }

  if (cat.includes('vehicle') || cat.includes('truck') || cat.includes('car') || cat.includes('transport')) {
    return {
      icon: Truck,
      hex: '#0891B2',
      bg: 'bg-cyan-100',
      text: 'text-cyan-800',
      border: 'border-cyan-200',
      lightBg: '#ECFEFF'
    }
  }

  if (cat.includes('printer') || cat.includes('scanner')) {
    return {
      icon: Printer,
      hex: '#0D9488',
      bg: 'bg-teal-100',
      text: 'text-teal-800',
      border: 'border-teal-200',
      lightBg: '#F0FDFA'
    }
  }

  if (cat.includes('building') || cat.includes('infrastructure') || cat.includes('property') || cat.includes('real estate')) {
    return {
      icon: Building,
      hex: '#4F46E5',
      bg: 'bg-indigo-100',
      text: 'text-indigo-800',
      border: 'border-indigo-200',
      lightBg: '#EEF2FF'
    }
  }

  if (cat.includes('raw') || cat.includes('material')) {
    return {
      icon: Boxes,
      hex: '#E11D48',
      bg: 'bg-rose-100',
      text: 'text-rose-800',
      border: 'border-rose-200',
      lightBg: '#FFF1F2'
    }
  }

  // Fallback
  return {
    icon: Package,
    hex: '#64748B',
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-200',
    lightBg: '#F8FAFC'
  }
}

/**
 * Status pill visual configuration
 */
export const getStatusMeta = (status?: string) => {
  const s = (status || '').toLowerCase().trim()
  if (s === 'active' || s === 'inuse' || s === 'in use') {
    return {
      label: 'Active',
      dotBg: 'bg-emerald-500',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }
  }
  if (s === 'undermaintenance' || s === 'under maintenance' || s === 'maintenance') {
    return {
      label: 'Under maintenance',
      dotBg: 'bg-amber-500',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200'
    }
  }
  if (s === 'disposed' || s === 'retired') {
    return {
      label: 'Disposed',
      dotBg: 'bg-slate-400',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200'
    }
  }
  if (s === 'available') {
    return {
      label: 'Available',
      dotBg: 'bg-blue-500',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200'
    }
  }
  if (s === 'damaged') {
    return {
      label: 'Damaged',
      dotBg: 'bg-rose-500',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200'
    }
  }
  return {
    label: status || 'Unknown',
    dotBg: 'bg-slate-400',
    badgeClass: 'bg-slate-50 text-slate-700 border-slate-200'
  }
}
