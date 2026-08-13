import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  AlertTriangle, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  Wrench, 
  Send, 
  User, 
  Building2, 
  Calendar, 
  FileText, 
  Paperclip,
  CheckSquare,
  ShieldCheck,
  Zap,
  Activity,
  Cpu,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '../../../utils/toast';
import { useAuthStore } from '../../../store/useAuthStore';

import PageContainer from '../../../components/ui/layout/PageContainer';
import PageHeader from '../../../components/ui/layout/PageHeader';
import { EnterpriseCard } from '../../../components/ui/EnterpriseCard';
import { EnterpriseBadge } from '../../../components/ui/EnterpriseBadge';
import { EnterpriseButton } from '../../../components/ui/EnterpriseButton';
import { EnterpriseLoading } from '../../../components/ui/EnterpriseLoading';

import { operationsIssueApi } from '../../../services/api/operationsIssue';
import type { OperationsIssueDetail } from '../../../services/api/operationsIssue';

export type NormalizedStatus = 'Open' | 'InProgress' | 'Resolved' | 'Closed';

export const normalizeIssueStatus = (status: string | undefined | null): NormalizedStatus => {
  if (!status) return 'Open';
  const s = status.trim().toLowerCase().replace(/\s+/g, '');
  if (s === 'open') return 'Open';
  if (s === 'inprogress' || s === 'in_progress' || s === 'acknowledged' || s === 'assigned' || s === 'waitingforparts' || s === 'onhold') {
    return 'InProgress';
  }
  if (s === 'resolved') return 'Resolved';
  if (s === 'closed' || s === 'verified') return 'Closed';
  return 'Open';
};

