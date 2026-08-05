import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { 
  Beaker, 
  FileText, 
  Edit2, 
  Printer, 
  Download,
  ChevronRight, 
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  User,
  FlaskConical,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '../../../utils/toast';

import { EnterpriseHeader } from '../../../components/ui/EnterpriseHeader';
import { EnterpriseCard } from '../../../components/ui/EnterpriseCard';
import { EnterpriseBadge } from '../../../components/ui/EnterpriseBadge';
import { EnterpriseButton } from '../../../components/ui/EnterpriseButton';
import { EnterpriseLoading } from '../../../components/ui/EnterpriseLoading';

import { waterTestApi } from '../../../services/api/waterTest';
import type { WaterTestReport } from '../../../services/api/waterTest';

export const WaterTestReportDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [report, setReport] = useState<WaterTestReport | null>(null);

  useEffect(() => {
    if (id) {
      fetchReport();
    }
  }, [id]);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      if (id) {
        const { data } = await waterTestApi.getReportById(id);
        setReport(data);
      }
    } catch (error) {
      toast.error('Failed to load report details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!report) return;
    setIsDownloadingPdf(true);
    try {
      const res = await waterTestApi.downloadReportPdf(report.id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `QC_Certificate_${report.reportNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Certificate PDF downloaded successfully.');
    } catch (error) {
      toast.error('Failed to download Certificate PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
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
        return <EnterpriseBadge variant="gray">{status}</EnterpriseBadge>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <EnterpriseLoading label="Loading water test report..." />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-slate-500">Report not found.</p>
        <EnterpriseButton variant="secondary" onClick={() => navigate('/qc/water-tests')}>
          Back to Reports
        </EnterpriseButton>
      </div>
    );
  }

  const physicalChemicalResults = report.results?.filter(r => r.parameterCategory === 'PHYSICAL' || r.parameterCategory === 'CHEMICAL') || [];
  const microResults = report.results?.filter(r => r.parameterCategory === 'MICROBIOLOGY') || [];

  return (
    <div className="p-8 space-y-6 pb-32 max-w-[1400px] mx-auto print:p-0 print:space-y-4">
      
      {/* Breadcrumbs & Header */}
      <div className="space-y-2 print:hidden">
        <nav className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
          <Link to="/qc/dashboard" className="hover:text-slate-900 transition-colors">Quality Control</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link to="/qc/water-tests" className="hover:text-slate-900 transition-colors">Water Test Reports</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-900 font-semibold">{report.reportNumber}</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <EnterpriseHeader
            title={`Water Test Report #${report.reportNumber}`}
            description={`Batch Number: ${report.batchNumber} | Created: ${format(new Date(report.createdAt), 'dd MMM yyyy, hh:mm a')}`}
          />

          <div className="flex items-center gap-3">
            <EnterpriseButton
              variant="secondary"
              loading={isDownloadingPdf}
              onClick={handleDownloadPdf}
            >
              <Download className="w-4 h-4 mr-1.5" /> Export PDF
            </EnterpriseButton>

            <EnterpriseButton
              variant="secondary"
              onClick={() => window.print()}
            >
              <Printer className="w-4 h-4 mr-1.5" /> Print Certificate
            </EnterpriseButton>

            <EnterpriseButton
              variant="primary"
              onClick={() => navigate(`/qc/water-tests/${report.id}/edit`)}
            >
              <Edit2 className="w-4 h-4 mr-1.5" /> Edit Report
            </EnterpriseButton>
          </div>
        </div>
      </div>

      {/* Main Report Details */}
      <EnterpriseCard className="p-8 space-y-8 bg-white border border-slate-200 shadow-sm">
        
        {/* Meta Header */}
        <div className="flex flex-wrap justify-between items-start border-b border-slate-200 pb-6 gap-6">
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Aquora Enterprise Quality Certificate</span>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-1">Water Quality Test Analysis Report</h1>
            <p className="text-sm text-slate-500 mt-1">Laboratory compliance certificate for 20L Bottled Water Production.</p>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(report.status)}
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-slate-50 p-5 rounded-xl border border-slate-200/80">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Batch Number</span>
            <span className="text-sm font-bold text-slate-900">{report.batchNumber}</span>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Sample Number</span>
            <span className="text-sm font-semibold text-slate-800">{report.sampleNumber || '—'}</span>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Report Type</span>
            <span className="text-sm font-semibold text-slate-800">{report.reportType}</span>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Sample Time</span>
            <span className="text-sm font-semibold text-slate-800">
              {report.sampleTime ? format(new Date(report.sampleTime), 'dd MMM yyyy, hh:mm a') : '—'}
            </span>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Tested By</span>
            <span className="text-sm font-semibold text-slate-800">{report.testedBy || '—'}</span>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Verified By</span>
            <span className="text-sm font-semibold text-slate-800">{report.verifiedBy || '—'}</span>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Created By</span>
            <span className="text-sm font-semibold text-slate-800">{report.createdByName}</span>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Production Date</span>
            <span className="text-sm font-semibold text-slate-800">
              {report.productionDate ? format(new Date(report.productionDate), 'dd MMM yyyy') : '—'}
            </span>
          </div>
        </div>

        {/* Physical & Chemical Results Table */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-blue-600" />
            Physical & Chemical Analysis Results
          </h3>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold h-10">
                  <th className="py-3 px-4 font-semibold text-sm">Parameter Name</th>
                  <th className="py-3 px-4 font-semibold text-sm">Measured Value</th>
                  <th className="py-3 px-4 font-semibold text-sm">Unit</th>
                  <th className="py-3 px-4 font-semibold text-sm text-right">Quality Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {physicalChemicalResults.map(r => (
                  <tr key={r.id} className="h-11">
                    <td className="py-3 px-4 font-medium text-slate-900">{r.parameterName}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {r.stringValue || r.value || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-medium">{r.parameterUnit}</td>
                    <td className="py-3 px-4 text-right">{getStatusBadge(r.qualityStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Microbiological Results Table */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            Microbiological Analysis Results
          </h3>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold h-10">
                  <th className="py-3 px-4 font-semibold text-sm">Organism / Parameter</th>
                  <th className="py-3 px-4 font-semibold text-sm">Result</th>
                  <th className="py-3 px-4 font-semibold text-sm">Unit</th>
                  <th className="py-3 px-4 font-semibold text-sm text-right">Quality Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {microResults.map(r => (
                  <tr key={r.id} className="h-11">
                    <td className="py-3 px-4 font-medium text-slate-900">{r.parameterName}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {r.stringValue || r.value || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-medium">{r.parameterUnit}</td>
                    <td className="py-3 px-4 text-right">{getStatusBadge(r.qualityStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Remarks Section */}
        {report.remarks && (
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Analyst Remarks & Conclusion</h4>
            <p className="text-sm text-slate-800 whitespace-pre-line">{report.remarks}</p>
          </div>
        )}

      </EnterpriseCard>

    </div>
  );
};

export default WaterTestReportDetailPage;
