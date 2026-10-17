import { useNotificationStore } from '../store/useNotificationStore'
import type { Toast } from '../store/useNotificationStore'
import { getFriendlyError } from './getFriendlyError'
import type { ErrorContext } from './getFriendlyError'

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

  error: (err: any, contextOrTitle?: ErrorContext | string, duration?: number) => {
    // If contextOrTitle is an established context, pass it to getFriendlyError
    const friendly = getFriendlyError(err, contextOrTitle || 'generic')
    const title = friendly.title
    showToast(friendly.message, 'error', duration, title)
  },

  info: (msg: string, title?: string, duration?: number) =>
    showToast(msg, 'info', duration, title || 'Notice'),

  warning: (msg: string, title?: string, duration?: number) =>
    showToast(msg, 'warning', duration, title || 'Attention'),
}

export default toast
