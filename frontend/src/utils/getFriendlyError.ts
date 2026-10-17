/**
 * AQUZIO CENTRAL ERROR TRANSLATOR (Single Source of Truth)
 *
 * Normalizes every technical, server, library, or network error into clear,
 * calm, human-friendly, context-aware messages without technical jargon.
 */

export type ErrorContext =
  | 'login'
  | 'register'
  | 'forgot-password'
  | 'payroll'
  | 'expenses'
  | 'purchases'
  | 'sales'
  | 'production'
  | 'inventory'
  | 'assets'
  | 'backup'
  | 'load-data'
  | 'save'
  | 'delete'
  | 'generic'
  | string

export interface FriendlyErrorResult {
  title: string
  message: string
  type: 'error' | 'warning' | 'info'
  fieldErrors?: Record<string, string>
  referenceId?: string
  statusCode?: number
}

/**
 * Checks whether a server error message is truly human-readable
 * and free of technical leakages (SQL, stack traces, axios text, status codes, etc.)
 */
export function isHumanReadableMessage(msg: any): boolean {
  if (typeof msg !== 'string') return false
  const trimmed = msg.trim()
  if (trimmed.length < 3 || trimmed.length > 160) return false

  const lower = trimmed.toLowerCase()

  // Prohibited technical words and leak indicators
  const prohibitedSubstrings = [
    'axios',
    'request failed',
    'status code',
    'network error',
    'failed to fetch',
    'exception',
    'nullreference',
    'object reference',
    'npgsql',
    'postgres',
    'dbupdate',
    'econnrefused',
    'etimedout',
    'econnreset',
    'socket hang up',
    'undefined',
    'null',
    '[object',
    'error:',
    'err_',
    'stacktrace',
    'stack trace',
    'line ',
    '.cs:',
    '.ts:',
    '.js:',
    'system.',
    'microsoft.',
    'internal server',
    'syntax error',
    'foreign key',
    'unique constraint',
    'ix_',
    'select ',
    'insert into',
    'update ',
    'delete from',
  ]

  for (const phrase of prohibitedSubstrings) {
    if (lower.includes(phrase)) return false
  }

  // Reject status code patterns like "401", "500 error", etc.
  if (/\b[45]\d{2}\b/.test(trimmed)) return false

  return true
}

/**
 * Extracts and maps field-level validation errors from server responses
 */
function extractFieldErrors(data: any): Record<string, string> | undefined {
  if (!data || !data.errors) return undefined
  const result: Record<string, string> = {}

  if (typeof data.errors === 'object' && !Array.isArray(data.errors)) {
    for (const [key, val] of Object.entries(data.errors)) {
      const fieldKey = key.charAt(0).toLowerCase() + key.slice(1)
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
        result[fieldKey] = isHumanReadableMessage(val[0])
          ? val[0]
          : 'Please enter a valid value.'
      } else if (typeof val === 'string') {
        result[fieldKey] = isHumanReadableMessage(val)
          ? val
          : 'Please enter a valid value.'
      }
    }
  }

  return Object.keys(result).length > 0 ? result : undefined
}

/**
 * Central Error Translator
 *
 * @param error - The raw error (AxiosError, Error, string, or API response)
 * @param context - Context where the error occurred ("login", "register", "payroll", etc.)
 * @returns {FriendlyErrorResult}
 */
