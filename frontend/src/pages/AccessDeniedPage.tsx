import React from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { ShieldAlert, Clock, LockKeyhole, KeyRound, ArrowLeft, Home } from 'lucide-react'
import EnterpriseButton from '../components/ui/EnterpriseButton'

export const AccessDeniedPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, clearAuth } = useAuthStore()

  // Get the security violation reason from the query param
  const reason = searchParams.get('reason') || 'denied'

  const handleAction = () => {
    if (reason === 'expired') {
      clearAuth()
      navigate('/login', { replace: true })
      return
    }

    if (!user) {
      navigate('/login', { replace: true })
      return
    }

    const roles = user.roles || []
    if (roles.includes('SuperAdmin') || roles.includes('PlatformAdmin')) {
      navigate('/platform/dashboard', { replace: true })
    } else if (roles.includes('Operator')) {
      navigate('/operator', { replace: true })
    } else {
      navigate('/company/dashboard', { replace: true })
    }
  }

  // Define screen settings based on reason
  const getScreenConfig = () => {
    switch (reason) {
      case 'unauthorized':
        return {
          icon: <KeyRound className="w-8 h-8 text-amber-400" />,
          bgColor: 'bg-amber-500/10 border-amber-500/25',
          title: 'Unauthorized Action',
          description: 'Your current credentials do not possess the clearance level required to execute this action. Please re-authenticate or contact your division lead.',
          buttonText: 'Return to Safety',
        }
      case 'expired':
        return {
          icon: <Clock className="w-8 h-8 text-blue-400" />,
          bgColor: 'bg-blue-500/10 border-blue-500/25',
          title: 'Session Terminated',
          description: 'Your authenticated session token has expired due to inactivity. Access tokens are rotated automatically to secure telemetry interfaces.',
          buttonText: 'Sign In Again',
        }
      case 'locked':
        return {
          icon: <LockKeyhole className="w-8 h-8 text-red-400 animate-bounce" />,
          bgColor: 'bg-red-500/10 border-red-500/25',
          title: 'Account Locked',
          description: 'This operator profile has been locked due to repeated authentication failures. Please contact system administrators to restore clearance.',
          buttonText: 'Contact IT Support',
        }
      case 'denied':
      default:
        return {
          icon: <ShieldAlert className="w-8 h-8 text-rose-500" />,
          bgColor: 'bg-rose-500/10 border-rose-500/25',
          title: 'Security Clearance Error',
          description: 'Your user profile does not possess the clearance permissions required to access this system module. Clearance level violation logged.',
          buttonText: 'Return to Terminal',
        }
    }
  }

  const config = getScreenConfig()

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-[#111827] flex items-center justify-center px-4 font-sans relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-500/5 blur-[120px] rounded-full" />
      </div>

      {/* Main Panel */}
      <div className="w-full max-w-[440px] bg-white border border-[#E5E7EB] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-8 md:p-10 text-center flex flex-col items-center gap-6 z-10 animate-fade-in">
        {/* Animated icon holder */}
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border shadow-sm ${config.bgColor}`}>
          {config.icon}
        </div>

        {/* Text */}
        <div className="space-y-2 select-none">
          <h1 className="text-xl font-bold text-[#111827] tracking-tight uppercase">{config.title}</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            {config.description}
          </p>
        </div>

        {/* Action Button */}
        <EnterpriseButton
          onClick={handleAction}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 border-none shadow-sm"
        >
          {reason === 'expired' ? <KeyRound className="w-4 h-4 mr-2 inline" /> : <Home className="w-4 h-4 mr-2 inline" />}
          <span>{config.buttonText}</span>
        </EnterpriseButton>

        {/* Direct Navigation Actions */}
        <div className="flex justify-center items-center gap-4 text-xs font-bold text-slate-500 mt-2 select-none border-t border-[#E5E7EB] pt-4 w-full">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 hover:text-slate-800 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go Back</span>
          </button>
          <span className="text-slate-200">|</span>
          <Link
            to="/login"
            className="hover:text-slate-800 transition-colors"
          >
            Sign In Portal
          </Link>
        </div>
      </div>
    </div>
  )
}

export default AccessDeniedPage
