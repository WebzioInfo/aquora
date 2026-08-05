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
  ShieldCheck
} from 'lucide-react';
import { toast } from '../../../utils/toast';
import { format } from 'date-fns';

import { EnterpriseHeader } from '../../../components/ui/EnterpriseHeader';
import { EnterpriseCard } from '../../../components/ui/EnterpriseCard';
import { EnterpriseTable, type ColumnDef } from '../../../components/ui/EnterpriseTable';
import { EnterpriseBadge } from '../../../components/ui/EnterpriseBadge';
import { EnterpriseButton } from '../../../components/ui/EnterpriseButton';
import { EnterpriseLoading } from '../../../components/ui/EnterpriseLoading';

import { waterTestApi } from '../../../services/api/waterTest';
import type { WaterTestDashboard, WaterTestReport } from '../../../services/api/waterTest';

export const QualityDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<WaterTestDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PASS':
        return <EnterpriseBadge variant="success">Passed</EnterpriseBadge>;
      case 'WARNING':
        return <EnterpriseBadge variant="warning">Warning</EnterpriseBadge>;
      case 'FAIL':
        return <EnterpriseBadge variant="danger">Failed</EnterpriseBadge>;
      case 'PENDING':
      case 'DRAFT':
        return <EnterpriseBadge variant="gray">Draft</EnterpriseBadge>;
      default:
        return <EnterpriseBadge variant="gray">{status}</EnterpriseBadge>;
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
      id: 'sampleTime',
      header: 'Sample Time',
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
      cell: (row: WaterTestReport) => {
        let status = row.status === 'DRAFT' ? 'DRAFT' : 'PASS';
        if (row.results && row.results.length > 0 && row.status !== 'DRAFT') {
          if (row.results.some((r: any) => r.qualityStatus === 'FAIL')) status = 'FAIL';
          else if (row.results.some((r: any) => r.qualityStatus === 'WARNING')) status = 'WARNING';
        }
        return getStatusBadge(status);
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

  if (isLoading) {
    return (
      <div className="p-8">
        <EnterpriseLoading label="Loading QC Dashboard..." />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 pb-32 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <EnterpriseHeader 
          title="Quality Control"
          description="Water testing, laboratory analysis, and quality compliance metrics"
        />
        
        <div className="flex items-center gap-3">
          <EnterpriseButton
            variant="primary"
            onClick={() => navigate('/qc/water-tests/new')}
          >
            <Plus className="w-4 h-4 mr-2" /> Create Water Test Report
          </EnterpriseButton>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <EnterpriseCard className="p-5 flex items-center gap-4 border-l-4 border-l-blue-500">
          <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Today's Reports</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold text-slate-900">{dashboard?.todayReports || 0}</h3>
              <span className="text-sm text-slate-400">/ {dashboard?.totalReports || 0} total</span>
            </div>
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-5 flex items-center gap-4 border-l-4 border-l-green-500">
          <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Passed Reports</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold text-slate-900">{dashboard?.passedReports || 0}</h3>
            </div>
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-5 flex items-center gap-4 border-l-4 border-l-red-500">
          <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <XCircle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Failed Reports</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold text-slate-900">{dashboard?.failedReports || 0}</h3>
            </div>
          </div>
        </EnterpriseCard>

        <EnterpriseCard className="p-5 flex items-center gap-4 border-l-4 border-l-amber-500">
          <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Draft / Pending Reports</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold text-slate-900">{dashboard?.pendingReports || 0}</h3>
            </div>
          </div>
        </EnterpriseCard>
      </div>

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
                <span className="text-slate-600">Draft/In-Progress</span>
                <span className="font-bold text-amber-600">{dashboard?.pendingReports || 0}</span>
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
    </div>
  );
};
