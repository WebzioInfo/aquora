import { create } from 'zustand'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  duration?: number
}

interface NotificationState {
  toasts: Toast[]
  showToast: (message: string, type: Toast['type'], duration?: number) => void
  removeToast: (id: string) => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  toasts: [],
  showToast: (message, type, duration) => {
    const id = Math.random().toString(36).substring(2, 9)
    let defaultDuration = 4000
    if (type === 'success') defaultDuration = 3000
    else if (type === 'warning') defaultDuration = 5000
    else if (type === 'error') defaultDuration = 6000
    
    const actualDuration = duration ?? defaultDuration
    set((state) => ({ toasts: [...state.toasts, { id, message, type, duration: actualDuration }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, actualDuration)
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
}))
