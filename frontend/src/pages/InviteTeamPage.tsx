import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { onboardingService } from '../services/onboarding'
import { useNotificationStore } from '../store/useNotificationStore'
import { useAuthStore } from '../store/useAuthStore'
import { Droplet, Lock, Trash2 } from 'lucide-react'
import EnterpriseInput from '../components/ui/EnterpriseInput'
import EnterpriseSelect from '../components/ui/EnterpriseSelect'
import EnterpriseButton from '../components/ui/EnterpriseButton'
import EnterpriseBadge from '../components/ui/EnterpriseBadge'

const inviteSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  role: z.string().min(1, 'Role is required'),
})

type InviteFormInputs = z.infer<typeof inviteSchema>

interface Invitee {
  email: string
  role: string
}

export const InviteTeamPage: React.FC = () => {
  const navigate = useNavigate()
  const { showToast } = useNotificationStore()
  const { updateUser } = useAuthStore()
  const [invitees, setInvitees] = useState<Invitee[]>([])
  const [sending, setSending] = useState(false)

  const roles = [
    { label: 'Owner', value: 'Owner' },
    { label: 'Admin', value: 'Admin' },
    { label: 'Manager', value: 'Manager' },
    { label: 'QC', value: 'QC' },
    { label: 'Operator', value: 'Operator' },
    { label: 'Maintenance', value: 'Maintenance' },
    { label: 'Inventory', value: 'Inventory' },
  ]

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormInputs>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'Operator',
    },
  })

  const onAddInvitee = (data: InviteFormInputs) => {
    if (invitees.some((i) => i.email.toLowerCase() === data.email.toLowerCase())) {
      showToast('Email has already been added to the list.', 'warning')
      return
    }
    setInvitees([...invitees, { email: data.email, role: data.role }])
    reset({ email: '', role: 'Operator' })
  }

  const onRemoveInvitee = (index: number) => {
    setInvitees(invitees.filter((_, idx) => idx !== index))
  }

  const handleSendInvites = async () => {
    if (invitees.length === 0) {
      updateUser({ isTenantInitialized: true })
      navigate('/company')
      return
    }

    setSending(true)
    try {
      // Send invitations sequentially
      for (const invitee of invitees) {
        await onboardingService.inviteMember(invitee)
      }
      showToast(`Invited ${invitees.length} team member(s) successfully!`, 'success')
      updateUser({ isTenantInitialized: true })
      navigate('/company')
    } catch (error: any) {
      showToast('Failed to invite one or more team members.', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col w-full gap-8">
      {/* Title block */}
      <div className="flex flex-col items-center gap-4 text-center select-none">
        <div className="w-14 h-14 bg-[#1A56DB] flex items-center justify-center rounded-[8px] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <Droplet className="w-8 h-8 text-white fill-white" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-[#111827] dark:text-white">Invite Your Team</h1>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Establish operator roles and accounts
          </p>
        </div>
      </div>

      {/* Form to Add to List */}
      <form onSubmit={handleSubmit(onAddInvitee)} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Email input */}
          <EnterpriseInput 
            id="email"
            label="Colleague's Email *"
            placeholder="colleague@aquaflow.industrial"
            type="email"
            disabled={sending}
            error={errors.email?.message}
            {...register('email')}
          />

          {/* Role selector */}
          <EnterpriseSelect
            id="role"
            label="Role *"
            disabled={sending}
            error={errors.role?.message}
            {...register('role')}
          >
            {roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </EnterpriseSelect>
        </div>

        {/* Add button */}
        <EnterpriseButton
          type="submit"
          disabled={sending}
          variant="secondary"
          className="w-full mt-2"
        >
          Add Member to List
        </EnterpriseButton>
      </form>

      {/* Invitees list */}
      {invitees.length > 0 && (
        <div className="flex flex-col gap-2 select-none text-left">
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Invitee List</label>
          <div className="max-h-36 overflow-y-auto border border-[#E2E8F0] dark:border-slate-700 p-2 bg-slate-50 dark:bg-slate-850 flex flex-col gap-1.5 rounded-[8px]">
            {invitees.map((invitee, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-white dark:bg-slate-900 px-3 py-2 border border-[#E2E8F0] dark:border-slate-800 text-xs text-slate-800 dark:text-white rounded-[6px]"
              >
                <div className="flex flex-col">
                  <span className="font-semibold">{invitee.email}</span>
                  <span className="text-[10px] text-slate-400">Role: {invitee.role}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveInvitee(idx)}
                  className="text-red-500 hover:text-red-700 cursor-pointer select-none font-semibold flex items-center gap-1"
                  disabled={sending}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global Actions */}
      <div className="flex gap-4 select-none">
        <EnterpriseButton
          type="button"
          disabled={sending}
          onClick={() => {
            updateUser({ isTenantInitialized: true })
            navigate('/company')
          }}
          variant="ghost"
          className="w-1/2"
        >
          Skip Setup
        </EnterpriseButton>

        <EnterpriseButton
          type="button"
          onClick={handleSendInvites}
          disabled={sending}
          className="w-1/2"
        >
          {invitees.length > 0 ? 'Send Invites' : 'Finish Setup'}
        </EnterpriseButton>
      </div>

      {/* Card Info Footer */}
      <div className="pt-6 border-t border-slate-200 dark:border-slate-800 text-center flex flex-col items-center gap-3 select-none">
        <p className="text-xs leading-relaxed text-slate-500">
          Proprietary Industrial Resource Planning Environment.
        </p>
        <EnterpriseBadge variant="danger" className="flex items-center gap-1">
          <Lock className="w-3 h-3" />
          <span>Secure Access Only</span>
        </EnterpriseBadge>
      </div>
    </div>
  )
}

export default InviteTeamPage
