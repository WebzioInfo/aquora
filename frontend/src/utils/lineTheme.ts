export interface LineTheme {
  primary: string      // Base color hex (e.g. #1A56DB)
  secondary: string    // Lighter background accent hex
  badgeBg: string      // Solid badge background color
  borderColor: string  // Primary border color
  iconColor: string    // Indicator dot/icon color
  textColor: string    // High-contrast text color
  glow: string         // Focus glow / shadow color
  dotEmoji: string     // Text dot indicator
}

export const LINE_PALETTE: Omit<LineTheme, 'dotEmoji'>[] = [
  { // Blue
    primary: '#1A56DB',
    secondary: '#E8F0FE',
    badgeBg: '#1A56DB',
    borderColor: '#1A56DB',
    iconColor: '#1A56DB',
    textColor: '#1E40AF',
    glow: 'rgba(26, 86, 219, 0.15)'
  },
  { // Green
    primary: '#16A34A',
    secondary: '#DCFCE7',
    badgeBg: '#16A34A',
    borderColor: '#16A34A',
    iconColor: '#16A34A',
    textColor: '#15803D',
    glow: 'rgba(22, 163, 74, 0.15)'
  },
  { // Orange
    primary: '#EA580C',
    secondary: '#FFEDD5',
    badgeBg: '#EA580C',
    borderColor: '#EA580C',
    iconColor: '#EA580C',
    textColor: '#C2410C',
    glow: 'rgba(234, 88, 12, 0.15)'
  },
  { // Purple
    primary: '#7C3AED',
    secondary: '#F3E8FF',
    badgeBg: '#7C3AED',
    borderColor: '#7C3AED',
    iconColor: '#7C3AED',
    textColor: '#6D28D9',
    glow: 'rgba(124, 58, 237, 0.15)'
  },
  { // Cyan
    primary: '#0891B2',
    secondary: '#ECFEFF',
    badgeBg: '#0891B2',
    borderColor: '#0891B2',
    iconColor: '#0891B2',
    textColor: '#0369A1',
    glow: 'rgba(8, 145, 178, 0.15)'
  },
  { // Red
    primary: '#DC2626',
    secondary: '#FEE2E2',
    badgeBg: '#DC2626',
    borderColor: '#DC2626',
    iconColor: '#DC2626',
    textColor: '#B91C1C',
    glow: 'rgba(220, 38, 38, 0.15)'
  },
  { // Indigo
    primary: '#4F46E5',
    secondary: '#EEF2FF',
    badgeBg: '#4F46E5',
    borderColor: '#4F46E5',
    iconColor: '#4F46E5',
    textColor: '#3730A3',
    glow: 'rgba(79, 70, 229, 0.15)'
  },
  { // Teal
    primary: '#0D9488',
    secondary: '#CCFBF1',
    badgeBg: '#0D9488',
    borderColor: '#0D9488',
    iconColor: '#0D9488',
    textColor: '#0F766E',
    glow: 'rgba(13, 148, 136, 0.15)'
  }
]

export const DOT_EMOJIS = ['🔵', '🟢', '🟠', '🟣', '🌐', '🔴', '🔮', '🟢']

export const getLineTheme = (lineName: string, lineId?: string): LineTheme => {
  const identifier = lineId || lineName || ''
  const match = lineName.match(/\d+/)
  let index = 0
  
  if (match) {
    // If it contains a number, use it directly (e.g. Line 1 -> index 0)
    index = (parseInt(match[0]) - 1) % LINE_PALETTE.length
  } else {
    // Hash key fallback for custom names
    let hash = 0
    for (let i = 0; i < identifier.length; i++) {
      hash = identifier.charCodeAt(i) + ((hash << 5) - hash)
    }
    index = Math.abs(hash) % LINE_PALETTE.length
  }
  
  const palette = LINE_PALETTE[index]
  const dotEmoji = DOT_EMOJIS[index % DOT_EMOJIS.length]
  
  return {
    ...palette,
    dotEmoji
  }
}
