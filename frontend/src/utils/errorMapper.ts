import { getFriendlyError } from './getFriendlyError'
import type { FriendlyErrorResult } from './getFriendlyError'

export interface UserFriendlyError {
  title: string
  message: string
  category: 'validation' | 'duplicate' | 'auth' | 'permission' | 'not_found' | 'rate_limit' | 'network' | 'system'
  canUserFix: boolean
  code: string
  referenceId?: string
}

/**
 * Adapter ensuring 100% compatibility with existing errorMapper callers,
 * backed by the single source of truth: getFriendlyError.
 */
export function mapErrorToUserFriendly(error: any, context = 'generic'): UserFriendlyError {
  const friendly: FriendlyErrorResult = getFriendlyError(error, context)

  let category: UserFriendlyError['category'] = 'system'
  if (friendly.statusCode === 401) category = 'auth'
  else if (friendly.statusCode === 403) category = 'permission'
  else if (friendly.statusCode === 404) category = 'not_found'
  else if (friendly.statusCode === 409) category = 'duplicate'
  else if (friendly.statusCode === 429) category = 'rate_limit'
  else if (friendly.statusCode === 0) category = 'network'
  else if (friendly.statusCode && friendly.statusCode < 500) category = 'validation'

  return {
    title: friendly.title,
    message: friendly.message,
    category,
    canUserFix: category !== 'system' && category !== 'permission',
    code: friendly.statusCode?.toString() || 'ERROR',
    referenceId: friendly.referenceId,
  }
}

export default mapErrorToUserFriendly
