import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/useAuthStore'
import { useNotificationStore } from '../../store/useNotificationStore'
import { userProfileApi, type UserProfile, type UpdateUserProfileRequest, type ChangePasswordRequest } from '../../services/api/userProfile'
import PageContainer from '../../components/ui/layout/PageContainer'
import PageHeader from '../../components/ui/layout/PageHeader'
import BRAND from '../../config/brand'
import { authService } from '../../services/auth'
import {
  User, Shield, KeyRound, Beaker, Building2, CheckCircle2,
  AlertCircle, Eye, EyeOff, Camera, Clock, Smartphone,
  Save, RefreshCw, Sparkles, Award, FileText, Check, Lock,
  Upload, Trash2, Image as ImageIcon, Mail, ArrowRight, X, ShieldCheck
} from 'lucide-react'

type TabType = 'personal' | 'qc' | 'account' | 'security'

export const UserProfilePage: React.FC = () => {
  const { user: authUser, updateUser } = useAuthStore()
  const { showToast } = useNotificationStore()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<TabType>('personal')
  const [showAvatarModal, setShowAvatarModal] = useState(false)
  const [avatarUrlInput, setAvatarUrlInput] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarMode, setAvatarMode] = useState<'upload' | 'url'>('upload')

  // Signature file state
  const [sigFile, setSigFile] = useState<File | null>(null)
  const [sigPreview, setSigPreview] = useState<string | null>(null)

  // Form states for Personal Profile
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [department, setDepartment] = useState('')

  // Form states for QC Profile
  const [qualification, setQualification] = useState('')
  const [certificationDetails, setCertificationDetails] = useState('')
  const [experienceYears, setExperienceYears] = useState<number | ''>('')
  const [assignedLabStation, setAssignedLabStation] = useState('')
  const [qcResponsibilities, setQcResponsibilities] = useState('')
  const [signatureUrl, setSignatureUrl] = useState('')

  // Form states for Password Change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Email verification and change states
  const [showEmailChangeModal, setShowEmailChangeModal] = useState(false)
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [newEmailInput, setNewEmailInput] = useState('')
  const [emailOtp, setEmailOtp] = useState<string[]>(Array(6).fill(''))
  const [emailModalStep, setEmailModalStep] = useState<'email' | 'otp'>('email')
  const [emailModalLoading, setEmailModalLoading] = useState(false)
  const [emailModalError, setEmailModalError] = useState<string | null>(null)
  const [emailCooldown, setEmailCooldown] = useState(0)

  useEffect(() => {
    if (emailCooldown <= 0) return
    const timer = setInterval(() => {
      setEmailCooldown((prev) => (prev > 1 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [emailCooldown])

  // Query Profile Data
  const { data: profile, isLoading, isError, refetch } = useQuery<UserProfile>({
    queryKey: ['userProfile'],
    queryFn: userProfileApi.getMyProfile,
    staleTime: 60000,
    refetchOnWindowFocus: false
  })

  // Query Security Summary
  const { data: securitySummary, isLoading: securityLoading } = useQuery({
    queryKey: ['userSecuritySummary'],
    queryFn: userProfileApi.getSecuritySummary,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    enabled: activeTab === 'security'
  })

  // Populate form fields on data load
  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName || '')
      setLastName(profile.lastName || '')
      setUsername(profile.username || '')
      setPhone(profile.phone || '')
      setDepartment(profile.department || '')

      setQualification(profile.qualification || '')
      setCertificationDetails(profile.certificationDetails || '')
      setExperienceYears(profile.experienceYears ?? '')
      setAssignedLabStation(profile.assignedLabStation || '')
      setQcResponsibilities(profile.qcResponsibilities || '')
      setSignatureUrl(profile.signatureUrl || '')
      setAvatarUrlInput(profile.photoUrl || '')
    }
  }, [profile])

  // Profile Update Mutation
  const updateProfileMutation = useMutation({
    mutationFn: (payload: UpdateUserProfileRequest) => userProfileApi.updateMyProfile(payload),
    onSuccess: (updatedData) => {
      queryClient.setQueryData(['userProfile'], updatedData)
      // Sync with global auth state so header and dropdowns update immediately
      updateUser({
        firstName: updatedData.firstName || '',
        lastName: updatedData.lastName || '',
        username: updatedData.username,
        fullName: updatedData.displayName
      })
      showToast('Profile details updated successfully.', 'success')
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to update profile.'
      showToast(msg, 'error')
    }
  })

  // Change Password Mutation
  const changePasswordMutation = useMutation({
    mutationFn: (payload: ChangePasswordRequest) => userProfileApi.changePassword(payload),
    onSuccess: () => {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordError(null)
      queryClient.invalidateQueries({ queryKey: ['userSecuritySummary'] })
      showToast('Password changed successfully.', 'success')
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to change password.'
      setPasswordError(msg)
      showToast(msg, 'error')
    }
  })

  // Avatar Mutations
  const avatarMutation = useMutation({
    mutationFn: (photoUrl: string | null) => userProfileApi.updateAvatar(photoUrl),
    onSuccess: (updatedData) => {
      queryClient.setQueryData(['userProfile'], updatedData)
      setShowAvatarModal(false)
      showToast('Profile avatar updated.', 'success')
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to update avatar.'
      showToast(msg, 'error')
    }
  })

  const uploadAvatarFileMutation = useMutation({
    mutationFn: (file: File) => userProfileApi.uploadAvatarFile(file),
    onSuccess: (updatedData) => {
      queryClient.setQueryData(['userProfile'], updatedData)
      setShowAvatarModal(false)
      setAvatarFile(null)
      setAvatarPreview(null)
      showToast('Profile photo uploaded to Cloudinary.', 'success')
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to upload photo.'
      showToast(msg, 'error')
    }
  })

  const uploadSignatureMutation = useMutation({
    mutationFn: (file: File) => userProfileApi.uploadSignatureFile(file),
    onSuccess: (updatedData) => {
      queryClient.setQueryData(['userProfile'], updatedData)
      setSignatureUrl(updatedData.signatureUrl || '')
      setSigFile(null)
      setSigPreview(null)
      showToast('QC digital signature uploaded to Cloudinary.', 'success')
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to upload signature.'
      showToast(msg, 'error')
    }
  })

  const removeSignatureMutation = useMutation({
    mutationFn: () => userProfileApi.removeSignature(),
    onSuccess: (updatedData) => {
      queryClient.setQueryData(['userProfile'], updatedData)
      setSignatureUrl('')
      setSigFile(null)
      setSigPreview(null)
      showToast('QC digital signature removed.', 'success')
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to remove signature.'
      showToast(msg, 'error')
    }
  })

  const handleSavePersonal = (e: React.FormEvent) => {
    e.preventDefault()
    updateProfileMutation.mutate({
      firstName,
      lastName,
      username: username.trim() || undefined,
      phone: phone.trim() || undefined,
      department: department.trim() || undefined
    })
  }

  const handleSaveQC = (e: React.FormEvent) => {
    e.preventDefault()
    updateProfileMutation.mutate({
      qualification: qualification.trim() || undefined,
      certificationDetails: certificationDetails.trim() || undefined,
      experienceYears: typeof experienceYears === 'number' ? experienceYears : undefined,
      assignedLabStation: assignedLabStation.trim() || undefined,
      qcResponsibilities: qcResponsibilities.trim() || undefined,
      signatureUrl: signatureUrl.trim() || undefined
    })
  }

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)

    if (!currentPassword) {
      setPasswordError('Please enter your current password.')
      return
    }
    if (!newPassword || newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.')
      return
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordError('Password must contain uppercase, lowercase, and numeric characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }
    if (newPassword === currentPassword) {
      setPasswordError('New password cannot be the same as current password.')
      return
    }

    changePasswordMutation.mutate({
      currentPassword,
      newPassword,
      confirmPassword
    })
  }

  // Password strength check
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-slate-200' }
    let score = 0
    if (pass.length >= 8) score++
    if (/[A-Z]/.test(pass)) score++
    if (/[a-z]/.test(pass)) score++
    if (/[0-9]/.test(pass)) score++
    if (/[^A-Za-z0-9]/.test(pass)) score++

    if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' }
    if (score <= 4) return { score, label: 'Moderate', color: 'bg-amber-500' }
    return { score, label: 'Strong', color: 'bg-emerald-500' }
  }

  const passwordStrength = getPasswordStrength(newPassword)

  // Role detection
  const isQCRole = profile?.roles?.some(r => ['QC', 'QualityControl', 'QualityManager', 'Chemist'].includes(r)) ||
                   authUser?.roles?.some(r => ['QC', 'QualityControl', 'QualityManager', 'Chemist'].includes(r))
  const isOwnerOrAdmin = profile?.roles?.some(r => ['Owner', 'CompanyAdmin', 'SuperAdmin', 'PlatformAdmin'].includes(r)) ||
                         authUser?.roles?.some(r => ['Owner', 'CompanyAdmin', 'SuperAdmin', 'PlatformAdmin'].includes(r))

  if (isLoading) {
    return (
      <PageContainer>
        <div className="py-12 flex flex-col items-center justify-center space-y-4">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading your profile details...</p>
        </div>
      </PageContainer>
    )
  }

  if (isError || !profile) {
    return (
      <PageContainer>
        <div className="p-8 max-w-lg mx-auto bg-white rounded-2xl border border-red-200 text-center space-y-4 shadow-sm my-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900">Unable to Load Profile</h3>
          <p className="text-xs text-slate-500">We couldn't retrieve your user profile from the server.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      </PageContainer>
    )
  }

  const initials = `${profile.firstName?.charAt(0) || ''}${profile.lastName?.charAt(0) || ''}`.toUpperCase() || 'U'

  return (
    <PageContainer>
      <PageHeader
        title="My Profile & Account"
        description="Manage your personal information, security credentials, and role configuration."
      />

      {/* Main Profile Header Hero Banner */}
      <div className="mt-6 bg-white rounded-2xl border border-[#E5E9F2] shadow-xs overflow-hidden relative">
        <div className="h-28 bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-600 relative">
          <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] opacity-15"></div>
        </div>

        <div className="px-6 pb-6 pt-0 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-12 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            {/* Profile Avatar */}
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-extrabold text-2xl shadow-lg border-4 border-white overflow-hidden bg-cover bg-center">
                {profile.photoUrl ? (
                  <img src={profile.photoUrl} alt={profile.displayName} className="w-full h-full object-cover" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowAvatarModal(true)}
                className="absolute bottom-0 right-0 p-1.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-lg shadow cursor-pointer transition border border-white"
                title="Change Avatar"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Name, Roles, & Tenant Info */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  {profile.displayName}
                </h2>
                {profile.emailVerified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Verified
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
                <span className="font-semibold text-slate-700">@{profile.username || profile.email.split('@')[0]}</span>
                <span>•</span>
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-100">
                  {profile.roleName || profile.roles?.[0] || 'User'}
                </span>
                {profile.companyName && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-slate-600 font-semibold">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      {profile.companyName}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <span className="text-[11px] font-bold text-slate-400">
              Joined {new Date(profile.createdAt).toLocaleDateString([], { month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Profile Layout with Nav Tabs & Main Cards */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Tabs Navigation */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-[#E5E9F2] p-2 shadow-xs space-y-1">
            <button
              onClick={() => setActiveTab('personal')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'personal'
                  ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <User className={`w-4 h-4 ${activeTab === 'personal' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span>Personal Details</span>
            </button>

            {/* QC / Lab Tab */}
            {(isQCRole || isOwnerOrAdmin || profile.qualification || profile.certificationDetails) && (
              <button
                onClick={() => setActiveTab('qc')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'qc'
                    ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Beaker className={`w-4 h-4 ${activeTab === 'qc' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>QC & Lab Profile</span>
                </div>
                {isQCRole && (
                  <span className="px-1.5 py-0.5 rounded bg-blue-100/70 text-blue-800 text-[9px] font-black">
                    QC
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => setActiveTab('account')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'account'
                  ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Building2 className={`w-4 h-4 ${activeTab === 'account' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span>Organization & Role</span>
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'security'
                  ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Shield className={`w-4 h-4 ${activeTab === 'security' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span>Security & Password</span>
            </button>
          </div>

          {/* Quick Info Summary Box */}
          <div className="mt-4 bg-slate-50/70 rounded-2xl border border-slate-200/70 p-4 space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Account Status</span>
            </div>
            <div className="space-y-2 text-[11px] text-slate-600">
              <div className="flex items-center justify-between">
                <span>Account:</span>
                <span className="font-bold text-emerald-600">Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tenant Isolation:</span>
                <span className="font-semibold text-slate-800 font-mono text-[10px]">
                  {profile.tenantSchema || 'Standard'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Last Session:</span>
                <span className="font-medium text-slate-500">
                  {profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Content Panels */}
        <div className="lg:col-span-9 space-y-6">
          {/* TAB 1: PERSONAL DETAILS */}
          {activeTab === 'personal' && (
            <div className="bg-white rounded-2xl border border-[#E5E9F2] shadow-xs p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Personal Information</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Update your personal profile details and contact information.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSavePersonal} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. John"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Doe"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. jdoe"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition font-mono"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Letters, numbers, underscores, and hyphens only.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Phone Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Email Address</label>
                    <input
                      type="email"
                      value={profile.email}
                      disabled
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-xs font-medium cursor-not-allowed"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Primary email is bound to your account authorization.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Department</label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Operations, Quality Assurance"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: QC & LAB PROFILE */}
          {activeTab === 'qc' && (
            <div className="bg-white rounded-2xl border border-[#E5E9F2] shadow-xs p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-900">Quality Control & Laboratory Profile</h3>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-extrabold text-[10px] border border-indigo-200">
                      Authoritative QC Source
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Professional credentials, certifications, and testing station details used in QC Water Test Reports and audits.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveQC} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-blue-600" />
                      Academic Qualification
                    </label>
                    <input
                      type="text"
                      value={qualification}
                      onChange={(e) => setQualification(e.target.value)}
                      placeholder="e.g. M.Sc Analytical Chemistry, B.Tech Food Technology"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      Certifications & Accreditations
                    </label>
                    <input
                      type="text"
                      value={certificationDetails}
                      onChange={(e) => setCertificationDetails(e.target.value)}
                      placeholder="e.g. ISO 17025 Certified Analyst, BIS Quality Assurance Trained"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Years of Experience in Water/Beverage Quality
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                      placeholder="e.g. 5"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Beaker className="w-3.5 h-3.5 text-teal-600" />
                      Assigned Testing Station / Lab
                    </label>
                    <input
                      type="text"
                      value={assignedLabStation}
                      onChange={(e) => setAssignedLabStation(e.target.value)}
                      placeholder="e.g. Main Chemical Lab, Line 1 In-Process Lab"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Primary Quality Responsibilities & Testing Domains
                    </label>
                    <textarea
                      rows={3}
                      value={qcResponsibilities}
                      onChange={(e) => setQcResponsibilities(e.target.value)}
                      placeholder="e.g. Physical parameter testing (pH, TDS, Turbidity), Microbiology incubation, Ozone dosage validation, Daily batch release sign-offs."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span>QC Authorized Digital Signatory Signature</span>
                      {signatureUrl && (
                        <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Signature Active on Cloudinary
                        </span>
                      )}
                    </label>

                    <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-4">
                      {signatureUrl ? (
                        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3.5 rounded-xl border border-slate-200">
                          <div className="w-48 h-20 bg-slate-100/80 rounded-lg p-2 flex items-center justify-center border border-slate-200 overflow-hidden" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '8px 8px' }}>
                            <img
                              src={signatureUrl}
                              alt="QC Signature"
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                          <div className="flex-1 space-y-1 text-center sm:text-left">
                            <p className="text-xs font-bold text-slate-800">Current Digital Signature</p>
                            <p className="text-[11px] text-slate-500">Automatically stamped on PDF Water Quality Reports & QC Certificates.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeSignatureMutation.mutate()}
                            disabled={removeSignatureMutation.isPending}
                            className="px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 transition cursor-pointer flex items-center gap-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                      ) : (
                        <div className="text-center py-3">
                          <p className="text-xs text-slate-500 font-medium">No digital signature uploaded yet.</p>
                        </div>
                      )}

                      {/* Upload New Signature */}
                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        <input
                          type="file"
                          id="sig-file-input"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              if (file.size > 5 * 1024 * 1024) {
                                showToast('Signature file size must be less than 5 MB.', 'error')
                                return
                              }
                              setSigFile(file)
                              setSigPreview(URL.createObjectURL(file))
                            }
                          }}
                        />
                        <label
                          htmlFor="sig-file-input"
                          className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs transition cursor-pointer flex items-center gap-2"
                        >
                          <Upload className="w-4 h-4 text-blue-600" />
                          <span>{sigFile ? 'Change Selected Signature' : 'Select Signature File (PNG/JPG)'}</span>
                        </label>

                        {sigFile && (
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-600 font-semibold truncate max-w-xs">{sigFile.name}</span>
                            <button
                              type="button"
                              onClick={() => uploadSignatureMutation.mutate(sigFile)}
                              disabled={uploadSignatureMutation.isPending}
                              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                            >
                              {uploadSignatureMutation.isPending ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>Uploading to Cloud...</span>
                                </>
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Upload Signature</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save QC Profile</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: ACCOUNT & ORGANIZATION */}
          {activeTab === 'account' && (
            <div className="bg-white rounded-2xl border border-[#E5E9F2] shadow-xs p-6 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-extrabold text-slate-900">Organization & Role Details</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  System-managed organization identity, roles, and enterprise tenant boundaries.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Role</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-extrabold text-slate-900">{profile.roleName || 'Operator'}</span>
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-extrabold">
                      {profile.roles?.[0] || 'User'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Company / Tenant</span>
                  <div className="text-sm font-extrabold text-slate-900 mt-1">
                    {profile.companyName || BRAND.name}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tenant Workspace ID</span>
                  <div className="text-xs font-mono font-bold text-slate-700 mt-1 break-all">
                    {profile.tenantId || 'Platform-Root'}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Production Line Assignment</span>
                  <div className="text-xs font-semibold text-slate-800 mt-1">
                    {profile.assignedProductionLineId ? `Line ID: ${profile.assignedProductionLineId}` : 'Universal / All Lines'}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  Protected Enterprise Metadata
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Roles, organizational ownership, and permission policies are securely administered by company administrators to enforce multi-tenant isolation.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: SECURITY & PASSWORD */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Email & Verification Card */}
              <div className="bg-white rounded-2xl border border-[#E5E9F2] shadow-xs p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Email & Account Verification</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Your registered account email used for communications, security alerts, and system notifications.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {profile.emailVerified ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Email Verified</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Unverified Email</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Work Email</span>
                    <div className="text-sm font-extrabold text-slate-900 font-mono flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-600" />
                      <span>{profile.email}</span>
                    </div>
                    {profile.emailVerifiedAt && (
                      <p className="text-[11px] text-slate-400">
                        Verified on {new Date(profile.emailVerifiedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {!profile.emailVerified && (
                      <button
                        type="button"
                        onClick={async () => {
                          setShowVerifyModal(true)
                          setEmailOtp(Array(6).fill(''))
                          setEmailModalError(null)
                          try {
                            await authService.sendOtp(profile.email, 'EmailVerification')
                            setEmailCooldown(60)
                            showToast('Verification code dispatched to your email.', 'success')
                          } catch (err: any) {
                            showToast(err.response?.data?.message || 'Failed to dispatch code.', 'error')
                          }
                        }}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                      >
                        Verify Email Now
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowEmailChangeModal(true)
                        setNewEmailInput('')
                        setEmailOtp(Array(6).fill(''))
                        setEmailModalStep('email')
                        setEmailModalError(null)
                      }}
                      className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
                    >
                      Change Email Address
                    </button>
                  </div>
                </div>
              </div>

              {/* Change Password Card */}
              <div className="bg-white rounded-2xl border border-[#E5E9F2] shadow-xs p-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Change Password</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ensure your account is using a secure password with a minimum of 8 characters.
                    </p>
                  </div>
                </div>

                {passwordError && (
                  <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{passwordError}</span>
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Current Password</label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">New Password</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Password strength meter */}
                    {newPassword && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span className="text-slate-500">Strength:</span>
                          <span className={`${
                            passwordStrength.label === 'Strong' ? 'text-emerald-600' :
                            passwordStrength.label === 'Moderate' ? 'text-amber-600' : 'text-red-500'
                          }`}>
                            {passwordStrength.label}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex gap-1">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <div
                              key={level}
                              className={`h-full flex-1 rounded-full transition-all duration-300 ${
                                level <= passwordStrength.score ? passwordStrength.color : 'bg-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-3">
                    <button
                      type="submit"
                      disabled={changePasswordMutation.isPending}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {changePasswordMutation.isPending ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Updating Password...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Update Password</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Security Activity & Audit Events */}
              <div className="bg-white rounded-2xl border border-[#E5E9F2] shadow-xs p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Security & Activity Log</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Recent security events and authenticated audit entries for your account.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    <Smartphone className="w-4 h-4 text-blue-600" />
                    <span>{securitySummary?.devicesCount || 1} Active Device(s)</span>
                  </div>
                </div>

                {securityLoading ? (
                  <div className="py-6 text-center text-xs text-slate-400">Loading audit events...</div>
                ) : securitySummary?.recentAuditEvents && securitySummary.recentAuditEvents.length > 0 ? (
                  <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                    {securitySummary.recentAuditEvents.map((evt, idx) => (
                      <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                          <span className="font-bold text-slate-800">{evt.action}</span>
                          {evt.reason && <span className="text-slate-500 text-[11px]">— {evt.reason}</span>}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {new Date(evt.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400 italic">
                    No recent security alerts recorded.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Avatar Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E5E9F2] shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">Update Profile Avatar</h3>
              <div className="flex bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setAvatarMode('upload')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    avatarMode === 'upload' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setAvatarMode('url')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    avatarMode === 'url' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Image URL
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              {avatarMode === 'upload'
                ? 'Upload a high-resolution photo directly to Cloudinary cloud media storage.'
                : 'Provide a direct public image URL for your profile avatar.'}
            </p>

            {avatarMode === 'upload' ? (
              <div className="space-y-4">
                <div
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer ${
                    avatarPreview ? 'border-blue-500 bg-blue-50/20' : 'border-slate-200 hover:border-blue-400 bg-slate-50/50'
                  }`}
                  onClick={() => document.getElementById('avatar-file-modal-input')?.click()}
                >
                  <input
                    type="file"
                    id="avatar-file-modal-input"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                          showToast('Image file size must be less than 5 MB.', 'error')
                          return
                        }
                        setAvatarFile(file)
                        setAvatarPreview(URL.createObjectURL(file))
                      }
                    }}
                  />

                  {avatarPreview ? (
                    <div className="flex flex-col items-center gap-3">
                      <img
                        src={avatarPreview}
                        alt="Avatar Preview"
                        className="w-24 h-24 rounded-full object-cover border-2 border-blue-500 shadow-md"
                      />
                      <div className="text-center">
                        <p className="text-xs font-bold text-slate-800 truncate max-w-xs">{avatarFile?.name}</p>
                        <p className="text-[10px] text-slate-400">Click to choose a different photo</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                        <Camera className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-slate-700">Click to browse or drag & drop</p>
                      <p className="text-[10px] text-slate-400">PNG, JPG, WebP up to 5 MB</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Image URL</label>
                  <input
                    type="url"
                    value={avatarUrlInput}
                    onChange={(e) => setAvatarUrlInput(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                  />
                </div>

                {avatarUrlInput && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <img
                      src={avatarUrlInput}
                      alt="Preview"
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                      onError={(e) => { (e.target as any).src = '' }}
                    />
                    <span className="text-xs font-semibold text-slate-600">Avatar Preview</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => avatarMutation.mutate(null)}
                disabled={avatarMutation.isPending}
                className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
              >
                Remove Photo
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAvatarModal(false)
                    setAvatarFile(null)
                    setAvatarPreview(null)
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>

                {avatarMode === 'upload' ? (
                  <button
                    type="button"
                    disabled={!avatarFile || uploadAvatarFileMutation.isPending}
                    onClick={() => {
                      if (avatarFile) uploadAvatarFileMutation.mutate(avatarFile)
                    }}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {uploadAvatarFileMutation.isPending ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload to Cloud</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => avatarMutation.mutate(avatarUrlInput.trim() || null)}
                    disabled={avatarMutation.isPending}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition cursor-pointer disabled:opacity-50"
                  >
                    {avatarMutation.isPending ? 'Saving...' : 'Apply Photo'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EMAIL CHANGE MODAL */}
      {showEmailChangeModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E5E9F2] shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {emailModalStep === 'email' ? 'Change Account Email' : 'Verify New Email'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {emailModalStep === 'email' ? 'Enter the new email address for your account.' : `Code sent to ${newEmailInput}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEmailChangeModal(false)
                  setNewEmailInput('')
                  setEmailOtp(Array(6).fill(''))
                  setEmailModalError(null)
                }}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {emailModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{emailModalError}</span>
              </div>
            )}

            {emailModalStep === 'email' ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!newEmailInput.trim() || emailModalLoading) return
                  setEmailModalLoading(true)
                  setEmailModalError(null)
                  try {
                    await authService.requestEmailChange(newEmailInput.trim())
                    setEmailModalStep('otp')
                    setEmailCooldown(60)
                    showToast('Verification code dispatched to your new email.', 'success')
                  } catch (err: any) {
                    setEmailModalError(err.response?.data?.message || err.message || 'Failed to dispatch verification code.')
                  } finally {
                    setEmailModalLoading(false)
                  }
                }}
                className="space-y-4 pt-1"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">New Email Address</label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={newEmailInput}
                    onChange={(e) => setNewEmailInput(e.target.value)}
                    placeholder="new.email@company.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowEmailChangeModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={emailModalLoading || !newEmailInput.trim()}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {emailModalLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending Code...</span>
                      </>
                    ) : (
                      <>
                        <span>Continue</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  const code = emailOtp.join('')
                  if (code.length < 6 || emailModalLoading) return
                  setEmailModalLoading(true)
                  setEmailModalError(null)
                  try {
                    await authService.verifyEmailChange(newEmailInput.trim(), code)
                    showToast('Account email changed and verified successfully!', 'success')
                    setShowEmailChangeModal(false)
                    queryClient.invalidateQueries({ queryKey: ['userProfile'] })
                    updateUser({ email: newEmailInput.trim(), emailVerified: true })
                  } catch (err: any) {
                    setEmailModalError(err.response?.data?.message || err.message || 'Invalid or expired verification code.')
                  } finally {
                    setEmailModalLoading(false)
                  }
                }}
                className="space-y-4 pt-1"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">6-Digit Verification PIN</label>
                  <div className="flex justify-between gap-1.5">
                    {emailOtp.map((digit, idx) => (
                      <input
                        key={idx}
                        type="text"
                        maxLength={1}
                        value={digit}
                        autoFocus={idx === 0}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '')
                          const next = [...emailOtp]
                          next[idx] = val ? val[val.length - 1] : ''
                          setEmailOtp(next)
                          if (val && idx < 5) {
                            const inputs = document.querySelectorAll<HTMLInputElement>('.email-otp-input')
                            inputs[idx + 1]?.focus()
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace' && !emailOtp[idx] && idx > 0) {
                            const inputs = document.querySelectorAll<HTMLInputElement>('.email-otp-input')
                            inputs[idx - 1]?.focus()
                          }
                        }}
                        className="email-otp-input w-10 h-11 text-center font-bold text-base bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => setEmailModalStep('email')}
                    className="text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                  >
                    Edit Email
                  </button>
                  {emailCooldown > 0 ? (
                    <span className="text-slate-400">Resend in {emailCooldown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        setEmailCooldown(60)
                        try {
                          await authService.requestEmailChange(newEmailInput.trim())
                          showToast('Fresh verification PIN sent.', 'success')
                        } catch (err: any) {
                          showToast('Failed to resend code.', 'error')
                        }
                      }}
                      className="text-blue-600 hover:text-blue-700 font-bold cursor-pointer"
                    >
                      Resend PIN
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowEmailChangeModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={emailModalLoading || emailOtp.join('').length < 6}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition cursor-pointer disabled:opacity-50"
                  >
                    {emailModalLoading ? 'Verifying...' : 'Verify & Update Email'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* VERIFY CURRENT EMAIL MODAL */}
      {showVerifyModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E5E9F2] shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Verify Account Email</h3>
                  <p className="text-[11px] text-slate-500">Enter code sent to {profile.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowVerifyModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {emailModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{emailModalError}</span>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const code = emailOtp.join('')
                if (code.length < 6 || emailModalLoading) return
                setEmailModalLoading(true)
                setEmailModalError(null)
                try {
                  await authService.verifyOtp({ email: profile.email, code, purpose: 'EmailVerification' })
                  showToast('Email address successfully verified!', 'success')
                  setShowVerifyModal(false)
                  queryClient.invalidateQueries({ queryKey: ['userProfile'] })
                  updateUser({ emailVerified: true })
                } catch (err: any) {
                  setEmailModalError(err.response?.data?.message || err.message || 'Invalid verification PIN.')
                } finally {
                  setEmailModalLoading(false)
                }
              }}
              className="space-y-4 pt-1"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">6-Digit Verification PIN</label>
                <div className="flex justify-between gap-1.5">
                  {emailOtp.map((digit, idx) => (
                    <input
                      key={idx}
                      type="text"
                      maxLength={1}
                      value={digit}
                      autoFocus={idx === 0}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '')
                        const next = [...emailOtp]
                        next[idx] = val ? val[val.length - 1] : ''
                        setEmailOtp(next)
                        if (val && idx < 5) {
                          const inputs = document.querySelectorAll<HTMLInputElement>('.verify-otp-input')
                          inputs[idx + 1]?.focus()
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !emailOtp[idx] && idx > 0) {
                          const inputs = document.querySelectorAll<HTMLInputElement>('.verify-otp-input')
                          inputs[idx - 1]?.focus()
                        }
                      }}
                      className="verify-otp-input w-10 h-11 text-center font-bold text-base bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end text-xs">
                {emailCooldown > 0 ? (
                  <span className="text-slate-400">Resend in {emailCooldown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      setEmailCooldown(60)
                      try {
                        await authService.sendOtp(profile.email, 'EmailVerification')
                        showToast('Fresh verification PIN sent.', 'success')
                      } catch (err: any) {
                        showToast('Failed to resend code.', 'error')
                      }
                    }}
                    className="text-blue-600 hover:text-blue-700 font-bold cursor-pointer"
                  >
                    Resend PIN
                  </button>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowVerifyModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={emailModalLoading || emailOtp.join('').length < 6}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
                >
                  {emailModalLoading ? 'Verifying...' : 'Confirm Verification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  )
}

export default UserProfilePage
