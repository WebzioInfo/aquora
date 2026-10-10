import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { simpleAccountsService } from '../../../services/simpleAccounts'
import type {
  Owner,
  CreateOwnerRequest,
  UpdateOwnerRequest,
  CreateOwnerTransactionRequest,
  BankAccountDropdown,
  CashBookDropdown
} from '../../../services/simpleAccounts'
import { useNotificationStore } from '../../../store/useNotificationStore'
import { useViewportSize } from '../../../hooks/useViewportSize'

// Shared UI components
import FitScreenPage from '../../../components/ui/FitScreenPage'
import PageHeader from '../../../components/ui/PageHeader'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'

// Owners sub-components
import { calculateOwnersMetrics } from './owners/ownerHelpers'
import OwnerKpiCards from './owners/OwnerKpiCards'
import OwnershipSplitCard from './owners/OwnershipSplitCard'
import OwnerFilters from './owners/OwnerFilters'
import OwnersTable from './owners/OwnersTable'
import OwnerTransactionModal from './owners/OwnerTransactionModal'
import OwnerDetailDrawer from './owners/OwnerDetailDrawer'
import OwnerFormModal from './owners/OwnerFormModal'

export const OwnerListPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { showToast } = useNotificationStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isShortScreen, isCollapseBreakdown, isScrollKpi } = useViewportSize()

  // 1. URL State Initialization
  const initialSearch = searchParams.get('search') ?? ''
  const initialPage = parseInt(searchParams.get('page') || '1', 10)
  const initialLimit = parseInt(
    searchParams.get('limit') || localStorage.getItem('aquora_owners_page_size') || '10',
    10
  )

  const [searchTerm, setSearchTerm] = useState<string>(initialSearch)
  const [pageNumber, setPageNumber] = useState<number>(initialPage)
  const [pageSize, setPageSize] = useState<number>(initialLimit)

  // Interactive Hover & Modal States
  const [hoveredOwnerId, setHoveredOwnerId] = useState<string | null>(null)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [ownerToEdit, setOwnerToEdit] = useState<Owner | null>(null)

  const [isTxModalOpen, setIsTxModalOpen] = useState(false)
  const [selectedOwnerForTx, setSelectedOwnerForTx] = useState<Owner | null>(null)

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerOwner, setDrawerOwner] = useState<Owner | null>(null)

  // Sync state to URL Query Params
  useEffect(() => {
    const params = new URLSearchParams()
    if (searchTerm) params.set('search', searchTerm)
    if (pageNumber > 1) params.set('page', String(pageNumber))
    if (pageSize !== 10) params.set('limit', String(pageSize))

    setSearchParams(params, { replace: true })
  }, [searchTerm, pageNumber, pageSize, setSearchParams])

  // 2. Data Queries
  const { data: owners = [], isLoading } = useQuery<Owner[]>({
    queryKey: ['ownersList'],
    queryFn: () => simpleAccountsService.getOwners()
  })

  const { data: bankAccounts = [] } = useQuery<BankAccountDropdown[]>({
    queryKey: ['bankAccountDropdownList'],
    queryFn: () => simpleAccountsService.getBankAccountDropdown()
  })

  const { data: cashBooks = [] } = useQuery<CashBookDropdown[]>({
    queryKey: ['cashBookDropdownList'],
    queryFn: () => simpleAccountsService.getCashBookDropdown()
  })

  // 3. Filtered & Paged Data
  const filteredOwners = useMemo(() => {
    if (!searchTerm.trim()) return owners
    const q = searchTerm.toLowerCase().trim()
    return owners.filter(o => {
      const matchName = o.name?.toLowerCase().includes(q)
      const matchPhone = o.phone?.toLowerCase().includes(q)
      const matchEmail = o.email?.toLowerCase().includes(q)
      return matchName || matchPhone || matchEmail
    })
  }, [owners, searchTerm])

  const totalFilteredCount = filteredOwners.length
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / pageSize))

  // Clamp out-of-range pageNumber
  useEffect(() => {
    if (pageNumber > totalPages) {
      setPageNumber(totalPages)
    }
  }, [pageNumber, totalPages])

  const pagedOwners = useMemo(() => {
    const start = (pageNumber - 1) * pageSize
    return filteredOwners.slice(start, start + pageSize)
  }, [filteredOwners, pageNumber, pageSize])

  // Summary Metrics: Always reflects ALL owners
  const allOwnersMetrics = useMemo(() => {
    return calculateOwnersMetrics(owners)
  }, [owners])

  // Filtered totals for footer
  const filteredMetrics = useMemo(() => {
    return calculateOwnersMetrics(filteredOwners)
  }, [filteredOwners])

  // Keep drawer owner in sync when data updates
  useEffect(() => {
    if (drawerOwner) {
      const updated = owners.find(o => o.id === drawerOwner.id)
      if (updated) {
        setDrawerOwner(updated)
      }
    }
  }, [owners, drawerOwner])

  // 4. Mutations
  const createOwnerMutation = useMutation({
    mutationFn: (req: CreateOwnerRequest) => simpleAccountsService.createOwner(req),
    onSuccess: () => {
      showToast('Owner added successfully.', 'success')
      queryClient.invalidateQueries({ queryKey: ['ownersList'] })
      queryClient.invalidateQueries({ queryKey: ['companyTotalInvestment'] })
      queryClient.invalidateQueries({ queryKey: ['simpleAccountsDashboardSummary'] })
      queryClient.invalidateQueries({ queryKey: ['cashBookDropdownList'] })
      queryClient.invalidateQueries({ queryKey: ['cashBooksList'] })
      queryClient.invalidateQueries({ queryKey: ['bankAccountDropdownList'] })
      queryClient.invalidateQueries({ queryKey: ['bankAccountsList'] })
      queryClient.invalidateQueries({ queryKey: ['unifiedLedger'] })
      queryClient.invalidateQueries({ queryKey: ['unifiedLedgerSummary'] })
      setIsFormModalOpen(false)
      setOwnerToEdit(null)
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || err.message || 'Failed to add owner.', 'error')
    }
  })

  const updateOwnerMutation = useMutation({
    mutationFn: ({ id, req }: { id: string; req: UpdateOwnerRequest }) =>
      simpleAccountsService.updateOwner(id, req),
    onSuccess: () => {
      showToast('Owner updated successfully.', 'success')
      queryClient.invalidateQueries({ queryKey: ['ownersList'] })
      queryClient.invalidateQueries({ queryKey: ['companyTotalInvestment'] })
      setIsFormModalOpen(false)
      setOwnerToEdit(null)
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || err.message || 'Failed to update owner.', 'error')
    }
  })

  const deleteOwnerMutation = useMutation({
    mutationFn: (id: string) => simpleAccountsService.deleteOwner(id),
    onSuccess: () => {
      showToast('Owner removed successfully.', 'info')
      queryClient.invalidateQueries({ queryKey: ['ownersList'] })
      queryClient.invalidateQueries({ queryKey: ['companyTotalInvestment'] })
      queryClient.invalidateQueries({ queryKey: ['simpleAccountsDashboardSummary'] })
      setIsDrawerOpen(false)
      setDrawerOwner(null)
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || err.message || 'Failed to delete owner.', 'error')
    }
  })

  const txMutation = useMutation({
    mutationFn: ({
      ownerId,
      req
    }: {
      ownerId: string
      req: CreateOwnerTransactionRequest
    }) => simpleAccountsService.addOwnerTransaction(ownerId, req),
    onSuccess: () => {
      showToast('Transaction recorded successfully.', 'success')
      queryClient.invalidateQueries({ queryKey: ['ownersList'] })
      queryClient.invalidateQueries({ queryKey: ['companyTotalInvestment'] })
      queryClient.invalidateQueries({ queryKey: ['simpleAccountsDashboardSummary'] })
      queryClient.invalidateQueries({ queryKey: ['cashBookDropdownList'] })
      queryClient.invalidateQueries({ queryKey: ['cashBooksList'] })
      queryClient.invalidateQueries({ queryKey: ['bankAccountDropdownList'] })
      queryClient.invalidateQueries({ queryKey: ['bankAccountsList'] })
      queryClient.invalidateQueries({ queryKey: ['unifiedLedger'] })
      queryClient.invalidateQueries({ queryKey: ['unifiedLedgerSummary'] })
      queryClient.invalidateQueries({ queryKey: ['assetSummary'] })
      setIsTxModalOpen(false)
      setSelectedOwnerForTx(null)
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || err.message || 'Failed to record transaction.', 'error')
    }
  })

  // Handlers
  const handleOpenCreate = useCallback(() => {
    setOwnerToEdit(null)
    setIsFormModalOpen(true)
  }, [])

  const handleOpenEdit = useCallback((owner: Owner) => {
    setOwnerToEdit(owner)
    setIsFormModalOpen(true)
  }, [])

  const handleOpenTransact = useCallback((owner: Owner) => {
    setSelectedOwnerForTx(owner)
    setIsTxModalOpen(true)
  }, [])

  const handleOpenDrawer = useCallback((owner: Owner) => {
    setDrawerOwner(owner)
    setIsDrawerOpen(true)
  }, [])

  const handleDelete = useCallback((owner: Owner) => {
    if (owner.transactions && owner.transactions.length > 0) {
      showToast('Cannot delete owner with transaction history.', 'warning')
      return
    }
    if (window.confirm(`Are you sure you want to remove owner "${owner.name}"?`)) {
      deleteOwnerMutation.mutate(owner.id)
    }
  }, [deleteOwnerMutation, showToast])

  const handleClearFilters = useCallback(() => {
    setSearchTerm('')
    setPageNumber(1)
  }, [])

  return (
    <FitScreenPage className="space-y-2.5 text-left">
      {/* 1. Page Header (Exact title, subtitle, and button preserved) */}
      <PageHeader
        title="Owner Management"
        subtitle="Manage equity owners, initial contributions, and investment/withdrawal logs"
        actions={
          <EnterpriseButton
            variant="primary"
            size="sm"
            onClick={handleOpenCreate}
            className="!h-[32px] text-xs font-semibold shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Owner
          </EnterpriseButton>
        }
      />

      {/* 2. KPI Cards Row (4 cards, responsive strip/grid) */}
      <OwnerKpiCards
        owners={owners}
        loading={isLoading}
        isShortScreen={isShortScreen}
        isScrollKpi={isScrollKpi}
      />

      {/* 3. Ownership Split Card */}
      <OwnershipSplitCard
        owners={owners}
        onSelectOwner={handleOpenDrawer}
        hoveredOwnerId={hoveredOwnerId}
        onHoverOwner={setHoveredOwnerId}
        isCollapseBreakdown={isCollapseBreakdown}
        loading={isLoading}
      />

      {/* 4. Table Card */}
      <div className="bg-white border border-[#E5E9F2] rounded-[12px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden w-full flex-1 min-h-[260px] flex flex-col">
        {/* Filter Bar */}
        <OwnerFilters
          searchTerm={searchTerm}
          onSearchChange={s => {
            setSearchTerm(s)
            setPageNumber(1)
          }}
          onClearFilters={handleClearFilters}
          totalCount={owners.length}
          filteredCount={totalFilteredCount}
        />

        {/* Scrollable Table View or Mobile Card List */}
        <OwnersTable
          owners={pagedOwners}
          loading={isLoading}
          onRowClick={handleOpenDrawer}
          onOpenTransact={handleOpenTransact}
          onOpenEdit={handleOpenEdit}
          onDelete={handleDelete}
          pageNumber={pageNumber}
          pageSize={pageSize}
          totalCount={totalFilteredCount}
          onPageChange={setPageNumber}
          onPageSizeChange={newSize => {
            setPageSize(newSize)
            localStorage.setItem('aquora_owners_page_size', String(newSize))
            setPageNumber(1)
          }}
          totalCurrentInvestment={filteredMetrics.totalCurrentInvestment}
          totalOwnershipPercentage={filteredMetrics.totalOwnership}
          isFiltered={Boolean(searchTerm.trim())}
          onClearFilters={handleClearFilters}
          onOpenCreate={handleOpenCreate}
          hoveredOwnerId={hoveredOwnerId}
        />
      </div>

      {/* 5. Transact Modal */}
      {isTxModalOpen && (
        <OwnerTransactionModal
          isOpen={isTxModalOpen}
          onClose={() => {
            setIsTxModalOpen(false)
            setSelectedOwnerForTx(null)
          }}
          owners={owners}
          prefilledOwner={selectedOwnerForTx}
          bankAccounts={bankAccounts}
          cashBooks={cashBooks}
          onSubmit={async (ownerId, req) => {
            await txMutation.mutateAsync({ ownerId, req })
          }}
        />
      )}

      {/* 6. Owner Detail Drawer */}
      {isDrawerOpen && drawerOwner && (
        <OwnerDetailDrawer
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false)
            setDrawerOwner(null)
          }}
          owner={drawerOwner}
          allOwners={filteredOwners}
          onSelectOwner={o => setDrawerOwner(o)}
          onOpenTransact={o => {
            setIsDrawerOpen(false)
            handleOpenTransact(o)
          }}
          onOpenEdit={o => {
            setIsDrawerOpen(false)
            handleOpenEdit(o)
          }}
          onDelete={handleDelete}
        />
      )}

      {/* 7. Add / Edit Owner Form Modal */}
      {isFormModalOpen && (
        <OwnerFormModal
          isOpen={isFormModalOpen}
          onClose={() => {
            setIsFormModalOpen(false)
            setOwnerToEdit(null)
          }}
          ownerToEdit={ownerToEdit}
          existingOwners={owners}
          bankAccounts={bankAccounts}
          onCreate={async req => {
            await createOwnerMutation.mutateAsync(req)
          }}
          onUpdate={async (id, req) => {
            await updateOwnerMutation.mutateAsync({ id, req })
          }}
        />
      )}
    </FitScreenPage>
  )
}

export default OwnerListPage
