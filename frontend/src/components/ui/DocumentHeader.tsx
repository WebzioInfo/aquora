import React, { useState, useEffect } from 'react'
import { api } from '../../services/api'
import { useAuthStore } from '../../store/useAuthStore'

export interface DocumentHeaderProps {
  title?: string
  docNumber?: string
  badgeText?: string
  companyName?: string
  address?: string
  className?: string
  titleColor?: string
}

export const DocumentHeader: React.FC<DocumentHeaderProps> = ({
  title,
  docNumber,
  badgeText,
  companyName: propCompanyName,
  address: propAddress,
  className = '',
  titleColor = '#1e293b'
}) => {
  const { user } = useAuthStore()
  const [profile, setProfile] = useState<{ name?: string; address?: string } | null>(null)

  useEffect(() => {
    // Skip API fetch if both companyName and address are supplied via props
    if (propCompanyName && propAddress !== undefined) return

    let isMounted = true
    const fetchCompanyProfile = async () => {
      try {
        const res = await api.get('/api/v1/company/settings')
        if (isMounted && res.data?.success && res.data?.data) {
          setProfile(res.data.data)
        }
      } catch (err) {
        console.error('Failed to load company profile for DocumentHeader:', err)
      }
    }

    fetchCompanyProfile()
    return () => {
      isMounted = false
    }
  }, [propCompanyName, propAddress])

  // Resolve dynamic Company Name & Address from existing tenant data sources
  let resolvedName =
    propCompanyName ||
    profile?.name ||
    user?.companyName ||
    user?.tenantName

  if (
    !resolvedName ||
    resolvedName.trim() === '' ||
    resolvedName.toLowerCase() === 'null' ||
    resolvedName.toLowerCase() === 'undefined'
  ) {
    resolvedName = 'Company'
  }

  const activeCompanyName = resolvedName.trim().toUpperCase()
  const activeAddress = propAddress !== undefined ? propAddress : profile?.address

  // Clean address string, ensuring no "undefined", "null", or empty placeholders
  const cleanAddress =
    activeAddress &&
    activeAddress.trim() !== '' &&
    activeAddress.toLowerCase() !== 'null' &&
    activeAddress.toLowerCase() !== 'undefined'
      ? activeAddress.trim()
      : null

  return (
    <div
      className={`flex justify-between items-start pb-5 mb-5 border-b border-slate-100 gap-4 ${className}`}
      style={{ borderBottom: '1px solid #f1f5f9' }}
    >
      {/* Left Column: Dynamic Company Name & Address ONLY (No Logo) */}
      <div className="text-left flex-1 min-w-0 break-words">
        <h1
          className="text-lg sm:text-xl font-extrabold tracking-tight leading-snug text-slate-900 break-words"
          style={{ color: '#0f172a' }}
        >
          {activeCompanyName}
        </h1>
        {cleanAddress && (
          <p
            className="text-xs font-medium text-slate-600 mt-1 whitespace-pre-line leading-relaxed break-words"
            style={{ color: '#475569' }}
          >
            {cleanAddress}
          </p>
        )}
      </div>

      {/* Right Column: Optional Document Title, Doc Number & Badge */}
      {(title || docNumber || badgeText) && (
        <div className="text-right flex flex-col items-end gap-1.5 shrink-0 min-w-max">
          {badgeText && (
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{ backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #d1fae5' }}
            >
              <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: '#10b981' }}></span>
              {badgeText}
            </span>
          )}
          {title && (
            <div className="mt-1">
              <span
                className="text-[9px] font-bold block uppercase tracking-wider text-slate-400"
                style={{ color: '#94a3b8' }}
              >
                {title}
              </span>
              {docNumber && (
                <span className="font-mono font-bold text-xs" style={{ color: titleColor }}>
                  Ref: {docNumber}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DocumentHeader
