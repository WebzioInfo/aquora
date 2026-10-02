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

export const getVendorInitials = (name: string): string => {
  if (!name) return 'VN'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

const AVATAR_PALETTES = [
  { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' }, // Blue
  { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' }, // Purple
  { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' }, // Emerald
  { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' }, // Orange
  { bg: '#FDF2F8', text: '#BE185D', border: '#FBCFE8' }, // Pink
  { bg: '#F0FDFA', text: '#0F766E', border: '#99F6E4' }  // Teal
]

export const getAvatarColor = (name: string) => {
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i)
    hash |= 0
  }
  const idx = Math.abs(hash) % AVATAR_PALETTES.length
  return AVATAR_PALETTES[idx]
}

export const calculateShareOfPayable = (vendorBalance: number, totalPayable: number): number => {
  if (totalPayable <= 0 || vendorBalance <= 0) return 0
  const pct = (vendorBalance / totalPayable) * 100
  return Math.min(100, Math.max(0, Math.round(pct * 10) / 10))
}
