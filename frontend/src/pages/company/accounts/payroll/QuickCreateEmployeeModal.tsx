import React, { useState, useEffect, useRef } from 'react'
import { X, Loader2, AlertCircle, UserPlus, Shield } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { employeesService, type EmployeeDto, type EmployeeRole } from '../../../../services/employees'
import { useNotificationStore } from '../../../../store/useNotificationStore'

interface QuickCreateEmployeeModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newEmployee: EmployeeDto) => void
}

export const QuickCreateEmployeeModal: React.FC<QuickCreateEmployeeModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { showToast } = useNotificationStore()
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Form states
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [isUsernameCustomized, setIsUsernameCustomized] = useState(false)
  const [email, setEmail] = useState('')
  const [roleCode, setRoleCode] = useState('')
  const [department, setDepartment] = useState('Operations')
  const [passwordOrPin, setPasswordOrPin] = useState('1234')
  const [currentSalary, setCurrentSalary] = useState('')

  // UI / submission states
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // Fetch available roles (excluding system Admin)
  const { data: roles = [], isLoading: isLoadingRoles } = useQuery<EmployeeRole[]>({
    queryKey: ['quickEmployeeRoles'],
    queryFn: employeesService.getRoles,
    enabled: isOpen
  })

  // Fetch departments
  const { data: departments = [] } = useQuery<string[]>({
    queryKey: ['quickEmployeeDepartments'],
    queryFn: employeesService.getDepartments,
    enabled: isOpen
  })

  // Set default role once roles load
  useEffect(() => {
    if (roles.length > 0 && !roleCode) {
      const defaultRole = roles.find(r => r.code?.toUpperCase() === 'OPERATOR') || roles[0]
      if (defaultRole) setRoleCode(defaultRole.code)
    }
  }, [roles, roleCode])

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFullName('')
      setUsername('')
      setIsUsernameCustomized(false)
      setEmail('')
      setDepartment('Operations')
      setPasswordOrPin('1234')
      setCurrentSalary('')
      setErrors({})
      setServerError(null)
      setIsSubmitting(false)

      setTimeout(() => {
        nameInputRef.current?.focus()
      }, 50)
    }
  }, [isOpen])

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSubmitting, onClose])

  // Auto-generate username from Full Name if not manually customized
  const handleFullNameChange = (val: string) => {
    setFullName(val)
    if (!isUsernameCustomized) {
      const slug = val
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
      setUsername(slug)
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!fullName.trim()) {
      newErrors.fullName = 'Full Name is required.'
    }

    const trimmedUsername = username.trim()
    if (!trimmedUsername) {
      newErrors.username = 'Username is required.'
    } else if (trimmedUsername.length < 3) {
      newErrors.username = 'Username must be at least 3 characters.'
    }

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      newErrors.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address.'
    }

    if (!roleCode) {
      newErrors.roleCode = 'Role is required.'
    }

    if (!passwordOrPin.trim()) {
      newErrors.passwordOrPin = 'Password or PIN is required.'
    } else if (passwordOrPin.trim().length < 4) {
      newErrors.passwordOrPin = 'Password or PIN must be at least 4 characters.'
    }

    const salaryNum = Number(currentSalary)
    if (!currentSalary || isNaN(salaryNum) || salaryNum <= 0) {
      newErrors.currentSalary = 'Monthly base salary must be greater than zero.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)

    if (!validate() || isSubmitting) return

    try {
      setIsSubmitting(true)
      const res = await employeesService.createEmployee({
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        roleCode,
        passwordOrPin: passwordOrPin.trim(),
        department: department || 'Operations',
        currentSalary: Number(currentSalary)
      })

      if (res.success && res.data) {
        showToast(`Employee "${res.data.fullName}" created successfully.`, 'success')
        onSuccess(res.data)
      } else {
        setServerError(res.message || 'Failed to create employee.')
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.title ||
        err.message ||
        'Unable to create employee. Please try again.'
      setServerError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 overflow-hidden select-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={() => {
          if (!isSubmitting) onClose()
        }}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] animate-in fade-in zoom-in-95 duration-150 z-10 transition-all">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-[#1A56DB]">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Create Employee</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Register employee in company directory & payroll
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3.5 text-xs">
          {serverError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{serverError}</div>
            </div>
          )}

          {/* Full Name & Username */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                ref={nameInputRef}
                type="text"
                value={fullName}
                onChange={e => handleFullNameChange(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className={`w-full h-[36px] px-3 bg-white border rounded-lg text-slate-900 text-xs font-medium focus:outline-none focus:border-[#1A56DB] ${
                  errors.fullName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                }`}
                disabled={isSubmitting}
              />
              {errors.fullName && (
                <p className="text-[11px] text-rose-600 mt-1">{errors.fullName}</p>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Username <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={e => {
                  setUsername(e.target.value)
                  setIsUsernameCustomized(true)
                }}
                placeholder="e.g. rahul_sharma"
                className={`w-full h-[36px] px-3 bg-white border rounded-lg text-slate-900 text-xs font-mono font-medium focus:outline-none focus:border-[#1A56DB] ${
                  errors.username ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                }`}
                disabled={isSubmitting}
              />
              {errors.username && (
                <p className="text-[11px] text-rose-600 mt-1">{errors.username}</p>
              )}
            </div>
          </div>

          {/* Email & Role */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="e.g. rahul@company.com"
                className={`w-full h-[36px] px-3 bg-white border rounded-lg text-slate-900 text-xs font-medium focus:outline-none focus:border-[#1A56DB] ${
                  errors.email ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                }`}
                disabled={isSubmitting}
              />
              {errors.email && (
                <p className="text-[11px] text-rose-600 mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Role <span className="text-rose-500">*</span>
              </label>
              <select
                value={roleCode}
                onChange={e => setRoleCode(e.target.value)}
                disabled={isSubmitting || isLoadingRoles}
                className={`w-full h-[36px] px-3 bg-white border rounded-lg text-slate-900 text-xs font-medium focus:outline-none focus:border-[#1A56DB] ${
                  errors.roleCode ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                }`}
              >
                {roles.length === 0 ? (
                  <option value="">Loading roles...</option>
                ) : (
                  roles.map(r => (
                    <option key={r.id || r.code} value={r.code}>
                      {r.name}
                    </option>
                  ))
                )}
              </select>
              {errors.roleCode && (
                <p className="text-[11px] text-rose-600 mt-1">{errors.roleCode}</p>
              )}
            </div>
          </div>

          {/* Department & PIN/Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Department
              </label>
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                disabled={isSubmitting}
                className="w-full h-[36px] px-3 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-medium focus:outline-none focus:border-[#1A56DB]"
              >
                {departments.map(dept => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Password or 4-Digit PIN <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={passwordOrPin}
                  onChange={e => setPasswordOrPin(e.target.value)}
                  placeholder="e.g. 1234"
                  className={`w-full h-[36px] px-3 bg-white border rounded-lg text-slate-900 text-xs font-medium focus:outline-none focus:border-[#1A56DB] ${
                    errors.passwordOrPin ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                  }`}
                  disabled={isSubmitting}
                />
              </div>
              {errors.passwordOrPin ? (
                <p className="text-[11px] text-rose-600 mt-1">{errors.passwordOrPin}</p>
              ) : (
                <p className="text-[10px] text-slate-400 mt-0.5">Default: 1234 (min. 4 characters)</p>
              )}
            </div>
          </div>

          {/* Current Base Salary */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Monthly Base Salary (₹) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">₹</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={currentSalary}
                onChange={e => setCurrentSalary(e.target.value)}
                placeholder="e.g. 25000.00"
                className={`w-full h-[36px] pl-7 pr-3 bg-white border rounded-lg text-slate-900 font-mono text-xs font-medium focus:outline-none focus:border-[#1A56DB] ${
                  errors.currentSalary ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                }`}
                disabled={isSubmitting}
              />
            </div>
            {errors.currentSalary ? (
              <p className="text-[11px] text-rose-600 mt-1">{errors.currentSalary}</p>
            ) : (
              <p className="text-[10px] text-slate-400 mt-0.5">
                Required for payroll entitlement, salary advances, and settlements.
              </p>
            )}
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-[11px] flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>
              Associated automatically with your company tenant. Available permanently for payroll.
            </span>
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/80 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-[34px] px-3.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-medium text-xs transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="h-[34px] px-4 bg-[#1A56DB] hover:bg-blue-700 text-white font-medium rounded-lg text-xs shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isSubmitting ? 'Creating Employee...' : 'Create Employee'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default QuickCreateEmployeeModal
