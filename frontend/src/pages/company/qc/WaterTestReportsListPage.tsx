import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Beaker, 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Eye, 
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle
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

import { waterTestApi } from '../../../services/api/waterTest';
import type { WaterTestReport } from '../../../services/api/waterTest';

export const WaterTestReportsListPage: React.FC = () => {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [reports, setReports] = useState<WaterTestReport[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [reportType, setReportType] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetchReports();
  }, [pageNumber, search, reportType, status]);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const res = await waterTestApi.getReports({
        pageNumber,
        pageSize,
        search: search.trim() || undefined,
        type: reportType || undefined,
        status: status || undefined
      });
      setReports(res.data.items);
      setTotalCount(res.data.totalCount);
    } catch (error) {
      toast.error('Failed to load water test reports');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (statusStr: string) => {
    switch (statusStr) {
      case 'PASS':
      case 'APPROVED':
        return <EnterpriseBadge variant="success">Passed</EnterpriseBadge>;
      case 'WARNING':
        return <EnterpriseBadge variant="warning">Warning</EnterpriseBadge>;
      case 'FAIL':
        return <EnterpriseBadge variant="danger">Failed</EnterpriseBadge>;
      case 'DRAFT':
        return <EnterpriseBadge variant="gray">Draft</EnterpriseBadge>;
      case 'SUBMITTED':
        return <EnterpriseBadge variant="info">Submitted</EnterpriseBadge>;
      default:
        return <EnterpriseBadge variant="gray">{statusStr}</EnterpriseBadge>;
    }
  };

  const columns: ColumnDef<WaterTestReport>[] = [
    {
      id: 'reportNumber',
      header: 'Report Number',
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
      id: 'reportType',
      header: 'Report Type',
      accessorKey: 'reportType'
    },
    {
      id: 'sampleTime',
      header: 'Sample Collection Time',
      accessorKey: 'sampleTime',
      cell: (row: WaterTestReport) => row.sampleTime ? format(new Date(row.sampleTime), 'dd MMM yyyy, hh:mm a') : '—'
    },
    {
      id: 'testedBy',
      header: 'Tested By',
      accessorKey: 'testedBy',
      cell: (row: WaterTestReport) => row.testedBy || '—'
    },
    {
      id: 'status',
      header: 'Quality Status',
      accessorKey: 'status',
      cell: (row: WaterTestReport) => getStatusBadge(row.status)
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
          <EnterpriseButton
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/qc/water-tests/${row.id}/edit`)}
          >
            <Edit2 className="w-4 h-4 mr-1.5" /> Edit
          </EnterpriseButton>
        </div>
      )
    }
  ];

  return (
    <div className="p-8 space-y-6 pb-32 max-w-[1600px] mx-auto">
      
      {/* Breadcrumb & Header */}
      <div className="space-y-2">
        <nav className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
          <Link to="/qc/dashboard" className="hover:text-slate-900 transition-colors">Quality Control</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-900 font-semibold">Water Test Reports</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <EnterpriseHeader
            title="Water Test Reports"
            description="View, search, and manage all quality control laboratory test reports."
          />

          <EnterpriseButton
            variant="primary"
            onClick={() => navigate('/qc/water-tests/new')}
          >
            <Plus className="w-4 h-4 mr-2" /> Create Water Test Report
          </EnterpriseButton>
        </div>
      </div>

      {/* Filter Bar */}
      <EnterpriseCard className="p-4 bg-white border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div className="md:col-span-2">
            <EnterpriseInput
              placeholder="Search by Report No, Batch, Analyst..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>
          <EnterpriseSelect
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            options={[
              { value: '', label: 'All Report Types' },
              { value: 'DAILY', label: 'Daily Routine' },
              { value: 'WEEKLY', label: 'Weekly Analysis' },
              { value: 'MONTHLY', label: 'Monthly Deep Test' },
              { value: 'QUARTERLY', label: 'Quarterly Lab Test' }
            ]}
          />
          <EnterpriseSelect
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'DRAFT', label: 'Draft' },
              { value: 'SUBMITTED', label: 'Submitted' },
              { value: 'APPROVED', label: 'Approved' }
            ]}
          />
        </div>
      </EnterpriseCard>

      {/* Reports Data Grid */}
      <EnterpriseCard className="overflow-hidden border border-slate-200 shadow-sm bg-white">
        <EnterpriseTable
          columns={columns}
          data={reports}
          loading={isLoading}
          emptyMessage="No water test reports found."
        />
      </EnterpriseCard>

    </div>
  );
};

export default WaterTestReportsListPage;
