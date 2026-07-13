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
  showToast: (message, type, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9)
    set((state) => ({ toasts: [...state.toasts, { id, message, type, duration }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, duration)
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
}))
