import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Plus, 
  Edit2, 
  Eye, 
  Beaker,
  TrendingUp,
  ShieldCheck,
  Clock,
  AlertTriangle,
  FlaskConical,
  Activity,
  Check
} from 'lucide-react';
import { toast } from '../../../utils/toast';
import { format } from 'date-fns';

import { EnterpriseHeader } from '../../../components/ui/EnterpriseHeader';
import { EnterpriseCard } from '../../../components/ui/EnterpriseCard';
import { EnterpriseTable, type ColumnDef } from '../../../components/ui/EnterpriseTable';
import { EnterpriseBadge } from '../../../components/ui/EnterpriseBadge';
import { EnterpriseButton } from '../../../components/ui/EnterpriseButton';
import { EnterpriseLoading } from '../../../components/ui/EnterpriseLoading';
import EnterpriseModal from '../../../components/ui/EnterpriseModal';
import { EnterpriseInput } from '../../../components/ui/EnterpriseInput';

import { waterTestApi } from '../../../services/api/waterTest';
import type { WaterTestDashboard, WaterTestReport, QCPendingTask } from '../../../services/api/waterTest';
import { useAuthStore } from '../../../store/useAuthStore';
import { isOwnerUser } from '../../../utils/permissions';

export const QualityDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isOwner = isOwnerUser(user);
  const [dashboard, setDashboard] = useState<WaterTestDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Quick Result Entry Modal State
  const [selectedTask, setSelectedTask] = useState<QCPendingTask | null>(null);
  const [taskResultValue, setTaskResultValue] = useState<string>('');
  const [taskResultString, setTaskResultString] = useState<string>('');
  const [isSubmittingResult, setIsSubmittingResult] = useState(false);

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const { data } = await waterTestApi.getDashboard();
      setDashboard(data);
    } catch (error) {
      toast.error('Failed to load quality control dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleOpenResultEntry = (task: QCPendingTask) => {
    setSelectedTask(task);
    setTaskResultValue('');
    setTaskResultString(task.parameterCategory === 'MICROBIOLOGY' ? 'Absent' : '');
  };

  const handleSaveQuickResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    const isNumeric = selectedTask.parameterCategory !== 'MICROBIOLOGY' || taskResultString === 'Enter Count';
    const numVal = isNumeric && taskResultValue.trim() !== '' ? parseFloat(taskResultValue) : null;
    const strVal = taskResultString.trim() !== '' ? taskResultString.trim() : null;

    if (!isNumeric && !strVal) {
      toast.error('Please select or enter a result value');
      return;
    }
    if (isNumeric && (numVal === null || isNaN(numVal))) {
      toast.error('Please enter a valid numeric result');
      return;
    }

    setIsSubmittingResult(true);
    try {
      await waterTestApi.enterSingleResult(selectedTask.reportId, selectedTask.parameterId, {
        value: numVal,
        stringValue: strVal,
        testedBy: user?.fullName || user?.email || 'QC Chemist'
      });
      toast.success(`Result entered for ${selectedTask.parameterName} on Batch ${selectedTask.batchNumber}`);
      setSelectedTask(null);
      fetchDashboard();
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Failed to enter result';
      toast.error(msg);
    } finally {
      setIsSubmittingResult(false);
    }
  };

  const getCompletionStatusBadge = (report: WaterTestReport) => {
    const comp = report.completionStatus || 'COMPLETED';
    switch (comp) {
      case 'RESULTS_OVERDUE':
        return <EnterpriseBadge variant="danger">Overdue Results</EnterpriseBadge>;
      case 'PARTIALLY_COMPLETED':
        return <EnterpriseBadge variant="warning">Partially Completed</EnterpriseBadge>;
      case 'IN_PROGRESS':
        return <EnterpriseBadge variant="info">Incubating (In Progress)</EnterpriseBadge>;
      case 'DRAFT':
        return <EnterpriseBadge variant="gray">Draft</EnterpriseBadge>;
      case 'COMPLETED':
      default:
        return <EnterpriseBadge variant="success">Completed</EnterpriseBadge>;
    }
  };

  const recentReportsColumns: ColumnDef<WaterTestReport>[] = [
    {
      id: 'reportNumber',
      header: 'Report No.',
      accessorKey: 'reportNumber',
      cell: (row: WaterTestReport) => (
        <span 
          onClick={() => navigate(`/qc/water-tests/${row.id}`)}
          className="font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
        >
          {row.reportNumber}
        </span>
      )
    },
    {
      id: 'batchNumber',
      header: 'Batch Number',
      accessorKey: 'batchNumber',
      cell: (row: WaterTestReport) => <span className="font-semibold text-slate-800">{row.batchNumber}</span>
    },
    {
      id: 'progress',
      header: 'Parameter Progress',
      cell: (row: WaterTestReport) => {
        const total = row.totalParametersCount ?? row.results?.length ?? 0;
        const completed = row.completedParametersCount ?? (row.results ? row.results.filter(r => r.resultStatus === 'COMPLETED' || (r.value !== null && r.value !== undefined) || (r.stringValue && r.stringValue.trim() !== '')).length : 0);
        const overdue = row.overdueParametersCount ?? 0;

        return (
          <div className="flex flex-col gap-1 min-w-[120px]">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-700">{completed}/{total} Params</span>
              {overdue > 0 && <span className="text-rose-600 text-[10px] font-bold">{overdue} Overdue</span>}
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className={`h-full rounded-full ${overdue > 0 ? 'bg-rose-500' : (completed === total ? 'bg-emerald-500' : 'bg-blue-500')}`}
                style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        );
      }
    },
    {
      id: 'completionStatus',
      header: 'Report Lifecycle',
      cell: (row: WaterTestReport) => getCompletionStatusBadge(row)
    },
    {
      id: 'testedBy',
      header: 'Tested By',
      accessorKey: 'testedBy',
      cell: (row: WaterTestReport) => row.testedBy || row.createdByName || '—'
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (row: WaterTestReport) => (
        <div className="flex items-center justify-end gap-2">
          <EnterpriseButton
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/qc/water-tests/${row.id}`)}
          >
            <Eye className="w-4 h-4 mr-1.5" /> View
          </EnterpriseButton>
          {!isOwner && (
            <EnterpriseButton
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/qc/water-tests/${row.id}/edit`)}
            >
              <Edit2 className="w-4 h-4 mr-1.5" /> Edit
            </EnterpriseButton>
          )}
        </div>
      )
    }
  ];

  if (isLoading) {
    return (
      <div className="p-8">
        <EnterpriseLoading label="Loading QC Dashboard..." />
      </div>
    );
  }

  const overdueCount = dashboard?.overdueTasksCount ?? 0;
  const dueTodayCount = dashboard?.dueTodayTasksCount ?? 0;
  const inProgressTasksCount = dashboard?.inProgressTasksCount ?? 0;
  const pendingTasksList = dashboard?.pendingTasks || [];

  return (
    <div className="p-8 space-y-8 pb-32 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <EnterpriseHeader 
          title="Quality Control"
          description="Water testing, incubation lifecycle monitoring, and quality compliance metrics"
        />
        
        {!isOwner && (
          <div className="flex items-center gap-3">
            <EnterpriseButton
              variant="primary"
              onClick={() => navigate('/qc/water-tests/new')}
            >
              <Plus className="w-4 h-4 mr-2" /> Create Water Test Report
            </EnterpriseButton>
          </div>
        )}
      </div>

      {/* QC ACTION HUB / INCUBATION TIMING METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <EnterpriseCard 
          className={`p-5 flex items-center justify-between border-l-4 ${overdueCount > 0 ? 'border-l-rose-500 bg-rose-50/40' : 'border-l-slate-300'}`}
        >
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${overdueCount > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Overdue Results</p>
              <h3 className={`text-2xl font-black ${overdueCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                {overdueCount}
              </h3>
            </div>
          </div>
          {overdueCount > 0 && (
            <EnterpriseBadge variant="danger">Action Required</EnterpriseBadge>
          )}
        </EnterpriseCard>

        <EnterpriseCard 
          className={`p-5 flex items-center justify-between border-l-4 ${dueTodayCount > 0 ? 'border-l-amber-500 bg-amber-50/40' : 'border-l-slate-300'}`}
        >
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${dueTodayCount > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Results Due Today</p>
              <h3 className={`text-2xl font-black ${dueTodayCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                {dueTodayCount}
              </h3>
            </div>
          </div>
          {dueTodayCount > 0 && (
            <EnterpriseBadge variant="warning">Due Today</EnterpriseBadge>
          )}
        </EnterpriseCard>

        <EnterpriseCard className="p-5 flex items-center justify-between border-l-4 border-l-blue-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Active Incubations</p>
              <h3 className="text-2xl font-black text-slate-800">
                {inProgressTasksCount}
              </h3>
            </div>
          </div>
          <EnterpriseBadge variant="info">In Progress</EnterpriseBadge>
        </EnterpriseCard>
      </div>

      {/* QC PENDING PARAMETERS / INCUBATION TASK QUEUE */}
      {pendingTasksList.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">Active Incubation & Delayed Result Action Queue</h2>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {pendingTasksList.length} Pending Parameters
            </span>
          </div>

          <EnterpriseCard className="overflow-hidden border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold h-10">
                    <th className="py-2.5 px-4">Batch & Report</th>
                    <th className="py-2.5 px-4">Parameter Name</th>
                    <th className="py-2.5 px-4">Category / Unit</th>
                    <th className="py-2.5 px-4">Incubation Started</th>
                    <th className="py-2.5 px-4">Expected Completion</th>
                    <th className="py-2.5 px-4">Status & Countdown</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {pendingTasksList.map((task) => {
                    const isTaskOverdue = task.urgencyLevel === 'OVERDUE';
                    const isDueToday = task.urgencyLevel === 'DUE_TODAY';

                    return (
                      <tr key={`${task.reportId}-${task.parameterId}`} className={`h-12 hover:bg-slate-50/80 transition-colors ${isTaskOverdue ? 'bg-rose-50/20' : ''}`}>
                        <td className="py-2.5 px-4">
                          <div className="flex flex-col">
                            <span 
                              onClick={() => navigate(`/qc/water-tests/${task.reportId}`)}
                              className="font-bold text-blue-600 hover:underline cursor-pointer"
                            >
                              {task.batchNumber}
                            </span>
                            <span className="text-[11px] text-slate-400">{task.reportNumber}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-800">
                          {task.parameterName}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="text-slate-600 font-medium">{task.parameterCategory}</span>
                          <span className="text-[11px] text-slate-400 block">{task.unit}</span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {task.startedAt ? format(new Date(task.startedAt), 'dd MMM, hh:mm a') : '—'}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-800">
                          {task.expectedCompletionAt ? format(new Date(task.expectedCompletionAt), 'dd MMM, hh:mm a') : '—'}
                        </td>
                        <td className="py-2.5 px-4">
                          {isTaskOverdue ? (
                            <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              <AlertTriangle className="w-3 h-3" />
                              Overdue by {Math.abs(task.hoursRemainingOrOverdue)}h
                            </span>
                          ) : isDueToday ? (
                            <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              <Clock className="w-3 h-3" />
                              Due Today ({task.hoursRemainingOrOverdue}h left)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              <Activity className="w-3 h-3" />
                              Incubating ({task.hoursRemainingOrOverdue}h left)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {!isOwner && (
                            <EnterpriseButton
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenResultEntry(task)}
                            >
                              <Check className="w-3.5 h-3.5 mr-1" /> Enter Result
                            </EnterpriseButton>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </EnterpriseCard>
        </div>
      )}

      {/* Main Reports & Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent Test Reports</h2>
            <EnterpriseButton variant="ghost" size="sm" onClick={() => navigate('/qc/water-tests')}>
              View All
            </EnterpriseButton>
          </div>
          <EnterpriseCard className="overflow-hidden">
            <EnterpriseTable
              columns={recentReportsColumns}
              data={dashboard?.recentReports || []}
              emptyMessage="No water test reports found"
            />
          </EnterpriseCard>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">QC Water Quality Overview</h2>
          <EnterpriseCard className="p-5 space-y-4 bg-white border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Standards & Compliance</h3>
                <p className="text-xs text-slate-500">Water quality standards enforcement</p>
              </div>
            </div>

            <div className="space-y-3 pt-2 text-xs border-t border-slate-100">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Total Analyzed Batches</span>
                <span className="font-bold text-slate-900">{dashboard?.totalReports || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Compliant Batches</span>
                <span className="font-bold text-emerald-600">{dashboard?.passedReports || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Non-Compliant Batches</span>
                <span className="font-bold text-red-600">{dashboard?.failedReports || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">In-Progress / Incubating</span>
                <span className="font-bold text-blue-600">{dashboard?.inProgressTasksCount || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Overdue Results</span>
                <span className="font-bold text-rose-600">{dashboard?.overdueTasksCount || 0}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <EnterpriseButton
                variant="secondary"
                size="sm"
                onClick={() => navigate('/qc/water-tests')}
              >
                Go to Water Test Reports
              </EnterpriseButton>
            </div>
          </EnterpriseCard>
        </div>
      </div>

      {/* Quick Result Entry Modal */}
      {selectedTask && (
        <EnterpriseModal
          isOpen={Boolean(selectedTask)}
          onClose={() => setSelectedTask(null)}
          title={`Enter QC Result — ${selectedTask.parameterName}`}
        >
          <form onSubmit={handleSaveQuickResult} className="space-y-4 pt-2">
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Batch Number:</span>
                <span className="font-bold text-slate-900">{selectedTask.batchNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Report Number:</span>
                <span className="font-semibold text-slate-800">{selectedTask.reportNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Incubation Duration:</span>
                <span className="font-semibold text-indigo-700">{selectedTask.requiredDurationHours} Hours</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Expected Completion:</span>
                <span className="font-semibold text-slate-800">
                  {selectedTask.expectedCompletionAt ? format(new Date(selectedTask.expectedCompletionAt), 'dd MMM yyyy, hh:mm a') : '—'}
                </span>
              </div>
            </div>

            {selectedTask.parameterCategory === 'MICROBIOLOGY' ? (
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-700 block">Microbiological Observation</label>
                <select
                  className="w-full h-9 px-3 rounded-md border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                  value={taskResultString}
                  onChange={(e) => setTaskResultString(e.target.value)}
                >
                  <option value="Absent">Absent (Compliant)</option>
                  <option value="Present">Present (Non-Compliant)</option>
                  <option value="Enter Count">Enter Colony Count (CFU/ml)</option>
                </select>

                {taskResultString === 'Enter Count' && (
                  <EnterpriseInput
                    label="Colony Count (CFU/ml) *"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 0, 5, 25"
                    value={taskResultValue}
                    onChange={(e) => setTaskResultValue(e.target.value)}
                    required
                  />
                )}
              </div>
            ) : (
              <EnterpriseInput
                label={`Measured Result (${selectedTask.unit}) *`}
                type="number"
                step="any"
                placeholder={`Enter result in ${selectedTask.unit}`}
                value={taskResultValue}
                onChange={(e) => setTaskResultValue(e.target.value)}
                required
              />
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <EnterpriseButton
                type="button"
                variant="secondary"
                onClick={() => setSelectedTask(null)}
              >
                Cancel
              </EnterpriseButton>
              <EnterpriseButton
                type="submit"
                variant="primary"
                loading={isSubmittingResult}
              >
                Save & Complete Parameter
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
      )}
    </div>
  );
};

export default QualityDashboardPage;

