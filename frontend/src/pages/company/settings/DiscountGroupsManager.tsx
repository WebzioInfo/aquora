import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { discountGroupService } from '../../../services/discountGroups'
import type { DiscountGroup } from '../../../services/discountGroups'
import { useNotificationStore } from '../../../store/useNotificationStore'
import EnterpriseCard from '../../../components/ui/EnterpriseCard'
import EnterpriseButton from '../../../components/ui/EnterpriseButton'
import EnterpriseTable from '../../../components/ui/EnterpriseTable'
import EnterpriseModal from '../../../components/ui/EnterpriseModal'
import EnterpriseInput from '../../../components/ui/EnterpriseInput'
import EnterpriseBadge from '../../../components/ui/EnterpriseBadge'
import { Plus, Edit2, Trash2 } from 'lucide-react'

export const DiscountGroupsManager: React.FC = () => {
  const queryClient = useQueryClient()
  const { showToast } = useNotificationStore()

  const { data: discountGroups, isLoading } = useQuery({
    queryKey: ['discountGroups'],
    queryFn: discountGroupService.getAll
  })

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    isActive: true
  })

  const createMutation = useMutation({
    mutationFn: discountGroupService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discountGroups'] })
      showToast('Discount group created successfully', 'success')
      setIsModalOpen(false)
    }
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: string, payload: Partial<DiscountGroup> }) => discountGroupService.update(data.id, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discountGroups'] })
      showToast('Discount group updated successfully', 'success')
      setIsModalOpen(false)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: discountGroupService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discountGroups'] })
      showToast('Discount group deleted successfully', 'success')
    }
  })

  const handleOpenModal = (item?: DiscountGroup) => {
    if (item) {
      setEditingId(item.id)
      setFormData({
        code: item.code,
        description: item.description || '',
        isActive: item.isActive
      })
    } else {
      setEditingId(null)
      setFormData({ code: '', description: '', isActive: true })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.code.trim()) return

    if (editingId) {
      updateMutation.mutate({ id: editingId, payload: formData })
    } else {
      createMutation.mutate(formData as Omit<DiscountGroup, 'id'>)
    }
  }

  return (
    <EnterpriseCard
      title="Discount Groups"
      extra={
        <EnterpriseButton onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Discount Group
        </EnterpriseButton>
      }
    >
      <div className="mb-4 text-sm text-slate-500">Manage customer discount group codes.</div>
      <EnterpriseTable
        data={discountGroups || []}
        loading={isLoading}
        emptyMessage="No discount groups found."
        columns={[
          { title: 'Code', key: 'code' },
          { title: 'Description', key: 'description' },
          { 
            title: 'Status', 
            key: 'status',
            render: (row: DiscountGroup) => (
              <EnterpriseBadge variant={row.isActive ? 'success' : 'gray'}>
                {row.isActive ? 'Active' : 'Inactive'}
              </EnterpriseBadge>
            )
          },
          {
            title: 'Actions',
            key: 'actions',
            render: (row: DiscountGroup) => (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleOpenModal(row)}
                  className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this discount group?')) {
                      deleteMutation.mutate(row.id)
                    }
                  }}
                  className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          }
        ]}
      />

      <EnterpriseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Discount Group' : 'Add Discount Group'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <EnterpriseInput
            label="Code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder="e.g. VIP_10"
            required
          />
          <EnterpriseInput
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description"
          />
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActiveGroup"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isActiveGroup" className="text-sm font-medium text-slate-700">
              Active Status
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <EnterpriseButton variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </EnterpriseButton>
            <EnterpriseButton type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editingId ? 'Save Changes' : 'Create Discount Group'}
            </EnterpriseButton>
          </div>
        </form>
      </EnterpriseModal>
    </EnterpriseCard>
  )
}
