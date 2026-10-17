import { create } from 'zustand'
import { getFriendlyError, isHumanReadableMessage } from '../utils/getFriendlyError'
import type { ErrorContext } from '../utils/getFriendlyError'

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
  showError: (error: any, context?: ErrorContext, fallbackMessage?: string) => void
  removeToast: (id: string) => void
  clearAll: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  toasts: [],
  showToast: (rawMessage, type = 'info', duration, title, actionLabel, onAction) => {
    if (!rawMessage) return

    let safeMessage = rawMessage
    let safeTitle = title

    // Defense-in-depth: If an error toast receives a raw axios/technical message, normalize it
    if (type === 'error' && !isHumanReadableMessage(rawMessage)) {
      const friendly = getFriendlyError(rawMessage)
      safeMessage = friendly.message
      if (!safeTitle) safeTitle = friendly.title
    }

    const now = Date.now()
    const currentToasts = get().toasts

    // Deduplicate identical toasts dispatched within 2.5 seconds
    const isDuplicate = currentToasts.some(
      (t) => t.message === safeMessage && t.type === type && now - t.createdAt < 2500
    )
    if (isDuplicate) return

    const id = Math.random().toString(36).substring(2, 9)

    // Standardized durations
    let defaultDuration = 4500
    if (type === 'success') defaultDuration = 3500
    else if (type === 'warning') defaultDuration = 5500
    else if (type === 'error') defaultDuration = 6500

    const actualDuration = duration ?? defaultDuration

    if (!safeTitle) {
      switch (type) {
        case 'success':
          safeTitle = 'Success'
          break
        case 'error':
          safeTitle = 'Action could not be completed'
          break
        case 'warning':
          safeTitle = 'Attention'
          break
        default:
          safeTitle = 'Notice'
          break
      }
    }

    const newToast: Toast = {
      id,
      title: safeTitle,
      message: safeMessage,
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

  showError: (error, context = 'generic', fallbackMessage) => {
    const friendly = getFriendlyError(error, context)
    const msg = friendly.message || fallbackMessage || 'Something went wrong. Please try again.'
    get().showToast(msg, 'error', undefined, friendly.title)
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  clearAll: () => set({ toasts: [] }),
}))