export const OperationsIssueDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const isOwner = (user?.roles?.some(r => ['owner', 'companyowner', 'platformowner'].includes(r.toLowerCase())) || user?.roleName?.toLowerCase() === 'owner') ?? false;
  const canWrite = !isOwner;

  const [isLoading, setIsLoading] = useState(true);
  const [issue, setIssue] = useState<OperationsIssueDetail | null>(null);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  // Form Modals / Action States
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Resolution Form Modal
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [rootCause, setRootCause] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [preventiveAction, setPreventiveAction] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [downtimeMins, setDowntimeMins] = useState('');

  useEffect(() => {
    if (id) fetchIssueDetails(id);
  }, [id]);

  const fetchIssueDetails = async (issueId: string) => {
    setIsLoading(true);
    try {
      const res = await operationsIssueApi.getIssueById(issueId);
      setIssue(res.data);
      if (res.data) {
        setRootCause(res.data.rootCause || '');
        setCorrectiveAction(res.data.correctiveAction || '');
        setPreventiveAction(res.data.preventiveAction || '');
        setDowntimeMins(res.data.downtimeMinutes ? res.data.downtimeMinutes.toString() : '');

        // Auto mark as read if unread
        if (!res.data.isRead) {
          operationsIssueApi.markIssueAsRead(issueId).catch(() => {});
        }
      }
    } catch (error) {
      toast.error('Failed to load issue details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newComment.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      await operationsIssueApi.addComment(id, newComment.trim());
      toast.success('Comment added');
      setNewComment('');
      await fetchIssueDetails(id);
    } catch (error) {
      toast.error('Failed to post comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleStatusChange = async (targetStatus: string) => {
    if (!id || isActionSubmitting) return;
    setIsActionSubmitting(true);
    try {
      const res = await operationsIssueApi.changeStatus(id, targetStatus);
      toast.success(`Status changed to ${targetStatus === 'InProgress' ? 'In Progress' : targetStatus}`);
      if (res.data) {
        setIssue(prev => prev ? { ...prev, ...res.data, status: res.data.status || targetStatus } : prev);
      }
      await fetchIssueDetails(id);
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleCreateWorkOrder = async () => {
    if (!id || isActionSubmitting) return;
    setIsActionSubmitting(true);
    try {
      await operationsIssueApi.createWorkOrder(id);
      toast.success('Maintenance Work Order created & linked!');
      await fetchIssueDetails(id);
    } catch (error) {
      toast.error('Failed to create work order');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || isActionSubmitting || !rootCause.trim() || !correctiveAction.trim()) {
      toast.error('Root Cause and Corrective Action are required');
      return;
    }

    setIsActionSubmitting(true);
    try {
      const res = await operationsIssueApi.resolveIssue(id, {
        rootCause: rootCause.trim(),
        correctiveAction: correctiveAction.trim(),
        preventiveAction: preventiveAction.trim() || undefined,
        actualCost: actualCost ? parseFloat(actualCost) : undefined,
        downtimeMinutes: downtimeMins ? parseInt(downtimeMins, 10) : undefined
      });
      toast.success('Issue marked as Resolved!');
      setShowResolveModal(false);
      if (res.data) {
        setIssue(prev => prev ? { ...prev, ...res.data, status: 'Resolved' } : prev);
      }
      await fetchIssueDetails(id);
    } catch (error) {
      toast.error('Failed to resolve issue');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleVerifyAndClose = async () => {
    if (!id || isActionSubmitting) return;
    setIsActionSubmitting(true);
    try {
      const res = await operationsIssueApi.verifyAndCloseIssue(id, 'Verified by Supervisor/Admin');
      toast.success('Issue verified and closed');
      if (res.data) {
        setIssue(prev => prev ? { ...prev, ...res.data, status: 'Closed' } : prev);
      }
      await fetchIssueDetails(id);
    } catch (error) {
      toast.error('Failed to close issue');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="p-12 text-center">
          <EnterpriseLoading label="Loading issue details..." />
        </div>
      </PageContainer>
    );
  }

  if (!issue) {
    return (
      <PageContainer>
        <div className="p-12 text-center space-y-4">
          <p className="text-slate-500 font-medium">Operations issue not found.</p>
          <EnterpriseButton variant="secondary" onClick={() => navigate('/company/operations-issues')}>
            Back to Issues List
          </EnterpriseButton>
        </div>
      </PageContainer>
    );
  }

  const normalizedStatus = normalizeIssueStatus(issue.status);

  const getStatusBadgeVariant = (normStatus: NormalizedStatus) => {
    switch (normStatus) {
      case 'Closed': return 'gray';
      case 'Resolved': return 'success';
      case 'InProgress': return 'info';
      case 'Open': default: return 'danger';
    }
  };

  const getStatusDisplayLabel = (status: string) => {
    if (status === 'InProgress') return 'In Progress';
    if (status === 'WaitingForParts') return 'Waiting For Parts';
    if (status === 'OnHold') return 'On Hold';
    return status;
  };

  return (
    <PageContainer>
      {/* Header */}
      <PageHeader
        title={`Issue #${issue.issueNumber} - ${issue.title}`}
        description={`Reported in ${issue.department} Department • ${issue.category}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/company/operations-issues')}
              className="h-[32px] px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>

            {canWrite && normalizedStatus === 'Open' && (
              <button
                disabled={isActionSubmitting}
                onClick={() => handleStatusChange('InProgress')}
                className="h-[32px] px-3 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Activity className="w-3.5 h-3.5" /> Start Repair / In Progress
              </button>
            )}

            {canWrite && (normalizedStatus === 'Open' || normalizedStatus === 'InProgress') && (
              <button
                disabled={isActionSubmitting}
                onClick={() => setShowResolveModal(true)}
                className="h-[32px] px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Resolve Issue
              </button>
            )}

            {canWrite && normalizedStatus === 'Resolved' && (
              <button
                disabled={isActionSubmitting}
                onClick={handleVerifyAndClose}
                className="h-[32px] px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-[12px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Verify & Close Issue
              </button>
            )}

            {!issue.maintenanceWorkOrderId && normalizedStatus !== 'Closed' && (
              <button
                disabled={isActionSubmitting}
                onClick={handleCreateWorkOrder}
                className="h-[32px] px-3 bg-amber-500 hover:bg-amber-600 text-white text-[12px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Wrench className="w-3.5 h-3.5" /> Create Maintenance Work Order
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details, Resolution, Comments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Issue Summary Card */}
          <EnterpriseCard className="p-6 space-y-4 bg-white border border-slate-200">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Issue Description & Metrics</span>
              <div className="flex items-center gap-2">
                <EnterpriseBadge variant={issue.priority === 'Critical' || issue.priority === 'Emergency' ? 'danger' : 'info'}>
                  {issue.priority} Priority
                </EnterpriseBadge>
                <EnterpriseBadge variant={getStatusBadgeVariant(normalizedStatus)}>
                  {getStatusDisplayLabel(issue.status)}
                </EnterpriseBadge>
              </div>
            </div>

            <p className="text-sm text-slate-800 leading-relaxed font-medium whitespace-pre-line">
              {issue.description || 'No description provided.'}
            </p>

            {((issue.affectedMachines && issue.affectedMachines.length > 0) || issue.machineName) && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <Cpu className="w-4 h-4 text-blue-600" />
                  <span>
                    Affected Machines ({issue.affectedMachines?.length || (issue.machineName ? 1 : 0)}):
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pl-6">
                  {issue.affectedMachines && issue.affectedMachines.length > 0 ? (
                    issue.affectedMachines.map((m) => (
                      <span
                        key={m.machineId}
                        className="inline-flex items-center gap-1 text-xs font-semibold bg-white text-slate-800 border border-slate-200 px-2.5 py-1 rounded-md shadow-xs"
                      >
                        <span>{m.machineName}</span>
                        {m.machineCode && <span className="text-slate-400 font-mono text-[10px]">({m.machineCode})</span>}
                      </span>
                    ))
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-white text-slate-800 border border-slate-200 px-2.5 py-1 rounded-md">
                      {issue.machineName}
                    </span>
                  )}
                </div>
                {issue.downtimeMinutes ? (
                  <p className="text-[11px] text-slate-500 pl-6 pt-1">Estimated Downtime: {issue.downtimeMinutes} minutes</p>
                ) : null}
              </div>
            )}
          </EnterpriseCard>

          {/* Root Cause & Resolution Box */}
          {(issue.rootCause || issue.correctiveAction) && (
            <EnterpriseCard className="p-6 space-y-4 bg-emerald-50/50 border border-emerald-200">
              <h3 className="text-sm font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Resolution & Corrective Action
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <p className="font-bold text-slate-700">Root Cause:</p>
                  <p className="text-slate-900 mt-0.5">{issue.rootCause}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-700">Corrective Action Taken:</p>
                  <p className="text-slate-900 mt-0.5">{issue.correctiveAction}</p>
                </div>
                {issue.preventiveAction && (
                  <div>
                    <p className="font-bold text-slate-700">Preventive Action Plan:</p>
                    <p className="text-slate-900 mt-0.5">{issue.preventiveAction}</p>
                  </div>
                )}
              </div>
            </EnterpriseCard>
          )}

          {/* Conversation & Comments */}
          <EnterpriseCard className="p-6 space-y-4 bg-white border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Communication & Comments ({issue.comments.length})</h3>

            <div className="space-y-3">
              {issue.comments.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No comments posted yet.</p>
              ) : (
                issue.comments.map((c) => (
                  <div key={c.id} className="p-3 bg-slate-50 border border-slate-100 rounded-lg space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-900">{c.authorName}</span>
                      <span className="text-[10px] text-slate-400">{format(new Date(c.createdAt), 'dd MMM yyyy, hh:mm a')}</span>
                    </div>
                    <p className="text-xs text-slate-700">{c.message}</p>
                  </div>
                ))
              )}
            </div>

            {/* Comment Box */}
            <form onSubmit={handleAddComment} className="pt-3 border-t border-slate-100 space-y-2">
              <textarea
                rows={2}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment or update..."
                className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="flex justify-end">
                <EnterpriseButton type="submit" variant="primary" loading={isSubmittingComment}>
                  <Send className="w-3.5 h-3.5 mr-1" /> Post Comment
                </EnterpriseButton>
              </div>
            </form>
          </EnterpriseCard>
        </div>

        {/* Right Column: Meta & Audit Timeline */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <EnterpriseCard className="p-6 space-y-4 bg-white border border-slate-200">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">Issue Information</h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Reported By:</span>
                <span className="font-bold text-slate-900">{issue.reportedByName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reported At:</span>
                <span className="font-medium text-slate-800">{format(new Date(issue.reportedAt), 'dd MMM yyyy, hh:mm a')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Assigned Technician:</span>
                <span className="font-bold text-slate-900">{issue.assignedToName || 'Unassigned'}</span>
              </div>
              {issue.maintenanceWorkOrderId && (
                <div className="flex justify-between items-center p-2 bg-amber-50 rounded border border-amber-200">
                  <span className="text-amber-800 font-bold">Work Order:</span>
                  <span className="font-mono text-xs font-bold text-amber-900">#{issue.maintenanceWorkOrderId.substring(0, 8).toUpperCase()}</span>
                </div>
              )}
            </div>
          </EnterpriseCard>

          {/* Audit Timeline */}
          <EnterpriseCard className="p-6 space-y-4 bg-white border border-slate-200">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">Audit Timeline History</h3>

            <div className="space-y-4 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 pl-6">
              {issue.historyLogs.map((h) => (
                <div key={h.id} className="relative space-y-0.5">
                  <div className="absolute -left-[29px] top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-white" />
                  <p className="text-xs font-bold text-slate-900">{h.action}</p>
                  <p className="text-[11px] text-slate-600">{h.details}</p>
                  <p className="text-[10px] text-slate-400">{h.performedBy} • {format(new Date(h.timestamp), 'dd MMM, hh:mm a')}</p>
                </div>
              ))}
            </div>
          </EnterpriseCard>
        </div>
      </div>

      {/* Resolve Issue Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-[550px] w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Resolve Operations Issue
            </h3>

            <form onSubmit={handleResolveSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Root Cause *</label>
                <textarea
                  rows={2}
                  required
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  placeholder="Identify what caused this breakdown or incident..."
                  className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Corrective Action Taken *</label>
                <textarea
                  rows={2}
                  required
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                  placeholder="Describe the repair or corrective action performed..."
                  className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Preventive Action Plan (Optional)</label>
                <textarea
                  rows={2}
                  value={preventiveAction}
                  onChange={(e) => setPreventiveAction(e.target.value)}
                  placeholder="Actions to prevent recurrence..."
                  className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-bold text-slate-700">Final Downtime (Minutes)</label>
                  <input
                    type="number"
                    value={downtimeMins}
                    onChange={(e) => setDowntimeMins(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-bold text-slate-700">Actual Repair Cost ($)</label>
                  <input
                    type="number"
                    value={actualCost}
                    onChange={(e) => setActualCost(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <EnterpriseButton type="submit" variant="primary">
                  Confirm Resolution
                </EnterpriseButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default OperationsIssueDetailPage;
