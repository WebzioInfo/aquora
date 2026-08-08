import { useNotificationStore } from '../store/useNotificationStore'
import type { Toast } from '../store/useNotificationStore'
import { mapErrorToUserFriendly } from './errorMapper'

export const showToast = (
  message: string,
  type: Toast['type'] = 'info',
  duration?: number,
  title?: string,
  actionLabel?: string,
  onAction?: () => void
) => {
  useNotificationStore.getState().showToast(message, type, duration, title, actionLabel, onAction)
}

export const toast = {
  success: (msg: string, title?: string, duration?: number) =>
    showToast(msg, 'success', duration, title || 'Success'),

  error: (err: any, customTitle?: string, duration?: number) => {
    const mapped = mapErrorToUserFriendly(err)
    showToast(mapped.message, 'error', duration, customTitle || mapped.title)
  },

  info: (msg: string, title?: string, duration?: number) =>
    showToast(msg, 'info', duration, title || 'Notice'),

  warning: (msg: string, title?: string, duration?: number) =>
    showToast(msg, 'warning', duration, title || 'Attention'),
}
