import { create } from 'zustand'

interface ThemeState {
  theme: 'light'
  toggleTheme: () => void
  initTheme: () => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'light',
  toggleTheme: () => {
    // Persist light theme to align content area and sidebar with the light design system
    localStorage.setItem('theme', 'light')
    document.documentElement.classList.remove('dark')
    set({ theme: 'light' })
  },
  initTheme: () => {
    document.documentElement.classList.remove('dark')
  }
}))
export default useThemeStore