export function getFriendlyError(
  error: any,
  context: ErrorContext = 'generic'
): FriendlyErrorResult {
  // Always log technical details to the console in development for debugging
  if (import.meta.env?.DEV) {
    console.error(`[API Error in '${context}']`, {
      originalError: error,
      status: error?.response?.status,
      data: error?.response?.data,
      url: error?.config?.url,
    })
  }

  // Extract HTTP status and payload
  let status = error?.response?.status || error?.status || 0
  const data = error?.response?.data || (typeof error === 'object' ? error : null)
  const code = (data?.code || error?.code || '').toString().toUpperCase()
  const rawServerMsg = data?.message || (typeof error === 'string' ? error : error?.message || '')
  const serverMsgIsClean = isHumanReadableMessage(rawServerMsg)
  const fieldErrors = extractFieldErrors(data)

  // Extract reference ID if provided by server (e.g., correlation ID)
  const rawRef = data?.referenceId || data?.requestId || data?.traceId
  const referenceId = rawRef && typeof rawRef === 'string' ? rawRef.substring(0, 8).toUpperCase() : undefined

  // Network / Connection Failures (status 0, timeout, offline, network failure)
  if (
    status === 0 ||
    code === 'ERR_NETWORK' ||
    code === 'ECONNABORTED' ||
    code === 'NETWORK_ERROR' ||
    rawServerMsg.toLowerCase().includes('network') ||
    rawServerMsg.toLowerCase().includes('failed to fetch')
  ) {
    return {
      title: 'Connection error',
      message: "Can't reach the server. Check your internet connection and try again.",
      type: 'error',
      statusCode: 0,
    }
  }

  // -------------------------------------------------------------
  // CONTEXT-SPECIFIC OVERRIDES
  // -------------------------------------------------------------

  // 1. LOGIN CONTEXT
  if (context === 'login') {
    if (status === 401 || status === 400 || status === 404 || code === 'INVALID_CREDENTIALS') {
      return {
        title: 'Incorrect email or password',
        message: 'Check your details and try again.',
        type: 'error',
        statusCode: 401,
      }
    }
    if (status === 429) {
      return {
        title: 'Too many attempts',
        message: 'Too many login attempts. Please wait a minute and try again.',
        type: 'error',
        statusCode: 429,
      }
    }
  }

  // 2. REGISTER CONTEXT
  if (context === 'register') {
    const isDuplicate =
      status === 409 ||
      code === 'EMAIL_EXISTS' ||
      code === 'DUPLICATE_RECORD' ||
      rawServerMsg.toLowerCase().includes('already registered') ||
      rawServerMsg.toLowerCase().includes('already exists')

    if (isDuplicate) {
      return {
        title: 'Account already exists',
        message: 'An account with this email already exists. Sign in instead.',
        type: 'error',
        fieldErrors: {
          email: 'An account with this email already exists. Sign in instead.',
        },
        statusCode: 409,
      }
    }

    if (status === 400 || status === 422) {
      return {
        title: 'Check your details',
        message: 'Some details look incorrect. Please check the highlighted fields.',
        type: 'error',
        fieldErrors,
        statusCode: status,
      }
    }
  }

  // 3. FORGOT PASSWORD CONTEXT
  if (context === 'forgot-password') {
    // Unknown email on request step -> always show neutral confirmation to avoid enumeration
    if (status === 404 || rawServerMsg.toLowerCase().includes('not found')) {
      return {
        title: 'Check your email',
        message: 'If this email is registered, a recovery code has been sent.',
        type: 'info',
        statusCode: 200,
      }
    }

    const msgLower = rawServerMsg.toLowerCase()
    if (code === 'OTP_EXPIRED' || msgLower.includes('expired')) {
      return {
        title: 'Code expired',
        message: 'This code has expired. Request a new one.',
        type: 'error',
        statusCode: 400,
      }
    }

    if (code === 'INVALID_OTP' || msgLower.includes('invalid') || status === 400) {
      return {
        title: 'Incorrect recovery code',
        message: "That code isn't correct. Check the code and try again.",
        type: 'error',
        statusCode: 400,
      }
    }
  }

  // 4. PAYROLL CONTEXT
  if (context === 'payroll') {
    if (status === 423 || code === 'PAYROLL_FINALIZED' || code === 'LOCKED') {
      return {
        title: 'Payroll month is locked',
        message: "This payroll month is finalized, so changes can't be made. Reopen the month or pick another one.",
        type: 'warning',
        statusCode: 423,
      }
    }
    if (code === 'NOTHING_PAYABLE') {
      return {
        title: 'No pending payments',
        message: 'There are no payable wages or commissions for the selected period.',
        type: 'info',
        statusCode: 400,
      }
    }
  }

  // 5. PRODUCTION & BATCH CONTEXT
  if (context === 'production' || context === 'batch') {
    if (code === 'BATCH_ALREADY_CLOSED' || rawServerMsg.toLowerCase().includes('already closed')) {
      return {
        title: 'Batch already closed',
        message: 'This production batch has already been finalized and cannot be modified.',
        type: 'warning',
        statusCode: 400,
      }
    }
    if (status === 409 || code === 'DUPLICATE_BATCH_NUMBER') {
      return {
        title: 'Batch number already in use',
        message: 'A batch with this number already exists. Please assign a different batch number.',
        type: 'error',
        statusCode: 409,
      }
    }
  }

  // 6. INVENTORY & STOCK CONTEXT
  if (context === 'inventory' || rawServerMsg.toLowerCase().includes('stock') || rawServerMsg.toLowerCase().includes('inventory')) {
    if (code === 'INSUFFICIENT_STOCK' || rawServerMsg.toLowerCase().includes('insufficient')) {
      return {
        title: 'Insufficient stock',
        message: "There isn't enough stock available to complete this action. Check inventory quantities and try again.",
        type: 'error',
        statusCode: 400,
      }
    }
  }

  // -------------------------------------------------------------
  // HTTP STATUS CODE GENERIC MAPPINGS
  // -------------------------------------------------------------

  // 400 / 422: Validation Errors
  if (status === 400 || status === 422) {
    if (serverMsgIsClean && !rawServerMsg.toLowerCase().includes('one or more validation errors')) {
      return {
        title: 'Check your details',
        message: rawServerMsg,
        type: 'error',
        fieldErrors,
        statusCode: status,
      }
    }
    return {
      title: 'Check your details',
      message: 'Some details look incorrect. Please check the highlighted fields.',
      type: 'error',
      fieldErrors,
      statusCode: status,
    }
  }

  // 401: Unauthorized / Expired Session (outside login)
  if (status === 401) {
    return {
      title: 'Session expired',
      message: 'Your session has expired. Please sign in again.',
      type: 'warning',
      statusCode: 401,
    }
  }

  // 403: Forbidden / Permission Denied
  if (status === 403 || code === 'FORBIDDEN' || code === 'PERMISSION_DENIED') {
    return {
      title: 'Permission required',
      message: "You don't have permission to do this. Contact your administrator if you think this is a mistake.",
      type: 'error',
      statusCode: 403,
    }
  }

  // 404: Not Found
  if (status === 404 || code === 'NOT_FOUND') {
    return {
      title: 'Item not found',
      message: "We couldn't find what you were looking for. It may have been moved or deleted.",
      type: 'error',
      statusCode: 404,
    }
  }

  // 409: Conflict / Duplicates
  if (status === 409 || code === 'CONFLICT' || code === 'DUPLICATE_RECORD') {
    if (serverMsgIsClean) {
      return {
        title: 'Already exists',
        message: rawServerMsg,
        type: 'error',
        statusCode: 409,
      }
    }
    return {
      title: 'Already exists',
      message: 'This already exists. Try a different name or check the existing record.',
      type: 'error',
      statusCode: 409,
    }
  }

  // 423: Locked Record
  if (status === 423 || code === 'LOCKED') {
    return {
      title: 'Record locked',
      message: 'This record is currently finalized or locked and cannot be edited.',
      type: 'warning',
      statusCode: 423,
    }
  }

  // 429: Rate Limited
  if (status === 429 || code === 'TOO_MANY_REQUESTS') {
    return {
      title: 'Too many attempts',
      message: 'Too many attempts. Please wait a minute and try again.',
      type: 'error',
      statusCode: 429,
    }
  }

  // 500 / 502 / 503 / 504: Server Side Failures
  if (status >= 500 && status <= 504) {
    const refSuffix = referenceId ? ` (Ref: ${referenceId})` : ''
    return {
      title: 'Something went wrong',
      message: `Something went wrong on our side. Please try again in a moment. If it keeps happening, contact support.${refSuffix}`,
      type: 'error',
      referenceId,
      statusCode: status,
    }
  }

  // If server provided a clean, human-readable message without jargon
  if (serverMsgIsClean) {
    return {
      title: 'Action could not be completed',
      message: rawServerMsg,
      type: 'error',
      statusCode: status || undefined,
    }
  }

  // Generic fallback
  return {
    title: 'Something went wrong',
    message: 'Something went wrong. Please try again.',
    type: 'error',
    statusCode: status || undefined,
  }
}

export default getFriendlyError
