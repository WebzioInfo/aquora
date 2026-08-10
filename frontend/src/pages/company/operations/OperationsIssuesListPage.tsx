import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  Wrench, 
  Zap, 
  ChevronRight,
  TrendingUp,
  Building2,
  Cpu,
  UserCheck,
  Eye,
  Flame,
  Bell
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '../../../utils/toast';

import PageContainer from '../../../components/ui/layout/PageContainer';
import PageHeader from '../../../components/ui/layout/PageHeader';
import { EnterpriseCard } from '../../../components/ui/EnterpriseCard';
import { EnterpriseBadge } from '../../../components/ui/EnterpriseBadge';
import { EnterpriseButton } from '../../../components/ui/EnterpriseButton';
import { EnterpriseLoading } from '../../../components/ui/EnterpriseLoading';
import { EnterpriseTable } from '../../../components/ui/EnterpriseTable';
import { FilterBar } from '../../../components/ui/layout/FilterBar';

import { operationsIssueApi } from '../../../services/api/operationsIssue';
import type { OperationsIssue, OperationsIssueDashboard } from '../../../services/api/operationsIssue';

const DEPARTMENTS = ['All', 'Production', 'Warehouse', 'Dispatch', 'QC', 'HR', 'Maintenance', 'General'];
const PRIORITIES = ['All', 'Low', 'Medium', 'High', 'Critical', 'Emergency'];
const STATUSES = ['All', 'Open', 'Acknowledged', 'Assigned', 'InProgress', 'WaitingForParts', 'OnHold', 'Resolved', 'Verified', 'Closed'];

