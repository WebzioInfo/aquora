import React from 'react'
import {
  Fuel,
  Car,
  Briefcase,
  Building2,
  Tag,
  Zap,
  Wrench,
  ShoppingBag,
  Megaphone
} from 'lucide-react'

export interface CategoryMeta {
  label: string
  dot: string
  bg: string
  text: string
  darkBg: string
  darkText: string
  icon: React.ElementType
}

export interface PaletteEntry {
  dot: string
  bg: string
  text: string
  darkBg: string
  darkText: string
  icon: React.ElementType
}

// 1. Exactly the requested palette specifications
export const KNOWN_PALETTE: Record<string, PaletteEntry> = {
  fuel: {
    dot: '#F97316',
    bg: '#FFEDD5',
    text: '#9A3412',
    darkBg: 'rgba(249, 115, 22, 0.2)',
    darkText: '#FDBA74',
    icon: Fuel
  },
  vehicle: {
    dot: '#06B6D4',
    bg: '#CFFAFE',
    text: '#155E75',
    darkBg: 'rgba(6, 182, 212, 0.2)',
    darkText: '#67E8F9',
    icon: Car
  },
  office: {
    dot: '#8B5CF6',
    bg: '#EDE9FE',
    text: '#5B21B6',
    darkBg: 'rgba(139, 92, 246, 0.2)',
    darkText: '#C4B5FD',
    icon: Building2
  },
  stationary: {
    dot: '#8B5CF6',
    bg: '#EDE9FE',
    text: '#5B21B6',
    darkBg: 'rgba(139, 92, 246, 0.2)',
    darkText: '#C4B5FD',
    icon: Building2
  },
  'salary and payroll': {
    dot: '#22C55E',
    bg: '#DCFCE7',
    text: '#166534',
    darkBg: 'rgba(34, 197, 94, 0.2)',
    darkText: '#86EFAC',
    icon: Briefcase
  },
  salary: {
    dot: '#22C55E',
    bg: '#DCFCE7',
    text: '#166534',
    darkBg: 'rgba(34, 197, 94, 0.2)',
    darkText: '#86EFAC',
    icon: Briefcase
  },
  payroll: {
    dot: '#22C55E',
    bg: '#DCFCE7',
    text: '#166534',
    darkBg: 'rgba(34, 197, 94, 0.2)',
    darkText: '#86EFAC',
    icon: Briefcase
  },
  rent: {
    dot: '#F43F5E',
    bg: '#FFE4E6',
    text: '#9F1239',
    darkBg: 'rgba(244, 63, 94, 0.2)',
    darkText: '#FDA4AF',
    icon: Building2
  },
  'raw materials': {
    dot: '#EAB308',
    bg: '#FEF9C3',
    text: '#854D0E',
    darkBg: 'rgba(234, 179, 8, 0.2)',
    darkText: '#FDE047',
    icon: ShoppingBag
  },
  'raw material': {
    dot: '#EAB308',
    bg: '#FEF9C3',
    text: '#854D0E',
    darkBg: 'rgba(234, 179, 8, 0.2)',
    darkText: '#FDE047',
    icon: ShoppingBag
  },
  'purchase related': {
    dot: '#EAB308',
    bg: '#FEF9C3',
    text: '#854D0E',
    darkBg: 'rgba(234, 179, 8, 0.2)',
    darkText: '#FDE047',
    icon: ShoppingBag
  },
  utilities: {
    dot: '#14B8A6',
    bg: '#CCFBF1',
    text: '#115E59',
    darkBg: 'rgba(20, 184, 166, 0.2)',
    darkText: '#5EEAD4',
    icon: Zap
  },
  electricity: {
    dot: '#14B8A6',
    bg: '#CCFBF1',
    text: '#115E59',
    darkBg: 'rgba(20, 184, 166, 0.2)',
    darkText: '#5EEAD4',
    icon: Zap
  },
  water: {
    dot: '#14B8A6',
    bg: '#CCFBF1',
    text: '#115E59',
    darkBg: 'rgba(20, 184, 166, 0.2)',
    darkText: '#5EEAD4',
    icon: Zap
  },
  maintenance: {
    dot: '#6366F1',
    bg: '#E0E7FF',
    text: '#3730A3',
    darkBg: 'rgba(99, 102, 241, 0.2)',
    darkText: '#A5B4FC',
    icon: Wrench
  },
  marketing: {
    dot: '#EC4899',
    bg: '#FCE7F3',
    text: '#9D174D',
    darkBg: 'rgba(236, 72, 153, 0.2)',
    darkText: '#F9A8D4',
    icon: Megaphone
  }
}

// Miscellaneous palette
export const MISC_PALETTE: PaletteEntry = {
  dot: '#64748B',
  bg: '#F1F5F9',
  text: '#334155',
  darkBg: 'rgba(100, 116, 139, 0.2)',
  darkText: '#CBD5E1',
  icon: Tag
}

