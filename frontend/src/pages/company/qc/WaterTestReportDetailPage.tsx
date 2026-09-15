import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { 
  Beaker, 
  FileText, 
  Edit2, 
  Printer, 
  Download,
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

import PageContainer from '../../../components/ui/layout/PageContainer';
import PageHeader from '../../../components/ui/layout/PageHeader';
import { EnterpriseCard } from '../../../components/ui/EnterpriseCard';
import { EnterpriseBadge } from '../../../components/ui/EnterpriseBadge';
import { EnterpriseButton } from '../../../components/ui/EnterpriseButton';
import { EnterpriseLoading } from '../../../components/ui/EnterpriseLoading';

import { waterTestApi } from '../../../services/api/waterTest';
import type { WaterTestReport } from '../../../services/api/waterTest';
import { useAuthStore } from '../../../store/useAuthStore';
import { generateWaterTestReportPDF } from '../../../utils/waterTestPdfEngine';
import { fetchGlobalCompanyProfileAsync } from '../../../utils/companyPdfHeader';
import type { PDFCompanyProfile } from '../../../utils/companyPdfHeader';

const PHYSICAL_CHEMICAL_ORDER = [
  'pH',
  'TDS',
  'Turbidity',
  'Sulphate',
  'Colour',
  'Odour',
  'Taste',
  'Residual Free Chlorine',
  'Alkalinity',
  'Chloride'
];

const MICROBIOLOGY_ORDER = [
  'E.coli',
  'Coliform',
  'Pseudomonas',
  'Clostridia',
  'Aerobic Microbial Count 22°C',
  'Aerobic Microbial Count 37°C',
  'Yeast & Mold'
];

import { isOwnerUser } from '../../../utils/permissions';

export const WaterTestReportDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const isOwner = isOwnerUser(user);

  const isCompanyContext = location.pathname.startsWith('/company');
  const basePath = isCompanyContext ? '/company/qc/water-test' : '/qc/water-tests';

  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [report, setReport] = useState<WaterTestReport | null>(null);
  const [companyProfile, setCompanyProfile] = useState<PDFCompanyProfile | null>(null);

  useEffect(() => {
    fetchGlobalCompanyProfileAsync().then(profile => setCompanyProfile(profile));
  }, []);

  const companyInfo = useMemo(() => ({
    name: companyProfile?.name || user?.companyName || user?.tenantName || 'AQUZIO ENTERPRISE',
    displayName: companyProfile?.displayName || user?.companyName || user?.tenantName || 'AQUZIO ENTERPRISE',
    address: companyProfile?.address,
    city: companyProfile?.city,
    state: companyProfile?.state,
    country: companyProfile?.country,
    pincode: companyProfile?.pincode,
    phone: companyProfile?.phone,
    email: companyProfile?.email,
    gstNumber: companyProfile?.gstNumber
  }), [companyProfile, user?.companyName, user?.tenantName]);

  const fetchReportDetails = async (reportId: string) => {
    setIsLoading(true);
    try {
      const res = await waterTestApi.getReportById(reportId);
      setReport(res.data);
    } catch (error) {
      toast.error('Failed to load water test report details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchReportDetails(id);
    }
  }, [id]);

  const physicalChemicalResults = useMemo(() => {
    if (!report?.results) return [];
    return [...report.results.filter(r => r.parameterCategory === 'PHYSICAL' || r.parameterCategory === 'CHEMICAL')].sort((a, b) => {
      const idxA = PHYSICAL_CHEMICAL_ORDER.findIndex(o => o.toLowerCase() === (a.parameterName || '').toLowerCase());
      const idxB = PHYSICAL_CHEMICAL_ORDER.findIndex(o => o.toLowerCase() === (b.parameterName || '').toLowerCase());
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return (a.parameterName || '').localeCompare(b.parameterName || '');
    });
  }, [report?.results]);

  const microResults = useMemo(() => {
    if (!report?.results) return [];
    return [...report.results.filter(r => r.parameterCategory === 'MICROBIOLOGY')].sort((a, b) => {
      const idxA = MICROBIOLOGY_ORDER.findIndex(o => o.toLowerCase() === (a.parameterName || '').toLowerCase());
      const idxB = MICROBIOLOGY_ORDER.findIndex(o => o.toLowerCase() === (b.parameterName || '').toLowerCase());
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return (a.parameterName || '').localeCompare(b.parameterName || '');
    });
  }, [report?.results]);

  const overallQualityStatus = useMemo(() => {
    if (!report) return 'DRAFT';
    if (report.status === 'DRAFT') return 'DRAFT';
    if (report.results && report.results.length > 0) {
      if (report.results.some(r => r.qualityStatus === 'FAIL')) return 'FAIL';
      if (report.results.some(r => r.qualityStatus === 'WARNING')) return 'WARNING';
      return 'PASS';
    }
    return report.status;
  }, [report]);

  const handleDownloadPdf = async () => {
    if (!report) return;
    setIsDownloadingPdf(true);
    try {
      const doc = generateWaterTestReportPDF({
        report,
        company: companyInfo
      });
      const fileReportNo = report.reportNumber || report.id.substring(0, 8).toUpperCase();
      doc.save(`Water_Test_Report_${fileReportNo}.pdf`);
      toast.success('Water Test Report PDF generated successfully');
    } catch (error) {
      console.error('Frontend PDF generation failed, falling back to backend PDF endpoint', error);
      try {
        const res = await waterTestApi.downloadReportPdf(report.id);
        const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Water_Test_Report_${report.reportNumber || report.id.substring(0, 8).toUpperCase()}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        toast.success('Water Test Report PDF downloaded successfully');
      } catch (backendErr) {
        toast.error('Unable to generate the water test report PDF.');
      }
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handlePrintPdf = () => {
    if (!report) return;
    try {
      const doc = generateWaterTestReportPDF({
        report,
        company: companyInfo
      });
      doc.autoPrint();
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(blobUrl, '_blank');
      if (printWindow) {
        printWindow.focus();
      }
    } catch (error) {
      window.print();
    }
  };

  const getStatusBadge = (statusStr?: string | null) => {
    if (!statusStr || statusStr === 'NOT_ENTERED' || statusStr === 'Not Entered' || statusStr === '—') {
      return <span className="text-slate-400 font-medium text-xs italic">—</span>;
    }
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

  // ALL HOOKS EXECUTED ABOVE - Early Returns below:
  if (isLoading) {
    return (
      <PageContainer>
        <div className="p-8 flex items-center justify-center">
          <EnterpriseLoading label="Loading water test report..." />
        </div>
      </PageContainer>
    );
  }

  if (!report) {
    return (
      <PageContainer>
        <div className="p-8 text-center space-y-4">
          <p className="text-slate-500">Report not found.</p>
          <EnterpriseButton variant="secondary" onClick={() => navigate(basePath)}>
            Back to Reports
          </EnterpriseButton>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* HEADER */}
      <div className="print:hidden">
        <PageHeader
          title={`Water Test Report #${report.reportNumber}`}
          description={`Batch Number: ${report.batchNumber} | Created: ${format(new Date(report.createdAt), 'dd MMM yyyy, hh:mm a')}`}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="h-[32px] px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" /> Export PDF
              </button>
              <button
                onClick={handlePrintPdf}
                className="h-[32px] px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <Printer className="w-3.5 h-3.5" /> Print Certificate
              </button>
              {!isOwner && (
                <button
                  onClick={() => navigate(`${basePath}/${report.id}/edit`)}
                  className="h-[32px] px-3 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit Report
                </button>
              )}
            </div>
          }
        />
      </div>

      {/* Main Report Details */}
      <EnterpriseCard className="p-8 space-y-8 bg-white border border-slate-200 shadow-sm">
        
        {/* Meta Header */}
        <div className="flex flex-wrap justify-between items-start border-b border-slate-200 pb-6 gap-6">
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Enterprise Quality Compliance Certificate</span>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-1">Water Quality Test Analysis Report</h1>
            <p className="text-sm text-slate-500 mt-1">Laboratory compliance certificate for 20L Bottled Water Production.</p>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(overallQualityStatus)}
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
                      {r.stringValue ? r.stringValue : (r.value !== null && r.value !== undefined ? r.value : '—')}
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
                      {r.stringValue ? r.stringValue : (r.value !== null && r.value !== undefined ? r.value : '—')}
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

    </PageContainer>
  );
};

export default WaterTestReportDetailPage;
