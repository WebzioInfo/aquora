import PageContainer from '../../components/ui/layout/PageContainer';
import PageHeader from '../../components/ui/layout/PageHeader';
import Breadcrumb from '../../components/ui/layout/Breadcrumb';
import KPICard from '../../components/ui/layout/KPICard';
import FilterBar from '../../components/ui/layout/FilterBar';
import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import { useNotificationStore } from '../../store/useNotificationStore'
import { useAuthStore } from '../../store/useAuthStore'
import { Loader2, Package, Tag, Layers, Check, Database } from 'lucide-react'

interface Product {
  id: string
  name: string
  sku: string
  barcode: string
  isActive: boolean
  category: string
  displayOrder: number
  bottleSize?: string
  imageUrl?: string
}

export const ProductSelectionPage: React.FC = () => {
  const { updateProduct } = useOutletContext<any>()
  const { showToast } = useNotificationStore()
  const navigate = useNavigate()
  
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Fetch all active products
  const { data: products = [], isLoading, error } = useQuery<Product[]>({
    queryKey: ['operatorProductsList'],
    queryFn: async () => {
      const res = await api.get('/api/v1/production-entries/skus')
      return res.data?.data || []
    },
    // Refresh on login/mount
    staleTime: 0
  })

  const handleSelectProduct = (product: Product) => {
    setSelectedId(product.id)
    updateProduct(product)
    
    showToast(`Product selected: ${product.name}`, 'info')
    
    // Redirect logic based on category
    if (product.category?.toLowerCase() === '20l jar') {
      navigate('/operator/jar')
    } else {
      navigate('/operator/production-allocation')
    }
  }

  // Get a category specific color scheme for the card
  const getCategoryTheme = (category?: string, name?: string) => {
    const cat = category?.toLowerCase() || ''
    const pName = name?.toLowerCase() || ''
    if (cat === '20l jar' || pName.includes('jar')) {
      return {
        cardClass: 'hover:bg-[#FFF4E8] hover:scale-[1.02] border-[#F6C38B]',
        accent: 'text-[#E9A03B] bg-[#FFF4E8] border border-[#F6C38B]/50',
        gradient: 'from-[#F4A261] to-[#E9A03B]',
        color: '#E9A03B',
        isJar: true
      }
    } else {
      // Bottle products (default / fallback)
      return {
        cardClass: 'hover:scale-[1.02]',
        accent: 'text-[#10B981] bg-[#E6FDF5] border border-[#A7F3D0]',
        gradient: 'from-[#14C8A8] to-[#10B981]',
        color: '#10B981',
        isJar: false
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 bg-[#F3F4F6] text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-[#1A56DB] mb-3" />
        <span className="text-xs font-bold uppercase tracking-wider">Loading available products...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 bg-[#F3F4F6] p-4 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
          <Database className="w-6 h-6" />
        </div>
        <h2 className="text-md font-bold text-slate-800 uppercase tracking-wide">Failed to Load Products</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-[320px]">
          There was an error communicating with the tenant database. Please check your network connection and reload.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto select-none p-4 bg-[#F3F4F6]">
      <div className="w-full max-w-[1280px] mx-auto space-y-6">
        
        {/* Header Block */}
        <div className="text-center md:text-left space-y-1.5 animate-in fade-in duration-200">
          <h1 className="text-2xl font-black text-[#111827] uppercase tracking-tight">Product Selection</h1>
          <p className="text-xs text-[#6B7280] font-semibold">
            Select the product model for the current shift to initialize the appropriate execution module.
          </p>
        </div>

        {/* Product Grid */}
        {products.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-12 text-center text-slate-400 font-bold text-xs uppercase shadow-[0_4px_12px_rgba(0,0,0,0.01)]">
            <Package className="w-12 h-12 mx-auto mb-3 text-slate-300 opacity-60" />
            <span>No active products configured for this tenant.</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {products.map((p) => {
              const theme = getCategoryTheme(p.category, p.name)
              const isSelected = selectedId === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelectProduct(p)}
                  className={`group relative bg-white border border-[#E5E7EB] rounded-[12px] p-3 text-left flex flex-col justify-between hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden aspect-square ${
                    isSelected ? 'ring-2 ring-offset-2' : ''
                  } ${theme.cardClass}`}
                  style={{
                    boxShadow: isSelected ? `0 0 0 2px ${theme.color}` : undefined
                  }}
                >
                  {/* Category Border Highlight */}
                  <div 
                    className="absolute top-0 left-0 w-full h-[3px] transition-all duration-200 group-hover:h-[4px]"
                    style={{ backgroundColor: theme.color }}
                  ></div>

                  {/* JAR OPERATIONS BADGE */}
                  {theme.isJar && (
                    <div className="absolute top-2 right-2 z-10 select-none animate-in fade-in">
                      <span className="text-[7px] font-black uppercase bg-[#E9A03B] text-white px-1.5 py-0.5 rounded-[4px] shadow-sm tracking-wider">
                        Jar Operations
                      </span>
                    </div>
                  )}

                  {/* Image/Gradient Block (Placeholder) */}
                  <div className={`w-full h-[55%] rounded-[8px] bg-gradient-to-br ${theme.gradient} flex items-center justify-center relative overflow-hidden shrink-0 shadow-inner`}>
                    {p.imageUrl ? (
                      <img 
                        src={p.imageUrl} 
                        alt={p.name} 
                        loading="lazy" 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <Package className="w-8 h-8 text-white opacity-85 group-hover:scale-110 transition-transform duration-300" />
                    )}
                    
                    {/* Floating category badge */}
                    <span 
                      className={`absolute bottom-2 right-2 px-2 py-0.5 rounded-[4px] text-[8px] font-extrabold tracking-wider uppercase shadow-sm select-none ${theme.accent}`}
                    >
                      {p.category || 'Product'}
                    </span>
                  </div>

                  {/* Body Content */}
                  <div className="mt-3 flex-1 flex flex-col justify-between min-w-0">
                    <div className="min-w-0">
                      {/* Name */}
                      <span className="font-extrabold text-slate-800 text-[11px] block truncate tracking-tight uppercase" title={p.name}>
                        {p.name}
                      </span>
                      
                      {/* SKU */}
                      <div className="flex items-center gap-1 text-[9px] text-slate-400 font-semibold mt-1">
                        <Tag className="w-3 h-3 text-slate-300 shrink-0" />
                        <span className="truncate">SKU: <strong className="font-mono text-slate-600">{p.sku || p.barcode || 'N/A'}</strong></span>
                      </div>

                      {/* Size */}
                      {p.bottleSize && (
                        <div className="flex items-center gap-1 text-[9px] text-slate-400 font-semibold mt-0.5">
                          <Layers className="w-3 h-3 text-slate-300 shrink-0" />
                          <span>Size: <strong className="text-slate-600">{p.bottleSize}</strong></span>
                        </div>
                      )}
                    </div>

                    {/* Footer Details */}
                    <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-slate-100 select-none shrink-0">
                      {/* Active Status Badge */}
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse"></span>
                        <span className="text-[8px] font-bold text-[#16A34A] uppercase tracking-wider">Active</span>
                      </div>
                      
                      {/* Selected check */}
                      {isSelected && (
                        <div 
                          className="w-4 h-4 rounded-full flex items-center justify-center text-white"
                          style={{ backgroundColor: theme.color }}
                        >
                          <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default ProductSelectionPage
