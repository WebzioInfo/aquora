import { useNotificationStore } from '../store/useNotificationStore'

export const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', duration?: number) => {
  useNotificationStore.getState().showToast(message, type, duration)
}
