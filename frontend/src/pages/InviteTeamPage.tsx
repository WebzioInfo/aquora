import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { onboardingService } from '../services/onboarding'
import { useNotificationStore } from '../store/useNotificationStore'
import { useAuthStore } from '../store/useAuthStore'
import { Droplet, Mail, UserCheck, Trash2, ArrowRight, Loader2, Plus } from 'lucide-react'

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
    { label: 'Operator', value: 'Operator' },
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
      navigate('/company/dashboard')
      return
    }

    setSending(true)
    try {
      for (const invitee of invitees) {
        await onboardingService.inviteMember(invitee)
      }
      showToast(`Invited ${invitees.length} team member(s) successfully!`, 'success')
      updateUser({ isTenantInitialized: true })
      navigate('/company/dashboard')
    } catch (error: any) {
      showToast('Failed to invite one or more team members.', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="w-full flex justify-center items-center font-sans">
      
      {/* FRESH WHITE AUTHENTICATION SURFACE CARD */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[440px] bg-white border border-[#E5E7EB] rounded-2xl shadow-xs p-8 sm:p-9 space-y-5 relative"
      >
        
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-1.5 select-none">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shadow-xs">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-[#111827] tracking-tight">
              Invite Your Team
            </h2>
            <p className="text-xs font-medium text-[#6B7280]">
              Add operators, managers, and admins to your workspace
            </p>
          </div>
        </div>

        {/* Form to add team member */}
        <form onSubmit={handleSubmit(onAddInvitee)} className="space-y-3">
          
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#111827] select-none">
              Team Member Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                <Mail className="w-4.5 h-4.5" />
              </div>
              <input
                type="email"
                placeholder="colleague@company.com"
                {...register('email')}
                className={`w-full pl-10 pr-3.5 h-[54px] bg-white border ${
                  errors.email ? 'border-rose-400 focus:ring-rose-500/20' : 'border-[#E5E7EB] focus:ring-2 focus:ring-[#2563EB]/15 focus:border-[#2563EB]'
                } rounded-xl text-xs font-medium text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none transition-all`}
              />
            </div>
            {errors.email?.message && (
              <p className="text-[11px] font-medium text-rose-600 pl-1">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#111827] select-none">
              Assign System Role
            </label>
            <select
              {...register('role')}
              className="w-full px-3.5 h-[54px] bg-white border border-[#E5E7EB] rounded-xl text-xs font-medium text-[#111827] focus:ring-2 focus:ring-[#2563EB]/15 focus:border-[#2563EB] outline-none"
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="submit"
            className="w-full h-11 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E5E7EB] text-[#111827] font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#2563EB]" />
            <span>Add Member to List</span>
          </motion.button>

        </form>

        {/* Invitee List */}
        {invitees.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[#E5E7EB]">
            <span className="text-xs font-bold text-[#111827] block">
              Pending Invites ({invitees.length})
            </span>
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {invitees.map((inv, idx) => (
                <div 
                  key={idx} 
                  className="p-2.5 bg-[#FAFBFC] border border-[#E5E7EB] rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="truncate pr-2">
                    <span className="font-semibold text-[#111827] block truncate">{inv.email}</span>
                    <span className="text-[10px] text-[#6B7280] uppercase tracking-wider">{inv.role}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveInvitee(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Finalize Action */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          type="button"
          onClick={handleSendInvites}
          disabled={sending}
          className="w-full h-[54px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {sending ? (
            <>
              <Loader2 className="w-4.5 h-4.5 animate-spin" />
              <span>Sending Invitations...</span>
            </>
          ) : (
            <>
              <span>{invitees.length > 0 ? 'Send Invitations & Continue' : 'Skip Team Invites & Continue'}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </motion.button>

        {/* Footer info */}
        <div className="pt-2 border-t border-[#E5E7EB] text-center text-xs text-[#6B7280] select-none">
          Proprietary Industrial Resource Planning Environment
        </div>

      </motion.div>

    </div>
  )
}

export default InviteTeamPage
