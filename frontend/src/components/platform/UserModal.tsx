import React, { useState, useEffect } from 'react'
import { User, Mail, Phone, Lock, Briefcase, ShieldCheck, X } from 'lucide-react'
import EnterpriseInput from '../ui/EnterpriseInput'
import EnterpriseSelect from '../ui/EnterpriseSelect'
import EnterpriseButton from '../ui/EnterpriseButton'

interface UserModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: any) => Promise<void>
  initialData?: any
  isEditing?: boolean
  tenantsList?: any[]
}

export const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isEditing = false,
  tenantsList = []
}) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    phone: '',
    roleName: 'Standard',
    department: 'Operations',
    designation: 'Staff Member',
    shift: 'Day Shift (09:00 - 18:00)',
    salary: '75000',
    joiningDate: '',
    password: '',
    confirmPassword: '',
    status: 'Active',
    tenantId: '',
    photoUrl: ''
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialData) {
      setFormData({
        firstName: initialData.firstName || '',
        lastName: initialData.lastName || '',
        username: initialData.username || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        roleName: initialData.roleName || 'Standard',
        department: initialData.department || 'Operations',
        designation: initialData.designation || 'Staff Member',
        shift: initialData.shift || 'Day Shift (09:00 - 18:00)',
        salary: initialData.salary ? String(initialData.salary) : '75000',
        joiningDate: initialData.joiningDate ? initialData.joiningDate.substring(0, 10) : '',
        password: '',
        confirmPassword: '',
        status: initialData.status || (initialData.isActive ? 'Active' : 'Inactive'),
        tenantId: initialData.tenantId || '',
        photoUrl: initialData.photoUrl || ''
      })
    } else {
      setFormData({
        firstName: '',
        lastName: '',
        username: '',
        email: '',
        phone: '',
        roleName: 'Standard',
        department: 'Operations',
        designation: 'Staff Member',
        shift: 'Day Shift (09:00 - 18:00)',
        salary: '75000',
        joiningDate: new Date().toISOString().substring(0, 10),
        password: '',
        confirmPassword: '',
        status: 'Active',
        tenantId: '',
        photoUrl: ''
      })
    }
    setError(null)
  }, [initialData, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.firstName.trim()) {
      setError('First Name is required.')
      return
    }
    if (!formData.email.trim()) {
      setError('Corporate Email is required.')
      return
    }
    if (!isEditing && !formData.password) {
      setError('Password is required for new users.')
      return
    }
    if (formData.password && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await onSubmit({
        ...formData,
        salary: formData.salary ? parseFloat(formData.salary) : null,
        tenantId: formData.tenantId ? formData.tenantId : null
      })
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Operation failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      <div onClick={onClose} className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" />

      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isEditing ? 'Edit User Directory Account' : 'Provision New System User Account'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EnterpriseInput 
              label="First Name *" 
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
            />
            <EnterpriseInput 
              label="Last Name *" 
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              required
            />
            <EnterpriseInput 
              label="Username" 
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="john.doe"
            />
            <EnterpriseInput 
              label="Corporate Email *" 
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
            <EnterpriseInput 
              label="Phone Number" 
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <EnterpriseSelect
              label="System Privileges / Role *"
              value={formData.roleName}
              onChange={(val) => setFormData({ ...formData, roleName: val })}
              options={[
                { label: 'SuperAdmin (Platform-Wide)', value: 'SuperAdmin' },
                { label: 'CompanyAdmin (Tenant Owner)', value: 'CompanyAdmin' },
                { label: 'Admin (Full Tenant Access)', value: 'Admin' },
                { label: 'Manager (Department Supervisor)', value: 'Manager' },
                { label: 'Operator (Line Terminal)', value: 'Operator' },
                { label: 'Standard User', value: 'Standard' }
              ]}
            />
            <EnterpriseSelect
              label="Department"
              value={formData.department}
              onChange={(val) => setFormData({ ...formData, department: val })}
              options={[
                { label: 'Operations & Production', value: 'Operations' },
                { label: 'Engineering & Technology', value: 'Engineering' },
                { label: 'Sales & Commercial', value: 'Sales' },
                { label: 'Finance & Accounts', value: 'Finance' },
                { label: 'Human Resources', value: 'HR' },
                { label: 'Quality Assurance', value: 'QA' }
              ]}
            />
            <EnterpriseInput 
              label="Designation / Title" 
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
            />
            <EnterpriseInput 
              label="Work Shift" 
              value={formData.shift}
              onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
            />
            <EnterpriseInput 
              label="Monthly Compensation ($)" 
              type="number"
              value={formData.salary}
              onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
            />
            <EnterpriseInput 
              label="Joining Date" 
              type="date"
              value={formData.joiningDate}
              onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
            />
            <EnterpriseSelect
              label="Assigned Tenant Organization"
              value={formData.tenantId}
              onChange={(val) => setFormData({ ...formData, tenantId: val })}
              options={[
                { label: '-- Global Platform Admin --', value: '' },
                ...tenantsList.map(t => ({ label: t.name, value: t.id }))
              ]}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <EnterpriseInput 
              label={isEditing ? 'New Password (Optional)' : 'Account Password *'}
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required={!isEditing}
            />
            <EnterpriseInput 
              label="Confirm Password" 
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            />
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <EnterpriseButton type="submit" disabled={loading}>
              {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create User Account'}
            </EnterpriseButton>
          </div>
        </form>

      </div>
    </div>
  )
}

export default UserModal
