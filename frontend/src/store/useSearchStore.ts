import { create } from 'zustand'

export interface RecentSearchItem {
  query: string
  timestamp: number
  category?: string
}

interface SearchState {
  isOpen: boolean
  initialQuery: string
  initialScope: string
  openSearch: (query?: string, scope?: string) => void
  closeSearch: () => void
  toggleSearch: () => void
  recentSearches: RecentSearchItem[]
  addRecentSearch: (query: string, category?: string) => void
  clearRecentSearches: () => void
}

const RECENT_KEY = 'aquzio_recent_searches'

const getSavedRecent = (): RecentSearchItem[] => {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export const useSearchStore = create<SearchState>((set, get) => ({
  isOpen: false,
  initialQuery: '',
  initialScope: 'all',

  openSearch: (query = '', scope = 'all') => set({ isOpen: true, initialQuery: query, initialScope: scope }),
  closeSearch: () => set({ isOpen: false, initialQuery: '' }),
  toggleSearch: () => set((state) => ({ isOpen: !state.isOpen })),

  recentSearches: getSavedRecent(),

  addRecentSearch: (query: string, category?: string) => {
    const trimmed = query.trim()
    if (!trimmed || trimmed.length < 2) return

    const existing = get().recentSearches.filter((item) => item.query.toLowerCase() !== trimmed.toLowerCase())
    const updated = [{ query: trimmed, timestamp: Date.now(), category }, ...existing].slice(0, 8)

    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
    } catch {}

    set({ recentSearches: updated })
  },

  clearRecentSearches: () => {
    try {
      localStorage.removeItem(RECENT_KEY)
    } catch {}
    set({ recentSearches: [] })
  }
}))
