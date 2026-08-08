import { AxiosError } from 'axios'

export interface UserFriendlyError {
  title: string
  message: string
  category: 'validation' | 'duplicate' | 'auth' | 'permission' | 'not_found' | 'rate_limit' | 'network' | 'system'
  canUserFix: boolean
  code: string
}

/**
 * Maps raw backend errors, HTTP status codes, DB exceptions, and network failures
 * into clear, actionable, user-friendly feedback without technical jargon.
 */
export function mapErrorToUserFriendly(error: any): UserFriendlyError {
  // 1. Extract raw error info
  let rawMsg = ''
  let statusCode = 0
  let code = ''
  let details: string[] = []

  if (error?.response) {
    statusCode = error.response.status
    const data = error.response.data
    code = data?.code || ''
    rawMsg = data?.message || error.message || ''

    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      details = data.errors.map((e: any) => (typeof e === 'string' ? e : JSON.stringify(e)))
      if (!rawMsg || rawMsg === 'An error occurred') {
        rawMsg = details[0]
      }
    }
  } else if (error?.request) {
    statusCode = 0
    code = 'NETWORK_ERROR'
    rawMsg = error.message || 'Network error'
  } else if (typeof error === 'string') {
    rawMsg = error
  } else if (error?.message) {
    rawMsg = error.message
    code = error.code || ''
  }

  const msgLower = (rawMsg || '').toLowerCase()

  // 2. Technical / DB Exception Leak Protection Guard
  const isTechnicalLeak =
    msgLower.includes('23505') ||
    msgLower.includes('ix_users_') ||
    msgLower.includes('npgsql') ||
    msgLower.includes('postgres') ||
    msgLower.includes('dbupdate') ||
    msgLower.includes('nullreference') ||
    msgLower.includes('object reference') ||
    msgLower.includes('sql') ||
    msgLower.includes('exception') ||
    msgLower.includes('connection refused') ||
    msgLower.includes('econnrefused') ||
    msgLower.includes('an error occurred while saving the entity changes')

  // 3. Category & Message Mapping

  // A. Duplicate Records / Email Already Registered
  if (
    code === 'EMAIL_EXISTS' ||
    msgLower.includes('email is already registered') ||
    msgLower.includes('email already exists') ||
    msgLower.includes('account with this email already exists') ||
    msgLower.includes('already registered')
  ) {
    return {
      title: 'Email Already Registered',
      message: 'An account with this email address already exists. Please sign in or use a different email.',
      category: 'duplicate',
      canUserFix: true,
      code: 'EMAIL_EXISTS',
    }
  }

  if (
    code === 'DUPLICATE_RECORD' ||
    code === 'USERNAME_EXISTS' ||
    code === 'PHONE_EXISTS' ||
    msgLower.includes('already exists') ||
    msgLower.includes('already taken') ||
    msgLower.includes('duplicate key')
  ) {
    let title = 'Duplicate Record'
    let msg = 'A record with this information already exists. Please use unique details.'
    if (msgLower.includes('username')) {
      title = 'Username Taken'
      msg = 'This username is already taken. Please choose another username.'
    } else if (msgLower.includes('phone')) {
      title = 'Phone Number Registered'
      msg = 'This phone number is already registered to another account.'
    } else if (msgLower.includes('subdomain')) {
      title = 'Subdomain Taken'
      msg = 'This company subdomain is already taken. Please choose a different subdomain.'
    } else if (msgLower.includes('code') || msgLower.includes('sku')) {
      title = 'Code Already In Use'
      msg = 'This code is already assigned. Please enter a unique code.'
    } else if (msgLower.includes('invoice')) {
      title = 'Duplicate Invoice Number'
      msg = 'This invoice number already exists. Please enter a unique invoice number.'
    }

    return {
      title,
      message: msg,
      category: 'duplicate',
      canUserFix: true,
      code: code || 'DUPLICATE_RECORD',
    }
  }

  // B. Authentication & Credentials
  if (
    code === 'INVALID_CREDENTIALS' ||
    msgLower.includes('invalid username/email or pin') ||
    msgLower.includes('incorrect pin') ||
    msgLower.includes('invalid credentials')
  ) {
    return {
      title: 'Invalid Credentials',
      message: 'The email/username or password entered is incorrect. Please check and try again.',
      category: 'auth',
      canUserFix: true,
      code: 'INVALID_CREDENTIALS',
    }
  }

  if (msgLower.includes('already_verified') || msgLower.includes('already verified')) {
    return {
      title: 'Account Already Verified',
      message: 'This email address is already verified. You can sign in directly.',
      category: 'auth',
      canUserFix: true,
      code: 'ALREADY_VERIFIED',
    }
  }

  if (msgLower.includes('invalid verification code') || msgLower.includes('invalid pin')) {
    return {
      title: 'Invalid Verification PIN',
      message: 'The verification code entered is incorrect. Please check your email and try again.',
      category: 'auth',
      canUserFix: true,
      code: 'INVALID_OTP',
    }
  }

  if (msgLower.includes('verification code has expired') || msgLower.includes('otp expired')) {
    return {
      title: 'Verification Code Expired',
      message: 'This verification code has expired. Please click "Resend Code" to receive a new one.',
      category: 'auth',
      canUserFix: true,
      code: 'OTP_EXPIRED',
    }
  }

  if (statusCode === 401 || code === 'UNAUTHORIZED' || code === 'SESSION_EXPIRED') {
    return {
      title: 'Session Expired',
      message: 'Your session has expired or is invalid. Please sign in again to continue.',
      category: 'auth',
      canUserFix: true,
      code: 'UNAUTHORIZED',
    }
  }

  // C. Authorization (403)
  if (statusCode === 403 || code === 'PERMISSION_DENIED' || msgLower.includes('permission') || msgLower.includes('forbidden')) {
    return {
      title: 'Access Restricted',
      message: "You don't have permission to perform this action. Please contact your system administrator.",
      category: 'permission',
      canUserFix: false,
      code: 'PERMISSION_DENIED',
    }
  }

  // D. Not Found (404)
  if (statusCode === 404 || code === 'NOT_FOUND' || msgLower.includes('not found')) {
    return {
      title: 'Resource Not Found',
      message: "We couldn't find the requested item. It may have been removed or moved.",
      category: 'not_found',
      canUserFix: false,
      code: 'NOT_FOUND',
    }
  }

  // E. Rate Limit (429)
  if (statusCode === 429 || code === 'TOO_MANY_REQUESTS' || msgLower.includes('too many attempts') || msgLower.includes('rate limit')) {
    return {
      title: 'Too Many Requests',
      message: 'Too many attempts in a short time. Please wait a moment before trying again.',
      category: 'rate_limit',
      canUserFix: true,
      code: 'TOO_MANY_REQUESTS',
    }
  }

  // F. Stock / Business Rule Guards
  if (msgLower.includes('stock') || msgLower.includes('inventory')) {
    return {
      title: 'Stock Unavailable',
      message: rawMsg && !isTechnicalLeak ? rawMsg : 'There is insufficient stock available to fulfill this quantity.',
      category: 'validation',
      canUserFix: true,
      code: 'INSUFFICIENT_STOCK',
    }
  }

  // G. Network Errors (StatusCode 0 or network flags)
  if (statusCode === 0 || code === 'NETWORK_ERROR' || msgLower.includes('network') || msgLower.includes('failed to fetch')) {
    return {
      title: 'Connection Error',
      message: 'Unable to connect to the server. Please check your internet connection and try again.',
      category: 'network',
      canUserFix: true,
      code: 'NETWORK_ERROR',
    }
  }

  // H. User-Fixable Clean Business Validation Errors
  if (!isTechnicalLeak && rawMsg && rawMsg.length < 140 && statusCode < 500) {
    return {
      title: statusCode === 400 ? 'Validation Failed' : 'Action Could Not Be Completed',
      message: rawMsg,
      category: 'validation',
      canUserFix: true,
      code: code || 'VALIDATION_ERROR',
    }
  }

  // I. Server / Technical Errors (500, unhandled crashes, DB leaks)
  return {
    title: 'Unable to Process Request',
    message: "We couldn't complete your request right now. Please try again in a few moments.",
    category: 'system',
    canUserFix: false,
    code: 'SERVER_ERROR',
  }
}
