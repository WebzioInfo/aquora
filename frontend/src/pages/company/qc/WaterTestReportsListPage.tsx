import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Droplets, 
  Plus, 
  Search, 
  Edit2, 
  Eye, 
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';

import PageContainer from '../../../components/ui/layout/PageContainer';
import PageHeader from '../../../components/ui/layout/PageHeader';
import { EnterpriseCard } from '../../../components/ui/EnterpriseCard';
import { EnterpriseInput } from '../../../components/ui/EnterpriseInput';
import { EnterpriseSelect } from '../../../components/ui/EnterpriseSelect';
import { EnterpriseTable, type ColumnDef } from '../../../components/ui/EnterpriseTable';
import { EnterpriseBadge } from '../../../components/ui/EnterpriseBadge';
import { EnterpriseButton } from '../../../components/ui/EnterpriseButton';

import { waterTestApi } from '../../../services/api/waterTest';
import type { WaterTestReport } from '../../../services/api/waterTest';

export const WaterTestReportsListPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isCompanyContext = location.pathname.startsWith('/company');
  const basePath = isCompanyContext ? '/company/qc/water-test' : '/qc/water-tests';

  // Filters & Pagination state
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize] = useState(15);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [reportType, setReportType] = useState('');
  const [status, setStatus] = useState('');

  // Debounce search input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPageNumber(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Query reports using React Query for automatic deduplication, caching & error boundaries
  const {
    data: reportsData,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['waterTestReports', { pageNumber, pageSize, search: debouncedSearch, reportType, status }],
    queryFn: async () => {
      const res = await waterTestApi.getReports({
        pageNumber,
        pageSize,
        search: debouncedSearch || undefined,
        type: reportType || undefined,
        status: status || undefined
      });
      return res.data;
    },
    staleTime: 10000,
    retry: 1
  });

  const reports = useMemo(() => reportsData?.items || [], [reportsData]);
  const totalCount = reportsData?.totalCount || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

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
          onClick={() => navigate(`${basePath}/${row.id}`)}
          className="font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
        >
          {row.reportNumber || row.id.substring(0, 8).toUpperCase()}
        </span>
      )
    },
    {
      id: 'batchNumber',
      header: 'Batch Number',
      accessorKey: 'batchNumber',
      cell: (row: WaterTestReport) => <span className="font-semibold text-slate-800">{row.batchNumber || '—'}</span>
    },
    {
      id: 'reportType',
      header: 'Report Type',
      accessorKey: 'reportType',
      cell: (row: WaterTestReport) => (
        <span className="text-slate-600 font-medium">{row.reportType || 'DAILY'}</span>
      )
    },
    {
      id: 'sampleTime',
      header: 'Sample Collection Time',
      accessorKey: 'sampleTime',
      cell: (row: WaterTestReport) => row.sampleTime ? format(new Date(row.sampleTime), 'dd MMM yyyy, hh:mm a') : (row.createdAt ? format(new Date(row.createdAt), 'dd MMM yyyy, hh:mm a') : '—')
    },
    {
      id: 'testedBy',
      header: 'Tested By',
      accessorKey: 'testedBy',
      cell: (row: WaterTestReport) => row.testedBy || row.createdByName || '—'
    },
    {
      id: 'status',
      header: 'Quality Status',
      accessorKey: 'status',
      cell: (row: WaterTestReport) => {
        let currentStatus = row.status === 'DRAFT' ? 'DRAFT' : 'PASS';
        if (row.results && row.results.length > 0 && row.status !== 'DRAFT') {
          if (row.results.some((r: any) => r.qualityStatus === 'FAIL')) currentStatus = 'FAIL';
          else if (row.results.some((r: any) => r.qualityStatus === 'WARNING')) currentStatus = 'WARNING';
        }
        return getStatusBadge(currentStatus);
      }
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (row: WaterTestReport) => (
        <div className="flex items-center justify-end gap-2">
          <EnterpriseButton
            variant="ghost"
            size="sm"
            onClick={() => navigate(`${basePath}/${row.id}`)}
          >
            <Eye className="w-4 h-4 mr-1.5" /> View
          </EnterpriseButton>
          <EnterpriseButton
            variant="secondary"
            size="sm"
            onClick={() => navigate(`${basePath}/${row.id}/edit`)}
          >
            <Edit2 className="w-4 h-4 mr-1.5" /> Edit
          </EnterpriseButton>
        </div>
      )
    }
  ];

  return (
    <PageContainer>
      {/* HEADER */}
      <PageHeader
        title="Water Test Reports"
        description="View, search, and manage all quality control laboratory test reports."
        actions={
          <button
            onClick={() => navigate(`${basePath}/new`)}
            className="h-[32px] px-3 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Water Test Report</span>
          </button>
        }
      />

      {/* Filter Bar */}
      <EnterpriseCard className="p-4 bg-white border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div className="md:col-span-2">
            <EnterpriseInput
              placeholder="Search by Report No, Batch, Analyst..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              icon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>
          <EnterpriseSelect
            value={reportType}
            onChange={(e) => {
              setReportType(e.target.value);
              setPageNumber(1);
            }}
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
            onChange={(e) => {
              setStatus(e.target.value);
              setPageNumber(1);
            }}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'DRAFT', label: 'Draft' },
              { value: 'SUBMITTED', label: 'Submitted' },
              { value: 'APPROVED', label: 'Approved' }
            ]}
          />
        </div>
      </EnterpriseCard>

      {/* Error Banner with Retry */}
      {isError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-rose-900 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>Unable to load water test reports. Please try again.</span>
          </div>
          <EnterpriseButton
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            className="border-rose-300 text-rose-800 hover:bg-rose-100"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5 inline-block" />
            Retry
          </EnterpriseButton>
        </div>
      )}

      {/* Reports Data Grid */}
      <EnterpriseCard className="overflow-hidden border border-slate-200 shadow-sm bg-white">
        <EnterpriseTable
          columns={columns}
          data={reports}
          loading={isLoading}
          emptyMessage="No water test reports found."
        />

        {/* Pagination Bar */}
        {!isLoading && totalCount > 0 && (
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-700">{((pageNumber - 1) * pageSize) + 1}</span> to{' '}
              <span className="font-semibold text-slate-700">{Math.min(pageNumber * pageSize, totalCount)}</span> of{' '}
              <span className="font-semibold text-slate-700">{totalCount}</span> reports
            </div>
            <div className="flex items-center gap-2">
              <EnterpriseButton
                variant="secondary"
                size="sm"
                disabled={pageNumber <= 1}
                onClick={() => setPageNumber(p => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Previous
              </EnterpriseButton>
              <span className="px-2 font-medium text-slate-600">
                Page {pageNumber} of {totalPages}
              </span>
              <EnterpriseButton
                variant="secondary"
                size="sm"
                disabled={pageNumber >= totalPages}
                onClick={() => setPageNumber(p => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </EnterpriseButton>
            </div>
          </div>
        )}
      </EnterpriseCard>
    </PageContainer>
  );
};

export default WaterTestReportsListPage;