export const OperationsIssuesListPage: React.FC = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'issues' | 'analytics'>('issues');
  const [isLoading, setIsLoading] = useState(true);
  const [issues, setIssues] = useState<OperationsIssue[]>([]);
  const [dashboard, setDashboard] = useState<OperationsIssueDashboard | null>(null);

  // Filter States
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedPriority, setSelectedPriority] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  const [pageNumber, setPageNumber] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchData();
  }, [pageNumber, search, selectedDept, selectedPriority, selectedStatus]);

  // Real-time Event Listener for instant table updates without reload
  useEffect(() => {
    const handleIssueCreated = (event: Event) => {
      const customEvt = event as CustomEvent<OperationsIssue>
      const newIssue = customEvt.detail
      if (!newIssue || !newIssue.id) return

      // 1. Duplicate check & filter matching
      setIssues(prev => {
        if (prev.some(item => item.id === newIssue.id)) return prev

        const matchesDept = selectedDept === 'All' || newIssue.department === selectedDept
        const matchesPriority = selectedPriority === 'All' || newIssue.priority === selectedPriority
        const matchesStatus = selectedStatus === 'All' || newIssue.status === selectedStatus

        const searchTerm = search.trim().toLowerCase()
        const matchesSearch = !searchTerm || (
          (newIssue.issueNumber && newIssue.issueNumber.toLowerCase().includes(searchTerm)) ||
          (newIssue.title && newIssue.title.toLowerCase().includes(searchTerm)) ||
          (newIssue.description && newIssue.description.toLowerCase().includes(searchTerm)) ||
          (newIssue.reportedByName && newIssue.reportedByName.toLowerCase().includes(searchTerm)) ||
          (newIssue.machineName && newIssue.machineName.toLowerCase().includes(searchTerm)) ||
          (newIssue.category && newIssue.category.toLowerCase().includes(searchTerm)) ||
          (newIssue.batchNumber && newIssue.batchNumber.toLowerCase().includes(searchTerm))
        )

        if (matchesDept && matchesPriority && matchesStatus && matchesSearch) {
          setTotalCount(c => c + 1)
          return [{ ...newIssue, isRead: false }, ...prev]
        }
        return prev
      })

      // 2. Live Dashboard Counter Updates
      setDashboard(prev => {
        if (!prev) return prev
        const isCritical = newIssue.priority === 'Critical' || newIssue.priority === 'Emergency'
        return {
          ...prev,
          openIssues: prev.openIssues + 1,
          unreadIssues: (prev.unreadIssues ?? 0) + 1,
          criticalIssues: isCritical ? prev.criticalIssues + 1 : prev.criticalIssues,
          totalDowntimeMinutes: prev.totalDowntimeMinutes + (newIssue.downtimeMinutes || 0)
        }
      })

      // 3. User Toast Notification
      toast.info(`New Issue Reported: #${newIssue.issueNumber} - ${newIssue.title}`)
    }

    const handleIssueUpdated = (event: Event) => {
      const customEvt = event as CustomEvent<OperationsIssue>
      const updatedIssue = customEvt.detail
      if (!updatedIssue || !updatedIssue.id) return

      setIssues(prev => prev.map(item => item.id === updatedIssue.id ? { ...item, ...updatedIssue } : item))
    }

    window.addEventListener('operations-issue-created', handleIssueCreated)
    window.addEventListener('operations-issue-updated', handleIssueUpdated)

    return () => {
      window.removeEventListener('operations-issue-created', handleIssueCreated)
      window.removeEventListener('operations-issue-updated', handleIssueUpdated)
    }
  }, [search, selectedDept, selectedPriority, selectedStatus])

  const [hasError, setHasError] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const [issuesRes, dashRes] = await Promise.all([
        operationsIssueApi.getIssues({
          pageNumber,
          pageSize: 15,
          search: search.trim() || undefined,
          department: selectedDept === 'All' ? undefined : selectedDept,
          priority: selectedPriority === 'All' ? undefined : selectedPriority,
          status: selectedStatus === 'All' ? undefined : selectedStatus
        }),
        operationsIssueApi.getDashboard()
      ]);

      setIssues(issuesRes.data.items || []);
      setTotalCount(issuesRes.data.totalCount || 0);
      setDashboard(dashRes.data);
    } catch (error) {
      setHasError(true);
      toast.error('Failed to load operations issues');
    } finally {
      setIsLoading(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Emergency':
      case 'Critical':
        return <EnterpriseBadge variant="danger">{priority}</EnterpriseBadge>;
      case 'High':
        return <EnterpriseBadge variant="warning">{priority}</EnterpriseBadge>;
      case 'Medium':
        return <EnterpriseBadge variant="info">{priority}</EnterpriseBadge>;
      case 'Low':
        return <EnterpriseBadge variant="gray">{priority}</EnterpriseBadge>;
      default:
        return <EnterpriseBadge variant="gray">{priority}</EnterpriseBadge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Open':
        return <EnterpriseBadge variant="danger">Open</EnterpriseBadge>;
      case 'Acknowledged':
      case 'Assigned':
        return <EnterpriseBadge variant="info">{status}</EnterpriseBadge>;
      case 'InProgress':
        return <EnterpriseBadge variant="warning">In Progress</EnterpriseBadge>;
      case 'Resolved':
      case 'Verified':
        return <EnterpriseBadge variant="success">{status}</EnterpriseBadge>;
      case 'Closed':
        return <EnterpriseBadge variant="gray">Closed</EnterpriseBadge>;
      default:
        return <EnterpriseBadge variant="gray">{status}</EnterpriseBadge>;
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Operations Issues & Incident Management"
        description="Centralized Plant Maintenance, Machine Breakdowns, & Operational Incident Response Platform"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                await operationsIssueApi.markAllIssuesAsRead()
                fetchData()
                toast.success('All issues marked as read.')
              }}
              className="h-[32px] px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" /> Mark All Read
            </button>
            <button
              onClick={() => navigate('/company/operations-issues/quick-report')}
              className="h-[32px] px-3 bg-amber-500 hover:bg-amber-600 text-white text-[12px] font-extrabold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 fill-current" /> 30s Operator Report
            </button>
            <button
              onClick={() => navigate('/company/operations-issues/new')}
              className="h-[32px] px-3 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" /> Report Issue
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      {dashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <EnterpriseCard className="p-3.5 bg-white border border-slate-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Unread Incidents</p>
                <div className="flex items-center gap-2 mt-1">
                  <h3 className="text-2xl font-black text-red-600">{dashboard.unreadIssues ?? 0}</h3>
                  {(dashboard.unreadIssues ?? 0) > 0 && (
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse ring-2 ring-red-300" />
                  )}
                </div>
              </div>
              <div className="p-2.5 bg-red-50 text-red-600 rounded-lg">
                <Bell className="w-5 h-5" />
              </div>
            </div>
          </EnterpriseCard>

          <EnterpriseCard className="p-3.5 bg-white border border-slate-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Open Incidents</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{dashboard.openIssues}</h3>
              </div>
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </EnterpriseCard>

          <EnterpriseCard className="p-3.5 bg-white border border-slate-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Critical / Emergency</p>
                <h3 className="text-2xl font-black text-red-600 mt-1">{dashboard.criticalIssues}</h3>
              </div>
              <div className="p-2.5 bg-red-50 text-red-600 rounded-lg">
                <Flame className="w-5 h-5" />
              </div>
            </div>
          </EnterpriseCard>

          <EnterpriseCard className="p-3.5 bg-white border border-slate-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Machine Downtime</p>
                <h3 className="text-2xl font-black text-amber-600 mt-1">{dashboard.totalDowntimeMinutes} <span className="text-xs font-normal text-slate-500">mins</span></h3>
              </div>
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
                <Wrench className="w-5 h-5" />
              </div>
            </div>
          </EnterpriseCard>

          <EnterpriseCard className="p-3.5 bg-white border border-slate-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Resolved Today</p>
                <h3 className="text-2xl font-black text-emerald-600 mt-1">{dashboard.resolvedToday}</h3>
              </div>
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </EnterpriseCard>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('issues')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'issues'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          All Operations Issues ({totalCount})
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'analytics'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Analytics & Downtime Report
        </button>
      </div>

      {activeTab === 'issues' ? (
        <div className="space-y-4">
          {/* Filter Bar */}
          <FilterBar>
            <div className="flex flex-wrap items-center gap-3 w-full">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search issue #, title, machine, reporter..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="py-1.5 px-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700"
              >
                <option value="All">All Departments</option>
                {DEPARTMENTS.filter(d => d !== 'All').map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="py-1.5 px-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700"
              >
                <option value="All">All Priorities</option>
                {PRIORITIES.filter(p => p !== 'All').map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="py-1.5 px-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700"
              >
                <option value="All">All Statuses</option>
                {STATUSES.filter(s => s !== 'All').map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </FilterBar>

          {/* Issues Table */}
          {isLoading ? (
            <div className="p-12 text-center">
              <EnterpriseLoading label="Loading operations issues..." />
            </div>
          ) : hasError ? (
            <EnterpriseCard className="p-12 text-center space-y-3 bg-red-50/50 border border-red-200">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
              <h3 className="text-base font-bold text-red-900">Unable to load operations issues</h3>
              <p className="text-xs text-red-700 max-w-sm mx-auto">
                An error occurred while fetching issues from the server. Please try again.
              </p>
              <EnterpriseButton variant="primary" onClick={fetchData}>
                Retry
              </EnterpriseButton>
            </EnterpriseCard>
          ) : issues.length === 0 ? (
            <EnterpriseCard className="p-12 text-center space-y-3 bg-white border border-slate-200">
              <AlertTriangle className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">No Operations Issues Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No issues match your current filters. Click below to log a new incident or breakdown.
              </p>
              <EnterpriseButton variant="primary" onClick={() => navigate('/company/operations-issues/new')}>
                <Plus className="w-4 h-4 mr-1.5" /> Report Issue
              </EnterpriseButton>
            </EnterpriseCard>
          ) : (
            <EnterpriseCard className="p-0 overflow-hidden bg-white border border-slate-200">
              <EnterpriseTable
                columns={[
                  {
                    id: 'issueNumber',
                    header: 'Issue Number',
                    accessorKey: 'issueNumber',
                    cell: (row: OperationsIssue) => (
                      <span 
                        onClick={() => navigate(`/company/operations-issues/${row.id}`)}
                        className="font-bold text-blue-600 hover:underline cursor-pointer"
                      >
                        #{row.issueNumber}
                      </span>
                    )
                  },
                  {
                    id: 'title',
                    header: 'Title & Category',
                    accessorKey: 'title',
                    cell: (row: OperationsIssue) => (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          {!row.isRead && (
                            <span className="bg-red-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse shadow-sm">
                              NEW
                            </span>
                          )}
                          <p className={`text-xs ${!row.isRead ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-800'}`}>
                            {row.title}
                          </p>
                        </div>
                        <p className="text-[11px] text-slate-500">{row.category}</p>
                      </div>
                    )
                  },
                  {
                    id: 'affectedMachines',
                    header: 'Affected Machines',
                    cell: (row: OperationsIssue) => {
                      const machines = row.affectedMachines && row.affectedMachines.length > 0
                        ? row.affectedMachines.map(m => m.machineName)
                        : (row.machineName ? [row.machineName] : []);

                      if (machines.length === 0) {
                        return <span className="text-slate-400 text-xs italic">—</span>;
                      }

                      if (machines.length === 1) {
                        return <span className="text-xs font-semibold text-slate-800">{machines[0]}</span>;
                      }

                      const tooltipText = machines.join(', ');
                      return (
                        <div className="flex items-center gap-1.5" title={tooltipText}>
                          <span className="text-xs font-semibold text-slate-800">{machines[0]}</span>
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 flex-shrink-0">
                            +{machines.length - 1} more
                          </span>
                        </div>
                      );
                    }
                  },
                  {
                    id: 'batchNumber',
                    header: 'Current Batch',
                    accessorKey: 'batchNumber',
                    cell: (row: OperationsIssue) => row.batchNumber ? (
                      <span className="font-mono text-[11px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {row.batchNumber}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs italic">—</span>
                    )
                  },
                  {
                    id: 'department',
                    header: 'Department',
                    accessorKey: 'department',
                    cell: (row: OperationsIssue) => (
                      <span className="text-xs font-medium text-slate-700">{row.department}</span>
                    )
                  },
                  {
                    id: 'priority',
                    header: 'Priority',
                    accessorKey: 'priority',
                    cell: (row: OperationsIssue) => getPriorityBadge(row.priority)
                  },
                  {
                    id: 'status',
                    header: 'Status',
                    accessorKey: 'status',
                    cell: (row: OperationsIssue) => getStatusBadge(row.status)
                  },
                  {
                    id: 'reportedByName',
                    header: 'Reported By',
                    accessorKey: 'reportedByName',
                    cell: (row: OperationsIssue) => (
                      <div>
                        <p className="text-xs font-medium text-slate-800">{row.reportedByName}</p>
                        <p className="text-[10px] text-slate-400">{format(new Date(row.reportedAt), 'dd MMM yyyy, hh:mm a')}</p>
                      </div>
                    )
                  },
                  {
                    id: 'assignedToName',
                    header: 'Assigned To',
                    accessorKey: 'assignedToName',
                    cell: (row: OperationsIssue) => (
                      <span className="text-xs text-slate-600 font-medium">
                        {row.assignedToName || <span className="text-slate-400 italic">Unassigned</span>}
                      </span>
                    )
                  },
                  {
                    id: 'actions',
                    header: 'Actions',
                    cell: (row: OperationsIssue) => (
                      <button
                        onClick={() => navigate(`/company/operations-issues/${row.id}`)}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )
                  }
                ]}
                data={issues}
              />
            </EnterpriseCard>
          )}
        </div>
      ) : (
        /* Analytics Tab */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <EnterpriseCard className="p-6 space-y-4 bg-white border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-600" /> Top Problem Machines & Equipment
            </h3>
            {dashboard?.topProblemMachines && dashboard.topProblemMachines.length > 0 ? (
              <div className="space-y-3">
                {dashboard.topProblemMachines.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{m.machineName}</p>
                      <p className="text-[11px] text-slate-500">{m.issueCount} Incidents Logged</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-amber-600">{m.totalDowntimeMinutes} mins</p>
                      <p className="text-[10px] text-slate-400">Total Downtime</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No machine breakdown data recorded yet.</p>
            )}
          </EnterpriseCard>

          <EnterpriseCard className="p-6 space-y-4 bg-white border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" /> Issues by Department
            </h3>
            {dashboard?.departmentStats && dashboard.departmentStats.length > 0 ? (
              <div className="space-y-3">
                {dashboard.departmentStats.map((d, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-xs font-bold text-slate-800">{d.department}</span>
                    <EnterpriseBadge variant="info">{d.count} Issues</EnterpriseBadge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No department data available.</p>
            )}
          </EnterpriseCard>
        </div>
      )}
    </PageContainer>
  );
};

export default OperationsIssuesListPage;
