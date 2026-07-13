import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useNotificationStore } from '../../store/useNotificationStore'
import { useAuthStore } from '../../store/useAuthStore'
import { 
  Building2, Network, Layers, MonitorPlay, 
  Settings, Cpu, Plus, Trash2, ShieldAlert, Clock
} from 'lucide-react'
import EnterpriseHeader from '../../components/ui/EnterpriseHeader'
import EnterpriseCard from '../../components/ui/EnterpriseCard'
import EnterpriseButton from '../../components/ui/EnterpriseButton'
import EnterpriseInput from '../../components/ui/EnterpriseInput'
import EnterpriseBadge from '../../components/ui/EnterpriseBadge'
import EnterpriseModal from '../../components/ui/EnterpriseModal'

interface HierarchyNode {
  id: string
  name: string
  code: string
  type: string
  parentId: string | null
  isActive: boolean
  children: HierarchyNode[]
}

interface AuditLog {
  id: string
  userId: string
  userEmail: string
  action: string
  tableName: string
  primaryKey: string
  oldValues: string | null
  newValues: string | null
  timestamp: string
  ipAddress: string
  device: string
  reason: string
  module: string
}

export const PlatformDashboardPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { showToast } = useNotificationStore()
  const { user } = useAuthStore()
  const [selectedNode, setSelectedNode] = useState<HierarchyNode | null>(null)
  
  // Node Creation modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newNodeName, setNewNodeName] = useState('')
  const [newNodeCode, setNewNodeCode] = useState('')
  const [newNodeType, setNewNodeType] = useState('ProductionLine')
  const [newNodeParentId, setNewNodeParentId] = useState<string | null>(null)

  // 1. Fetch Hierarchy Tree
  const { data: treeData, isLoading: treeLoading } = useQuery<HierarchyNode[]>({
    queryKey: ['hierarchyTree'],
    queryFn: async () => {
      const res = await api.get('/api/v1/hierarchy')
      return res.data?.data || []
    }
  })

  // 2. Fetch Audit Logs
  const { data: auditLogs, isLoading: auditsLoading, refetch: refetchAudits } = useQuery<AuditLog[]>({
    queryKey: ['auditLogs'],
    queryFn: async () => {
      const res = await api.get('/api/v1/auditlog')
      return res.data?.data || []
    },
    refetchInterval: 10000 // Poll audits every 10s
  })

  // 3. Create Node Mutation
  const createNodeMutation = useMutation({
    mutationFn: async (payload: { type: string, name: string, code: string, parentId: string | null }) => {
      const res = await api.post(`/api/v1/hierarchy/${payload.type}`, {
        name: payload.name,
        code: payload.code,
        type: payload.type,
        parentId: payload.parentId,
        isActive: true
      })
      return res.data
    },
    onSuccess: (_, variables) => {
      showToast(`Successfully created new ${variables.type} node.`, 'success')
      queryClient.invalidateQueries({ queryKey: ['hierarchyTree'] })
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] })
      setIsModalOpen(false)
      setNewNodeName('')
      setNewNodeCode('')
      setSelectedNode(null)
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || 'Failed to create hierarchy node.'
      showToast(msg, 'error')
    }
  })

  // 4. Delete Node Mutation
  const deleteNodeMutation = useMutation({
    mutationFn: async (payload: { id: string, type: string }) => {
      await api.delete(`/api/v1/hierarchy/${payload.type}/${payload.id}`)
    },
    onSuccess: (_, variables) => {
      showToast(`Successfully deleted ${variables.type} node.`, 'success')
      queryClient.invalidateQueries({ queryKey: ['hierarchyTree'] })
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] })
      setSelectedNode(null)
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || 'Failed to delete node.'
      showToast(msg, 'error')
    }
  })

  const getNodeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'company': return <Building2 className="w-4 h-4 text-[#1A56DB]" />
      case 'productionline': return <Network className="w-4 h-4 text-[#F79009]" />
      case 'station': return <MonitorPlay className="w-4 h-4 text-[#2E90FA]" />
      case 'machine': return <Cpu className="w-4 h-4 text-[#667085]" />
      default: return <Settings className="w-4 h-4 text-slate-400" />
    }
  }

  const getNextChildType = (parentType: string) => {
    switch (parentType.toLowerCase()) {
      case 'company': return 'ProductionLine'
      case 'productionline': return 'Station'
      case 'station': return 'Machine'
      default: return ''
    }
  }

  const handleAddChildClick = (parent: HierarchyNode) => {
    const nextType = getNextChildType(parent.type)
    if (!nextType) {
      showToast('Cannot add children to a Machine node.', 'warning')
      return
    }
    setNewNodeType(nextType)
    setNewNodeParentId(parent.id)
    setIsModalOpen(true)
  }

  const handleCreateNode = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNodeName || !newNodeCode) {
      showToast('Please fill out Name and Code.', 'warning')
      return
    }
    createNodeMutation.mutate({
      type: newNodeType,
      name: newNodeName,
      code: newNodeCode.toUpperCase().replace(/\s+/g, '_'),
      parentId: newNodeParentId
    })
  }

  const handleDeleteNode = (node: HierarchyNode) => {
    if (confirm(`Are you sure you want to delete the ${node.type} "${node.name}"? This will trigger soft-deletion in the backend.`)) {
      deleteNodeMutation.mutate({ id: node.id, type: node.type })
    }
  }

  const renderTree = (nodes: HierarchyNode[]) => {
    return (
      <div className="pl-3 flex flex-col gap-1.5 border-l border-[#E5E9F2] mt-1 ml-2">
        {nodes.map(node => (
          <div key={node.id} className="flex flex-col">
            <div 
              className={`flex items-center justify-between p-2 rounded-[8px] text-xs font-semibold select-none cursor-pointer transition-all hover:bg-[#EFF4FF] ${
                selectedNode?.id === node.id ? 'bg-[#EFF4FF] text-[#1A56DB]' : 'text-[#101828]'
              }`}
              onClick={() => setSelectedNode(node)}
            >
              <div className="flex items-center gap-2">
                {getNodeIcon(node.type)}
                <span>{node.name}</span>
                <span className="text-[10px] text-[#667085] bg-[#EFF4FF] px-1.5 py-0.5 rounded-[4px] uppercase font-bold tracking-wider">{node.code}</span>
              </div>
              <div className="flex items-center gap-1">
                {node.type.toLowerCase() !== 'machine' && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleAddChildClick(node) }}
                    className="p-1 rounded hover:bg-white text-[#17B26A] transition-colors cursor-pointer"
                    title={`Add ${getNextChildType(node.type)}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteNode(node) }}
                  className="p-1 rounded hover:bg-white text-[#F04438] transition-colors cursor-pointer"
                  title="Soft Delete Node"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {node.children && node.children.length > 0 && renderTree(node.children)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <EnterpriseHeader 
        title="Platform Command Console" 
        description="Oversee the multi-tenant site hierarchy and security databases."
      />

      {/* Overview stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 select-none">
        <div className="bg-white border border-[#E5E9F2] p-5 rounded-[12px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider block">Tenant ID</span>
            <h3 className="text-sm font-bold text-[#101828] mt-1 truncate max-w-[160px]" title={user?.tenantId || undefined}>{user?.tenantId}</h3>
          </div>
          <div className="p-3 bg-[#EFF4FF] rounded-[8px] text-[#1A56DB]">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#E5E9F2] p-5 rounded-[12px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider block">Database Connection</span>
            <h3 className="text-sm font-bold text-[#17B26A] mt-1">PostgreSQL Active</h3>
          </div>
          <div className="p-3 bg-[#ECFDF3] rounded-[8px] text-[#17B26A]">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#E5E9F2] p-5 rounded-[12px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider block">Active Modules</span>
            <h3 className="text-sm font-bold text-[#101828] mt-1">Foundation Node</h3>
          </div>
          <div className="p-3 bg-[#EFF8FF] rounded-[8px] text-[#2E90FA]">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#E5E9F2] p-5 rounded-[12px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider block">System Clock</span>
            <h3 className="text-sm font-bold text-[#101828] mt-1">UTC Synchronization</h3>
          </div>
          <div className="p-3 bg-[#FFFAEB] rounded-[8px] text-[#F79009]">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Panel split tree & details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hierarchy tree explorer */}
        <div className="lg:col-span-2 flex flex-col">
          <EnterpriseCard 
            title="Master Organization Tree" 
            extra={
              treeData && treeData.length === 0 ? (
                <EnterpriseButton 
                  onClick={() => { setNewNodeType('Company'); setNewNodeParentId(null); setIsModalOpen(true) }}
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add Company
                </EnterpriseButton>
              ) : undefined
            }
          >
            <div className="overflow-y-auto max-h-[360px] pr-2 mt-2">
              {treeLoading ? (
                <div className="flex flex-col gap-2.5 animate-pulse">
                  <div className="h-6 bg-slate-100 rounded w-full" />
                  <div className="h-6 bg-slate-100 rounded w-4/5 ml-4" />
                  <div className="h-6 bg-slate-100 rounded w-3/4 ml-8" />
                </div>
              ) : treeData && treeData.length > 0 ? (
                <div className="flex flex-col">
                  {treeData.map(company => (
                    <div key={company.id} className="mb-2">
                      <div 
                        className={`flex items-center justify-between p-2.5 rounded-[8px] text-xs font-bold cursor-pointer transition-all hover:bg-[#EFF4FF] select-none ${
                          selectedNode?.id === company.id ? 'bg-[#EFF4FF] text-[#1A56DB]' : 'text-[#101828]'
                        }`}
                        onClick={() => setSelectedNode(company)}
                      >
                        <div className="flex items-center gap-2">
                          {getNodeIcon('company')}
                          <span>{company.name}</span>
                          <span className="text-[10px] text-[#667085] bg-[#EFF4FF] px-1.5 py-0.5 rounded-[4px] font-bold uppercase tracking-wider">{company.code}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleAddChildClick(company) }}
                            className="p-1 rounded hover:bg-white text-[#17B26A] transition-colors cursor-pointer"
                            title="Add Production Line"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteNode(company) }}
                            className="p-1 rounded hover:bg-white text-[#F04438] transition-colors cursor-pointer"
                            title="Soft Delete Node"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {company.children && company.children.length > 0 && renderTree(company.children)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-xs text-[#667085] select-none">
                  No organization structure found. Create a Company node to start onboarding the tenant.
                </div>
              )}
            </div>
          </EnterpriseCard>
        </div>

        {/* Selected Node details inspector */}
        <EnterpriseCard title="Node Inspector">
          {selectedNode ? (
            <div className="flex flex-col gap-4 text-xs font-semibold mt-2">
              <div className="p-3 bg-[#EFF4FF] rounded-[8px] flex items-center gap-3">
                <div className="p-2.5 bg-white rounded-[6px] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                  {getNodeIcon(selectedNode.type)}
                </div>
                <div>
                  <h4 className="font-bold text-[#101828] leading-tight">{selectedNode.name}</h4>
                  <span className="text-[10px] text-[#667085] uppercase font-bold tracking-wider">{selectedNode.type}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between border-b border-[#E5E9F2] pb-2">
                  <span className="text-[#667085] select-none">Node Code:</span>
                  <span className="font-bold text-[#101828]">{selectedNode.code}</span>
                </div>
                <div className="flex justify-between border-b border-[#E5E9F2] pb-2">
                  <span className="text-[#667085] select-none">Node GUID:</span>
                  <span className="font-mono text-[10px] text-[#101828] truncate max-w-[140px]" title={selectedNode.id}>{selectedNode.id}</span>
                </div>
                <div className="flex justify-between border-b border-[#E5E9F2] pb-2">
                  <span className="text-[#667085] select-none">State:</span>
                  <span className="font-bold">
                    <EnterpriseBadge variant={selectedNode.isActive ? 'success' : 'danger'}>
                      {selectedNode.isActive ? 'Active' : 'Inactive'}
                    </EnterpriseBadge>
                  </span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-[#667085] select-none">Children Count:</span>
                  <span className="font-bold text-[#101828]">{selectedNode.children?.length || 0}</span>
                </div>
              </div>

              {selectedNode.type.toLowerCase() !== 'machine' && (
                <EnterpriseButton 
                  onClick={() => handleAddChildClick(selectedNode)}
                  className="w-full text-xs mt-2"
                  variant="secondary"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Add {getNextChildType(selectedNode.type)}
                </EnterpriseButton>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-xs text-[#667085] select-none border border-dashed border-[#E5E9F2] rounded-[12px] mt-2">
              Select a node in the tree to inspect details
            </div>
          )}
        </EnterpriseCard>
      </div>

      {/* Database Audits tracking log */}
      <EnterpriseCard title="System Audit Trails" extra={
        <EnterpriseButton onClick={() => refetchAudits()} variant="ghost" size="sm">
          Refresh Logs
        </EnterpriseButton>
      }>
        <div className="overflow-x-auto mt-2">
          {auditsLoading ? (
            <div className="flex flex-col gap-2 pr-2 animate-pulse">
              <div className="h-8 bg-slate-100 rounded w-full" />
              <div className="h-8 bg-slate-100 rounded w-full" />
            </div>
          ) : auditLogs && auditLogs.length > 0 ? (
            <table className="w-full text-[11px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E5E9F2] text-[#667085] font-semibold select-none uppercase tracking-wider">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Table</th>
                  <th className="py-2.5 px-3">Changed Fields</th>
                  <th className="py-2.5 px-3">IP Address</th>
                  <th className="py-2.5 px-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E9F2]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="text-[#101828] hover:bg-[#EFF4FF] transition-colors h-[40px]">
                    <td className="py-2 px-3 font-medium whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 font-semibold truncate max-w-[120px]" title={log.userEmail}>
                      {log.userEmail}
                    </td>
                    <td className="py-2 px-3">
                      <EnterpriseBadge variant={
                        log.action === 'Insert' ? 'success' :
                        log.action === 'Update' ? 'primary' : 'danger'
                      }>
                        {log.action}
                      </EnterpriseBadge>
                    </td>
                    <td className="py-2 px-3 font-semibold">{log.tableName}</td>
                    <td className="py-2 px-3 max-w-[200px] truncate" title={log.newValues || log.oldValues || ''}>
                      {log.action === 'Insert' && <span className="font-mono text-[#667085]">{log.newValues}</span>}
                      {log.action === 'Update' && <span className="font-mono text-[#1A56DB]">{log.newValues}</span>}
                      {log.action === 'Delete' && <span className="text-[#F04438] font-semibold">Deleted Record</span>}
                    </td>
                    <td className="py-2 px-3 font-mono text-[#667085]">{log.ipAddress}</td>
                    <td className="py-2 px-3 text-[#667085] italic">{log.reason || 'System operation'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-8 text-xs text-[#667085] select-none">
              No audit logs recorded yet. Create or delete a hierarchy node to trigger database logs.
            </div>
          )}
        </div>
      </EnterpriseCard>

      {/* Creation Modal */}
      <EnterpriseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Create New ${newNodeType}`}
      >
        <form onSubmit={handleCreateNode} className="flex flex-col gap-4">
          <EnterpriseInput
            label="Node Name"
            value={newNodeName}
            onChange={(e) => setNewNodeName(e.target.value)}
            placeholder={`e.g. ${newNodeType} 1`}
            required
          />

          <EnterpriseInput
            label="Identifier Code (Alphanumeric)"
            value={newNodeCode}
            onChange={(e) => setNewNodeCode(e.target.value)}
            placeholder="e.g. CODE_01"
            required
          />

          <div className="flex gap-2 justify-end mt-4">
            <EnterpriseButton 
              type="button" 
              onClick={() => setIsModalOpen(false)} 
              variant="secondary"
            >
              Cancel
            </EnterpriseButton>
            <EnterpriseButton 
              type="submit" 
              loading={createNodeMutation.isPending}
            >
              Create Node
            </EnterpriseButton>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  )
}

export default PlatformDashboardPage
