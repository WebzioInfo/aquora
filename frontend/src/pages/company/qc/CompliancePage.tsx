import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  Search, 
  Filter, 
  FileText,
  UserCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '../../../utils/toast';

import { EnterpriseHeader } from '../../../components/ui/EnterpriseHeader';
import { EnterpriseCard } from '../../../components/ui/EnterpriseCard';
import { EnterpriseInput } from '../../../components/ui/EnterpriseInput';
import { EnterpriseSelect } from '../../../components/ui/EnterpriseSelect';
import { EnterpriseTable, type ColumnDef } from '../../../components/ui/EnterpriseTable';
import { EnterpriseBadge } from '../../../components/ui/EnterpriseBadge';
import { EnterpriseButton } from '../../../components/ui/EnterpriseButton';
import { EnterpriseLoading } from '../../../components/ui/EnterpriseLoading';
import EnterpriseModal from '../../../components/ui/EnterpriseModal';

import { waterTestApi } from '../../../services/api/waterTest';
import type { ComplianceRecord } from '../../../services/api/waterTest';

export const CompliancePage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Resolution modal state
  const [selectedRecord, setSelectedRecord] = useState<ComplianceRecord | null>(null);
  const [rootCause, setRootCause] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [preventiveAction, setPreventiveAction] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchComplianceRecords();
  }, []);

  const fetchComplianceRecords = async () => {
    setIsLoading(true);
    try {
      const res = await waterTestApi.getComplianceRecords();
      setRecords(res.data);
    } catch (error) {
      toast.error('Failed to load compliance records');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    if (!rootCause.trim() || !correctiveAction.trim()) {
      toast.error('Root Cause Analysis and Corrective Action are required');
      return;
    }

    setIsSubmitting(true);
    try {
      await waterTestApi.resolveComplianceRecord(selectedRecord.id, {
        rootCauseAnalysis: rootCause.trim(),
        correctiveAction: correctiveAction.trim(),
        preventiveAction: preventiveAction.trim(),
        resolutionNotes: resolutionNotes.trim()
      });
      toast.success(`Compliance record ${selectedRecord.referenceNumber} resolved.`);
      setSelectedRecord(null);
      fetchComplianceRecords();
    } catch (error) {
      toast.error('Failed to resolve compliance record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
      case 'HIGH':
        return <EnterpriseBadge variant="danger">{severity}</EnterpriseBadge>;
      case 'MEDIUM':
        return <EnterpriseBadge variant="warning">{severity}</EnterpriseBadge>;
      default:
        return <EnterpriseBadge variant="gray">{severity}</EnterpriseBadge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RESOLVED':
      case 'CLOSED':
        return <EnterpriseBadge variant="success">Resolved</EnterpriseBadge>;
      case 'OPEN':
        return <EnterpriseBadge variant="danger">Open Action</EnterpriseBadge>;
      default:
        return <EnterpriseBadge variant="info">{status}</EnterpriseBadge>;
    }
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = r.referenceNumber.toLowerCase().includes(search.toLowerCase()) || 
                          r.batchNumber.toLowerCase().includes(search.toLowerCase()) ||
                          r.parameterName.toLowerCase().includes(search.toLowerCase());
    if (filterStatus === 'OPEN') return matchesSearch && r.status === 'OPEN';
    if (filterStatus === 'RESOLVED') return matchesSearch && (r.status === 'RESOLVED' || r.status === 'CLOSED');
    return matchesSearch;
  });

  const columns: ColumnDef<ComplianceRecord>[] = [
    {
      id: 'referenceNumber',
      header: 'Reference No.',
      accessorKey: 'referenceNumber',
      cell: (row: ComplianceRecord) => <span className="font-bold text-blue-600">{row.referenceNumber}</span>
    },
    {
      id: 'batchNumber',
      header: 'Batch Number',
      accessorKey: 'batchNumber',
      cell: (row: ComplianceRecord) => <span className="font-semibold text-slate-800">{row.batchNumber}</span>
    },
    {
      id: 'parameterName',
      header: 'Defect Parameter',
      accessorKey: 'parameterName',
      cell: (row: ComplianceRecord) => (
        <div>
          <span className="font-semibold text-slate-900">{row.parameterName}</span>
          <p className="text-[11px] text-slate-500">{row.defectDescription}</p>
        </div>
      )
    },
    {
      id: 'severity',
      header: 'Severity',
      accessorKey: 'severity',
      cell: (row: ComplianceRecord) => getSeverityBadge(row.severity)
    },
    {
      id: 'status',
      header: 'CAPA Status',
      accessorKey: 'status',
      cell: (row: ComplianceRecord) => getStatusBadge(row.status)
    },
    {
      id: 'assignedTo',
      header: 'Assigned Analyst',
      accessorKey: 'assignedTo',
      cell: (row: ComplianceRecord) => row.assignedTo || 'QC Team'
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (row: ComplianceRecord) => (
        <div className="flex justify-end">
          {row.status === 'OPEN' ? (
            <EnterpriseButton
              variant="primary"
              size="sm"
              onClick={() => {
                setSelectedRecord(row);
                setRootCause(row.rootCauseAnalysis || '');
                setCorrectiveAction(row.correctiveAction || '');
                setPreventiveAction(row.preventiveAction || '');
                setResolutionNotes(row.resolutionNotes || '');
              }}
            >
              <UserCheck className="w-3.5 h-3.5 mr-1.5" /> Resolve NCR
            </EnterpriseButton>
          ) : (
            <EnterpriseButton
              variant="secondary"
              size="sm"
              onClick={() => {
                setSelectedRecord(row);
                setRootCause(row.rootCauseAnalysis || '');
                setCorrectiveAction(row.correctiveAction || '');
                setPreventiveAction(row.preventiveAction || '');
                setResolutionNotes(row.resolutionNotes || '');
              }}
            >
              View CAPA
            </EnterpriseButton>
          )}
        </div>
      )
    }
  ];

  if (isLoading) {
    return (
      <div className="p-8">
        <EnterpriseLoading label="Loading Quality Non-Conformance & CAPA records..." />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 pb-32 max-w-[1600px] mx-auto">
      
      {/* Breadcrumbs & Header */}
      <div className="space-y-2">
        <nav className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
          <Link to="/qc/dashboard" className="hover:text-slate-900 transition-colors">Quality Control</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-900 font-semibold">Compliance & CAPA Management</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <EnterpriseHeader
            title="Non-Conformance Reports (NCR) & CAPA Action Registry"
            description="Track, investigate, and record Root Cause Analysis (RCA) and Corrective/Preventive Actions for failed water quality parameters."
          />
        </div>
      </div>

      {/* Filter Bar */}
      <EnterpriseCard className="p-4 bg-white border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="md:col-span-2">
            <EnterpriseInput
              placeholder="Search reference number, batch, parameter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>
          <EnterpriseSelect
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Compliance Records' },
              { value: 'OPEN', label: 'Open Action Pending' },
              { value: 'RESOLVED', label: 'Resolved CAPA Records' }
            ]}
          />
        </div>
      </EnterpriseCard>

      {/* Data Table Card */}
      <EnterpriseCard className="overflow-hidden border border-slate-200 shadow-sm bg-white">
        <EnterpriseTable
          columns={columns}
          data={filteredRecords}
          emptyMessage="No non-conformance records found."
        />
      </EnterpriseCard>

      {/* CAPA Resolution Modal */}
      {selectedRecord && (
        <EnterpriseModal
          isOpen={Boolean(selectedRecord)}
          onClose={() => setSelectedRecord(null)}
          title={`CAPA Action & RCA Resolution — ${selectedRecord.referenceNumber}`}
        >
          <form onSubmit={handleResolveRecord} className="space-y-4 pt-2">
            <div className="bg-rose-50 p-4 rounded-lg border border-rose-100 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Defect Detail</span>
                <EnterpriseBadge variant="danger">{selectedRecord.severity}</EnterpriseBadge>
              </div>
              <p className="text-sm font-bold text-slate-900">{selectedRecord.parameterName} (Batch: {selectedRecord.batchNumber})</p>
              <p className="text-xs text-slate-600">{selectedRecord.defectDescription}</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Root Cause Analysis (RCA) *</label>
              <textarea
                className="w-full min-h-[70px] p-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                placeholder="Describe underlying root cause (e.g. RO membrane fouling, chlorine dosing pump calibration drift)..."
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
                disabled={selectedRecord.status === 'RESOLVED'}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Immediate Corrective Action *</label>
              <textarea
                className="w-full min-h-[70px] p-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                placeholder="Immediate corrective action taken (e.g. Batch re-filtration, chemical dosing adjustment)..."
                value={correctiveAction}
                onChange={(e) => setCorrectiveAction(e.target.value)}
                disabled={selectedRecord.status === 'RESOLVED'}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Preventive Action Plan</label>
              <textarea
                className="w-full min-h-[70px] p-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                placeholder="Preventive steps to avoid recurrence (e.g. Bi-weekly sensor calibration schedule)..."
                value={preventiveAction}
                onChange={(e) => setPreventiveAction(e.target.value)}
                disabled={selectedRecord.status === 'RESOLVED'}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Resolution Sign-off Notes</label>
              <input
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
                placeholder="Supervisor sign-off notes..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                disabled={selectedRecord.status === 'RESOLVED'}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <EnterpriseButton
                type="button"
                variant="secondary"
                onClick={() => setSelectedRecord(null)}
              >
                Close
              </EnterpriseButton>
              {selectedRecord.status !== 'RESOLVED' && (
                <EnterpriseButton
                  type="submit"
                  variant="primary"
                  loading={isSubmitting}
                >
                  Submit CAPA Sign-off
                </EnterpriseButton>
              )}
            </div>
          </form>
        </EnterpriseModal>
      )}

    </div>
  );
};

export default CompliancePage;