// 2. Dynamic palette entries (excluding Miscellaneous) for deterministic assignment
export const DYNAMIC_PALETTE: Omit<PaletteEntry, 'icon'>[] = [
  { dot: '#F97316', bg: '#FFEDD5', text: '#9A3412', darkBg: 'rgba(249, 115, 22, 0.2)', darkText: '#FDBA74' }, // Fuel
  { dot: '#06B6D4', bg: '#CFFAFE', text: '#155E75', darkBg: 'rgba(6, 182, 212, 0.2)', darkText: '#67E8F9' },  // Vehicle
  { dot: '#8B5CF6', bg: '#EDE9FE', text: '#5B21B6', darkBg: 'rgba(139, 92, 246, 0.2)', darkText: '#C4B5FD' }, // Office
  { dot: '#22C55E', bg: '#DCFCE7', text: '#166534', darkBg: 'rgba(34, 197, 94, 0.2)', darkText: '#86EFAC' },  // Salary and Payroll
  { dot: '#F43F5E', bg: '#FFE4E6', text: '#9F1239', darkBg: 'rgba(244, 63, 94, 0.2)', darkText: '#FDA4AF' },  // Rent
  { dot: '#EAB308', bg: '#FEF9C3', text: '#854D0E', darkBg: 'rgba(234, 179, 8, 0.2)', darkText: '#FDE047' },  // Raw materials
  { dot: '#14B8A6', bg: '#CCFBF1', text: '#115E59', darkBg: 'rgba(20, 184, 166, 0.2)', darkText: '#5EEAD4' },  // Utilities
  { dot: '#6366F1', bg: '#E0E7FF', text: '#3730A3', darkBg: 'rgba(99, 102, 241, 0.2)', darkText: '#A5B4FC' },  // Maintenance
  { dot: '#EC4899', bg: '#FCE7F3', text: '#9D174D', darkBg: 'rgba(236, 72, 153, 0.2)', darkText: '#F9A8D4' },  // Marketing
]

function hashCategoryString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

// Registry to ensure the same category name always gets the same color across sessions & components
const assignedCategoryMap = new Map<string, CategoryMeta>()
const usedDotColors = new Set<string>()

// Pre-register defined dots
Object.values(KNOWN_PALETTE).forEach(p => usedDotColors.add(p.dot))

/**
 * ONE single source of truth returning { dot, bg, text, darkBg, darkText, icon } for a category name.
 * Case-insensitive, trimmed, deterministic, with collision detection.
 */
export function getCategoryMeta(categoryName?: string): CategoryMeta {
  const trimmed = categoryName?.trim() || 'Miscellaneous'
  const key = trimmed.toLowerCase()

  if (assignedCategoryMap.has(key)) {
    return assignedCategoryMap.get(key)!
  }

  // Known categories
  if (KNOWN_PALETTE[key]) {
    const meta: CategoryMeta = {
      label: trimmed,
      ...KNOWN_PALETTE[key]
    }
    assignedCategoryMap.set(key, meta)
    return meta
  }

  // Miscellaneous
  if (key === 'miscellaneous') {
    const meta: CategoryMeta = {
      label: trimmed,
      ...MISC_PALETTE
    }
    assignedCategoryMap.set(key, meta)
    return meta
  }

  // Deterministic hashing into DYNAMIC_PALETTE (excluding Miscellaneous)
  const hash = hashCategoryString(key)
  const initialIndex = hash % DYNAMIC_PALETTE.length
  let chosenIndex = initialIndex

  // If collision occurs with an already used color on screen, pick next unused palette entry
  for (let offset = 0; offset < DYNAMIC_PALETTE.length; offset++) {
    const candidateIdx = (initialIndex + offset) % DYNAMIC_PALETTE.length
    const candidateDot = DYNAMIC_PALETTE[candidateIdx].dot
    if (!usedDotColors.has(candidateDot)) {
      chosenIndex = candidateIdx
      break
    }
  }

  const chosen = DYNAMIC_PALETTE[chosenIndex]
  usedDotColors.add(chosen.dot)

  const meta: CategoryMeta = {
    label: trimmed,
    icon: Tag,
    dot: chosen.dot,
    bg: chosen.bg,
    text: chosen.text,
    darkBg: chosen.darkBg,
    darkText: chosen.darkText
  }

  assignedCategoryMap.set(key, meta)
  return meta
}

interface CategoryPillProps {
  category?: string
  className?: string
  size?: 'sm' | 'md'
  showIcon?: boolean
}

/**
 * Universal Category Pill component ensuring consistent colors, borders, and dark mode support
 */
export const CategoryPill: React.FC<CategoryPillProps> = ({
  category,
  className = '',
  size = 'md',
  showIcon = true
}) => {
  const meta = getCategoryMeta(category)
  const Icon = meta.icon

  const sizeClasses =
    size === 'sm'
      ? 'px-1.5 py-0.2 text-[10px] gap-1'
      : 'px-2.5 py-0.5 text-xs gap-1.5'

  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'

  return (
    <span
      style={{
        backgroundColor: meta.bg,
        color: meta.text,
        borderColor: `${meta.dot}40`
      }}
      className={`inline-flex items-center font-semibold rounded-full border transition-colors select-none ${sizeClasses} ${className}`}
    >
      {showIcon && <Icon className={`${iconSize} shrink-0`} style={{ color: meta.text }} />}
      <span className="truncate">{category || 'Miscellaneous'}</span>
    </span>
  )
}
