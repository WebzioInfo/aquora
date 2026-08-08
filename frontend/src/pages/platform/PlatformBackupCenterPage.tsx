import React, { useState, useEffect } from 'react';
import { 
  Server, Shield, Database, Plus, Loader2, Search, Eye, RotateCcw, 
  Trash2, AlertTriangle, CheckCircle2, XCircle, ArrowDownToLine,
  Activity, Archive, Layers, ShieldCheck, CheckSquare, Square, Lock, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import PageContainer from '../../components/ui/layout/PageContainer';
import PageHeader from '../../components/ui/layout/PageHeader';
import { 
  platformBackupsApi, 
  type PlatformBackupHistoryDto, 
  type PlatformBackupManifestDto, 
  type PlatformTenantListDto, 
  type PlatformRestorePreviewDto,
  type PlatformBackupJobStatusDto,
  type PlatformSchemaPreviewDto
} from '../../services/api/platformBackups';

const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export const PlatformBackupCenterPage: React.FC = () => {
  const [history, setHistory] = useState<PlatformBackupHistoryDto[]>([]);
  const [tenants, setTenants] = useState<PlatformTenantListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Backup Mode Selection
  const [backupMode, setBackupMode] = useState<'FULL_PLATFORM' | 'SINGLE_TENANT' | 'MULTIPLE_TENANT' | 'PUBLIC_ONLY'>('FULL_PLATFORM');
  const [selectedSingleTenantId, setSelectedSingleTenantId] = useState<string>('');
  const [selectedMultiTenantIds, setSelectedMultiTenantIds] = useState<string[]>([]);
  const [backupNotes, setBackupNotes] = useState<string>('');

  // Active Background Job
  const [activeJob, setActiveJob] = useState<PlatformBackupJobStatusDto | null>(null);

  // Modals
  const [inspectionData, setInspectionData] = useState<PlatformBackupManifestDto | null>(null);
  const [restorePreviewData, setRestorePreviewData] = useState<PlatformRestorePreviewDto | null>(null);
  const [confirmationText, setConfirmationText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Schema Preview State
  const [previewData, setPreviewData] = useState<PlatformSchemaPreviewDto | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedPreviewTable, setSelectedPreviewTable] = useState<string>('');
  const [tableSearchQuery, setTableSearchQuery] = useState('');

  const handleOpenSchemaPreview = async (backupId: string, schemaName: string) => {
    try {
      setPreviewLoading(true);
      setTableSearchQuery('');
      const data = await platformBackupsApi.getSchemaPreview(backupId, schemaName);
      setPreviewData(data);
      if (data.tableNames && data.tableNames.length > 0) {
        setSelectedPreviewTable(data.tableNames[0]);
      } else {
        setSelectedPreviewTable('');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load schema preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [historyData, tenantData] = await Promise.all([
        platformBackupsApi.getHistory(),
        platformBackupsApi.getTenants()
      ]);
      setHistory(historyData);
      setTenants(tenantData);
      if (tenantData.length > 0 && !selectedSingleTenantId) {
        setSelectedSingleTenantId(tenantData[0].tenantId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load platform backup data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Poll Active Background Job
  useEffect(() => {
    if (!activeJob || activeJob.status === 'Completed' || activeJob.status === 'Failed') return;

    const interval = setInterval(async () => {
      try {
        const updated = await platformBackupsApi.getJobStatus(activeJob.jobId);
        setActiveJob(updated);

        if (updated.status === 'Completed') {
          await loadData();
        }
      } catch (err) {
        console.error('Job status polling error', err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeJob]);

  const handleStartBackup = async () => {
    try {
      setActionLoading(true);
      setError(null);

      const job = await platformBackupsApi.createBackup({
        mode: backupMode,
        targetTenantId: backupMode === 'SINGLE_TENANT' ? selectedSingleTenantId : undefined,
        selectedTenantIds: backupMode === 'MULTIPLE_TENANT' ? selectedMultiTenantIds : undefined,
        notes: backupNotes || `Platform Backup (${backupMode})`,
        encrypted: true
      });

      setActiveJob(job);
    } catch (err: any) {
      setError(err.message || 'Failed to start backup job');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownload = async (id: string, backupName: string) => {
    try {
      setActionLoading(true);
      await platformBackupsApi.downloadBackup(id, backupName);
    } catch (err: any) {
      setError(err.message || 'Failed to download platform backup');
    } finally {
      setActionLoading(false);
    }
  };

  const handleInspect = async (id: string) => {
    try {
      setActionLoading(true);
      const manifest = await platformBackupsApi.inspectBackup(id);
      setInspectionData(manifest);
    } catch (err: any) {
      setError(err.message || 'Failed to inspect platform backup manifest');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePreviewRestore = async (id: string) => {
    try {
      setActionLoading(true);
      const preview = await platformBackupsApi.restorePreview(id);
      setRestorePreviewData(preview);
      setConfirmationText('');
    } catch (err: any) {
      setError(err.message || 'Failed to preview platform restore');
    } finally {
      setActionLoading(false);
    }
  };

  const executeRestore = async () => {
    if (!restorePreviewData || confirmationText.trim().toUpperCase() !== 'RESTORE') return;
    try {
      setActionLoading(true);
      await platformBackupsApi.restoreBackup(restorePreviewData.backupId, 'RESTORE', restorePreviewData.mode, restorePreviewData.targetSchemas);
      alert('Platform restore completed successfully.');
      setRestorePreviewData(null);
      await loadData();
    } catch (err: any) {
      alert(`RESTORE FAILED: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this platform backup archive? This action is permanent.')) return;
    try {
      setActionLoading(true);
      await platformBackupsApi.deleteBackup(id);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete backup');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleTenantSelection = (tenantId: string) => {
    setSelectedMultiTenantIds(prev => 
      prev.includes(tenantId) ? prev.filter(id => id !== tenantId) : [...prev, tenantId]
    );
  };

  const filteredHistory = history.filter(b => 
    b.backupName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    b.mode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.checksum.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <PageContainer>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader 
        title="Disaster Recovery & Platform Backup Center"
        description="AWS RDS / Enterprise style full platform snapshots, schema dumps, and disaster recovery."
        icon={Server}
      />

      {error && (
        <div className="p-3.5 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 border border-red-100 text-xs font-semibold shadow-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* BACKGROUND JOB WIDGET */}
      {activeJob && (
        <div className={`p-4 rounded-xl border shadow-sm transition-all ${
          activeJob.status === 'Completed' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
          activeJob.status === 'Failed' ? 'bg-red-50 border-red-200 text-red-900' :
          'bg-blue-50 border-blue-200 text-blue-900'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              {activeJob.status === 'Completed' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> :
               activeJob.status === 'Failed' ? <XCircle className="w-5 h-5 text-red-600" /> :
               <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />}
              <span>Platform Backup Job ({activeJob.mode})</span>
            </div>
            <span className="text-xs font-mono font-bold">{activeJob.progressPercentage}%</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden mb-2">
            <div 
              className={`h-full transition-all duration-300 ${
                activeJob.status === 'Completed' ? 'bg-emerald-600' :
                activeJob.status === 'Failed' ? 'bg-red-600' : 'bg-blue-600'
              }`}
              style={{ width: `${activeJob.progressPercentage}%` }}
            />
          </div>

          <p className="text-xs font-medium opacity-90">{activeJob.currentStepMessage}</p>
        </div>
      )}

      {/* BACKUP MODE SELECTOR & GENERATION CARD */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600" /> Create Platform Backup Snapshot
          </h3>
          <span className="text-xs text-slate-400 font-medium">Enterprise Engine v2.5.0</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => setBackupMode('FULL_PLATFORM')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              backupMode === 'FULL_PLATFORM'
                ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Server className={`w-4 h-4 ${backupMode === 'FULL_PLATFORM' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">RECOMMENDED</span>
            </div>
            <div className="font-bold text-xs text-slate-900">Full Platform</div>
            <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">Public schema + ALL tenant schemas + manifest ZIP</div>
          </button>

          <button
            onClick={() => setBackupMode('SINGLE_TENANT')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              backupMode === 'SINGLE_TENANT'
                ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <Database className={`w-4 h-4 mb-1.5 ${backupMode === 'SINGLE_TENANT' ? 'text-blue-600' : 'text-slate-400'}`} />
            <div className="font-bold text-xs text-slate-900">Single Tenant</div>
            <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">Export isolated company schema</div>
          </button>

          <button
            onClick={() => setBackupMode('MULTIPLE_TENANT')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              backupMode === 'MULTIPLE_TENANT'
                ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <Layers className={`w-4 h-4 mb-1.5 ${backupMode === 'MULTIPLE_TENANT' ? 'text-blue-600' : 'text-slate-400'}`} />
            <div className="font-bold text-xs text-slate-900">Multiple Tenants</div>
            <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">Checkbox selection of tenant schemas</div>
          </button>

          <button
            onClick={() => setBackupMode('PUBLIC_ONLY')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              backupMode === 'PUBLIC_ONLY'
                ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <ShieldCheck className={`w-4 h-4 mb-1.5 ${backupMode === 'PUBLIC_ONLY' ? 'text-blue-600' : 'text-slate-400'}`} />
            <div className="font-bold text-xs text-slate-900">Public Only</div>
            <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">System global config & user identity</div>
          </button>
        </div>

        {/* Dynamic Options depending on mode */}
        {backupMode === 'SINGLE_TENANT' && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Select Target Company Tenant:</label>
            <select
              value={selectedSingleTenantId}
              onChange={e => setSelectedSingleTenantId(e.target.value)}
              className="w-full sm:w-80 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {tenants.map(t => (
                <option key={t.tenantId} value={t.tenantId}>
                  {t.companyName} ({t.schemaName})
                </option>
              ))}
            </select>
          </div>
        )}

        {backupMode === 'MULTIPLE_TENANT' && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <label className="block text-xs font-bold text-slate-700">Select Target Tenants ({selectedMultiTenantIds.length} Selected):</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
              {tenants.map(t => {
                const isChecked = selectedMultiTenantIds.includes(t.tenantId);
                return (
                  <button
                    key={t.tenantId}
                    onClick={() => toggleTenantSelection(t.tenantId)}
                    className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium border text-left transition-colors ${
                      isChecked ? 'bg-blue-100/70 border-blue-300 text-blue-900' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {isChecked ? <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" /> : <Square className="w-4 h-4 text-slate-400 shrink-0" />}
                    <span className="truncate">{t.companyName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <input 
            type="text" 
            placeholder="Backup notes / description (optional)..."
            value={backupNotes}
            onChange={e => setBackupNotes(e.target.value)}
            className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none w-full"
          />
          <button
            onClick={handleStartBackup}
            disabled={actionLoading || (activeJob?.status !== 'Completed' && activeJob?.status !== 'Failed' && activeJob !== null)}
            className="w-full sm:w-auto px-5 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 whitespace-nowrap"
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Initiate {backupMode.replace('_', ' ')} Backup
          </button>
        </div>
      </div>

      {/* PLATFORM BACKUP HISTORY TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[380px]">
        <div className="px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
            <Archive className="w-4 h-4 text-blue-500" /> Platform Backup History
          </h3>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search backups..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors w-full sm:w-64"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 whitespace-nowrap">
              <tr>
                <th className="px-4 py-2.5">Backup Name & Mode</th>
                <th className="px-4 py-2.5">Created Date & By</th>
                <th className="px-4 py-2.5">Size & Format</th>
                <th className="px-4 py-2.5">Schemas & Tenants</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHistory && filteredHistory.length > 0 ? (
                filteredHistory.map((backup) => (
                  <tr key={backup.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 min-w-[200px]">
                      <div className="font-semibold text-slate-900 mb-0.5 flex items-center gap-1.5">
                        {backup.backupName}
                      </div>
                      <div className="text-[11px] text-slate-500 line-clamp-1" title={backup.description}>
                        {backup.description}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-slate-900 font-medium">{format(new Date(backup.createdAt), 'MMM d, yyyy HH:mm')}</div>
                      <div className="text-[10px] text-slate-400">By {backup.createdByName || 'SuperAdmin'}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-slate-900 font-medium">{backup.formattedSize}</div>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold tracking-wider border mt-0.5 inline-block bg-blue-50 text-blue-700 border-blue-200">
                        {backup.format}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-slate-900 font-medium">{backup.schemaCount || 1} Schemas</div>
                      <div className="text-[10px] text-slate-400">{backup.tenantCount || 0} Tenants</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {backup.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => handleInspect(backup.id)}
                          className="p-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          title="Inspect Manifest"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDownload(backup.id, backup.backupName)}
                          className="p-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                          title="Download ZIP Archive"
                        >
                          <ArrowDownToLine className="w-3.5 h-3.5 text-blue-600" />
                        </button>
                        <button 
                          onClick={() => handlePreviewRestore(backup.id)}
                          className="p-1.5 bg-white border border-slate-200 text-amber-600 rounded-lg hover:bg-amber-50 transition-colors"
                          title="Restore Platform Snapshot"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(backup.id)}
                          className="p-1.5 bg-white border border-slate-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          title="Delete Backup"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <Archive className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <h3 className="text-sm font-bold text-slate-900">No Platform Backups Found</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">Create a full platform snapshot to protect all tenant schemas and system configuration.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MANIFEST INSPECT MODAL */}
      {inspectionData && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Eye className="w-5 h-5" /></div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Platform Manifest Inspector</h3>
                  <p className="text-xs text-slate-500">{inspectionData.backupName}</p>
                </div>
              </div>
              <button onClick={() => setInspectionData(null)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full transition-colors"><XCircle className="w-5 h-5" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50 space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Platform & DB Version</div>
                  <div className="font-bold text-slate-900 text-xs">{inspectionData.platformVersion} ({inspectionData.databaseVersion})</div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Created By Machine</div>
                  <div className="font-bold text-slate-900 text-xs">{inspectionData.createdByName} @ {inspectionData.createdMachine}</div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Totals</div>
                  <div className="font-bold text-slate-900 text-xs">{inspectionData.schemaCount} Schemas, {inspectionData.totalRecords?.toLocaleString()} Records</div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Database Size</div>
                  <div className="font-bold text-slate-900 text-xs">{inspectionData.formattedDatabaseSize}</div>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-xs space-y-1">
                <div><span className="text-slate-400 font-semibold">Checksum (SHA256):</span> <span className="font-mono text-slate-800">{inspectionData.checksum}</span></div>
              </div>

              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 pt-2">
                <Layers className="w-4 h-4 text-slate-400" /> Included Schemas 
                <span className="bg-slate-200 text-slate-700 py-0.5 px-2 rounded-full text-[10px] font-semibold">
                  {inspectionData.schemas?.length || 0}
                </span>
              </h4>
              
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="px-4 py-2.5">Schema Name</th>
                      <th className="px-4 py-2.5">SQL File Path</th>
                      <th className="px-4 py-2.5 text-right">Tables</th>
                      <th className="px-4 py-2.5 text-right">Records</th>
                      <th className="px-4 py-2.5 text-right">Size</th>
                      <th className="px-4 py-2.5 text-center">Preview</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inspectionData.schemas?.map(s => (
                      <tr key={s.schemaName} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 font-bold text-slate-800">{s.schemaName}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-500">{s.sqlFileName}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-700">{s.tablesCount}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-700">{s.recordsCount.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{s.formattedSize}</td>
                        <td className="px-4 py-2.5 text-center">
                          <button
                            onClick={() => handleOpenSchemaPreview(inspectionData.backupId, s.schemaName)}
                            disabled={previewLoading}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                          >
                            <Eye className="w-3.5 h-3.5" /> Preview
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCHEMA PREVIEW MODAL */}
      {previewData && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">{previewData.schemaName}</h3>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Read Only
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">100 Row Data Preview Inspector</p>
                </div>
              </div>
              <button onClick={() => setPreviewData(null)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-4">
              {!previewData.isPreviewAvailable ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center space-y-3">
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-amber-900 text-base">Preview Unavailable</h4>
                  <p className="text-xs text-amber-700 max-w-md mx-auto">
                    {previewData.message || "This backup was created with an older version and does not include preview data."}
                  </p>
                </div>
              ) : (
                <>
                  {/* Table Selector & Search Controls */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">Choose Table:</label>
                      <select
                        value={selectedPreviewTable}
                        onChange={(e) => setSelectedPreviewTable(e.target.value)}
                        className="flex-1 max-w-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {previewData.tableNames.map(t => (
                          <option key={t} value={t}>
                            {t} ({previewData.tablesData[t]?.length || 0} rows)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="relative w-full md:w-64">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search loaded rows..."
                        value={tableSearchQuery}
                        onChange={(e) => setTableSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Data Grid */}
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col max-h-[50vh]">
                    {(() => {
                      const rows = previewData.tablesData[selectedPreviewTable] || [];
                      const filteredRows = rows.filter(r => 
                        !tableSearchQuery || Object.values(r).some(val => 
                          String(val || '').toLowerCase().includes(tableSearchQuery.toLowerCase())
                        )
                      );

                      if (rows.length === 0) {
                        return (
                          <div className="p-12 text-center text-slate-400 text-xs font-medium">
                            No records found in table "{selectedPreviewTable}".
                          </div>
                        );
                      }

                      if (filteredRows.length === 0) {
                        return (
                          <div className="p-12 text-center text-slate-400 text-xs font-medium">
                            No rows matching "{tableSearchQuery}".
                          </div>
                        );
                      }

                      const columns = Object.keys(rows[0] || {});

                      return (
                        <div className="overflow-x-auto overflow-y-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0 z-10">
                              <tr>
                                {columns.map(col => (
                                  <th key={col} className="px-4 py-2.5 whitespace-nowrap bg-slate-50 font-bold border-r border-slate-100 last:border-0">
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                              {filteredRows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                                  {columns.map(col => (
                                    <td key={col} className="px-4 py-2 border-r border-slate-100 last:border-0 text-slate-700 max-w-xs truncate" title={String(row[col] ?? '')}>
                                      {row[col] === null ? (
                                        <span className="text-slate-300 italic font-sans text-[10px]">null</span>
                                      ) : typeof row[col] === 'boolean' ? (
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-bold ${row[col] ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                          {row[col] ? 'Yes' : 'No'}
                                        </span>
                                      ) : (
                                        String(row[col])
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Footer Bar */}
                  <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
                    <div className="font-semibold text-slate-700">
                      Showing {selectedPreviewTable ? (previewData.tablesData[selectedPreviewTable]?.length || 0) : 0} rows (limited to 100 max per table)
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400">
                      <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5 text-blue-500" /> Preview Only</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Lock className="w-3.5 h-3.5 text-emerald-500" /> Read Only</span>
                      <span>•</span>
                      <span>Data cannot be modified</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RESTORE PREVIEW MODAL */}
      {restorePreviewData && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50 p-4 backdrop-blur-md">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden border-2 border-red-500">
            <div className="px-6 py-4 border-b border-red-100 bg-red-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-red-700">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="font-bold text-lg">Restore Platform Snapshot</h3>
              </div>
              <button onClick={() => setRestorePreviewData(null)} className="text-red-400 hover:text-red-700 p-1.5 rounded-full transition-colors"><XCircle className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 bg-white space-y-6">
              {restorePreviewData.warnings.map((w, i) => (
                <div key={i} className="p-3 bg-rose-50 text-rose-800 rounded-xl flex gap-3 border border-rose-200 text-xs items-start">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
                  <p className="font-semibold">{w}</p>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-6">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 border-b border-slate-200 pb-2 flex items-center justify-between">
                    Current Active <Database className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="space-y-2 text-xs">
                    <div><span className="text-slate-500">Schemas:</span> <strong className="text-slate-900">{restorePreviewData.currentActiveSchemas}</strong></div>
                    <div><span className="text-slate-500">Records:</span> <strong className="text-slate-900">{restorePreviewData.currentActiveRecords?.toLocaleString()}</strong></div>
                  </div>
                </div>
                
                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200">
                  <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3 border-b border-blue-200 pb-2 flex items-center justify-between">
                    Backup Snapshot <Shield className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="space-y-2 text-xs">
                    <div><span className="text-blue-800">Schemas:</span> <strong className="text-blue-900">{restorePreviewData.backupSchemas}</strong></div>
                    <div><span className="text-blue-800">Records:</span> <strong className="text-blue-900">{restorePreviewData.backupRecords?.toLocaleString()}</strong></div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  To confirm restore, type <span className="text-red-700 bg-red-100 px-1.5 py-0.5 rounded font-mono">RESTORE</span>:
                </label>
                <input 
                  type="text" 
                  value={confirmationText}
                  onChange={e => setConfirmationText(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:outline-none focus:border-red-500 font-mono text-center tracking-[0.2em] uppercase text-base transition-all placeholder:tracking-normal placeholder:font-sans placeholder:text-slate-400 placeholder:text-xs"
                  placeholder="Type RESTORE to confirm"
                  autoFocus
                />
              </div>
            </div>
            
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setRestorePreviewData(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 bg-slate-200/50 rounded-xl font-semibold text-xs transition-colors">Cancel</button>
              <button 
                onClick={executeRestore} 
                disabled={confirmationText.trim().toUpperCase() !== 'RESTORE' || actionLoading}
                className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold text-xs hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer disabled:cursor-not-allowed"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                EXECUTE PLATFORM RESTORE
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default PlatformBackupCenterPage;
