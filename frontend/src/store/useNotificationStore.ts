import { create } from 'zustand'

export interface Toast {
  id: string
  title?: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  duration?: number
  actionLabel?: string
  onAction?: () => void
  createdAt: number
}

interface NotificationState {
  toasts: Toast[]
  showToast: (
    message: string,
    type?: Toast['type'],
    duration?: number,
    title?: string,
    actionLabel?: string,
    onAction?: () => void
  ) => void
  showError: (error: any, fallbackMessage?: string) => void
  removeToast: (id: string) => void
  clearAll: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  toasts: [],
  showToast: (message, type = 'info', duration, title, actionLabel, onAction) => {
    if (!message) return

    const now = Date.now()
    const currentToasts = get().toasts

    // Deduplicate identical toasts dispatched within 2.5 seconds
    const isDuplicate = currentToasts.some(
      (t) => t.message === message && t.type === type && now - t.createdAt < 2500
    )
    if (isDuplicate) return

    const id = Math.random().toString(36).substring(2, 9)

    // Standardized durations per prompt guidelines
    let defaultDuration = 4500
    if (type === 'success') defaultDuration = 3500
    else if (type === 'warning') defaultDuration = 6000
    else if (type === 'error') defaultDuration = 7000

    const actualDuration = duration ?? defaultDuration

    // Infer title if not explicitly provided
    let defaultTitle = title
    if (!defaultTitle) {
      switch (type) {
        case 'success':
          defaultTitle = 'Success'
          break
        case 'error':
          defaultTitle = 'Request Failed'
          break
        case 'warning':
          defaultTitle = 'Warning'
          break
        default:
          defaultTitle = 'Information'
          break
      }
    }

    const newToast: Toast = {
      id,
      title: defaultTitle,
      message,
      type,
      duration: actualDuration,
      actionLabel,
      onAction,
      createdAt: now,
    }

    set((state) => ({
      toasts: [newToast, ...state.toasts].slice(0, 5), // Keep max 5 active toasts
    }))

    if (actualDuration > 0) {
      setTimeout(() => {
        get().removeToast(id)
      }, actualDuration)
    }
  },

  showError: (error, fallbackMessage) => {
    // Import dynamically or map inline
    const msg = error?.response?.data?.message || error?.message || fallbackMessage || 'An unexpected error occurred.'
    get().showToast(msg, 'error')
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  clearAll: () => set({ toasts: [] }),
}))
