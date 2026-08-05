import React, { useState, useEffect } from 'react';
import { 
  Database, Download, RotateCcw, Trash2, Plus, Shield, AlertCircle,
  HardDrive, Clock, CheckCircle2, XCircle, Loader2, Search,
  Eye, RefreshCw, ChevronDown, AlertTriangle, TableProperties, Activity,
  Archive, ShieldCheck, ArrowDownToLine
} from 'lucide-react';
import { format } from 'date-fns';
import PageContainer from '../../components/ui/layout/PageContainer';
import PageHeader from '../../components/ui/layout/PageHeader';
import { 
  backupsApi, 
  type BackupDashboardDto, 
  type BackupInspectionDto, 
  type TableDataPreviewDto, 
  type RestorePreviewDto 
} from '../../services/api/backups';

const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export const BackupRestorePage: React.FC = () => {
  const [dashboard, setDashboard] = useState<BackupDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  
  // Modals
  const [inspectionData, setInspectionData] = useState<BackupInspectionDto | null>(null);
  const [previewData, setPreviewData] = useState<TableDataPreviewDto | null>(null);
  const [restorePreviewData, setRestorePreviewData] = useState<RestorePreviewDto | null>(null);
  const [confirmationText, setConfirmationText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await backupsApi.getDashboard();
      setDashboard({
        ...data,
        recentBackups: (data.recentBackups || []).map((b: any) => ({
           ...b,
           backupName: b.backupName || b.fileName || 'Snapshot',
           description: b.description || 'Manual Backup',
           createdByName: b.createdByName || 'System',
           encryption: b.encryption || (b.isEncrypted ? 'AES-256' : 'None')
        }))
      });
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleCreateBackup = async (backupFormat: 'AQB' | 'SQL') => {
    setCreateMenuOpen(false);
    try {
      setActionLoading(true);
      setError(null);
      await backupsApi.createBackup({
        notes: `Manual ${backupFormat} Backup`,
        format: backupFormat
      });
      await fetchDashboard();
    } catch (err: any) {
      setError(err.message || 'Failed to create backup');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadBackup = async (id: string, backupName: string, backupFormat: string) => {
    setActiveActionMenu(null);
    try {
      setActionLoading(true);
      setError(null);
      await backupsApi.downloadBackup(id, backupName, backupFormat);
    } catch (err: any) {
      setError(err.message || 'Failed to download backup file');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBackup = async (id: string) => {
    setActiveActionMenu(null);
    if (!window.confirm('Are you sure you want to delete this backup? This action cannot be undone.')) return;
    
    try {
      setActionLoading(true);
      setError(null);
      await backupsApi.deleteBackup(id);
      await fetchDashboard();
    } catch (err: any) {
      setError(err.message || 'Failed to delete backup');
    } finally {
      setActionLoading(false);
    }
  };

  const handleInspect = async (id: string) => {
    setActiveActionMenu(null);
    try {
      setActionLoading(true);
      setError(null);
      const data = await backupsApi.inspectBackup(id);
      setInspectionData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to inspect backup');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePreviewTable = async (backupId: string, tableName: string) => {
    try {
      const data = await backupsApi.inspectBackupTable(backupId, tableName);
      setPreviewData(data);
    } catch (err: any) {
      alert(err.message || 'Failed to preview table data');
    }
  };

  const handlePreviewRestore = async (id: string) => {
    setActiveActionMenu(null);
    try {
      setActionLoading(true);
      setError(null);
      const data = await backupsApi.restorePreview(id);
      setRestorePreviewData(data);
      setConfirmationText('');
    } catch (err: any) {
      setError(err.message || 'Failed to preview restore. Note: Only AQB format can be restored via UI.');
    } finally {
      setActionLoading(false);
    }
  };

  const executeRestore = async () => {
    if (!restorePreviewData || confirmationText !== 'RESTORE') return;
    
    try {
      setActionLoading(true);
      setError(null);
      await backupsApi.restoreBackup(restorePreviewData.backupId, 'RESTORE');
      alert('Restore completed successfully.');
      setRestorePreviewData(null);
      await fetchDashboard();
    } catch (err: any) {
      alert(`RESTORE FAILED: ${err.message}`);
      setError(err.message || 'Failed to restore backup');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredBackups = dashboard?.recentBackups.filter(b => 
    b.backupName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    b.format.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.description && b.description.toLowerCase().includes(searchQuery.toLowerCase()))
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
      {/* HEADER */}
      <PageHeader 
        title="Backup & Restore Center"
        description="Create, inspect, export and restore isolated company backups."
        icon={Database}
        actions={
          <div className="relative">
            <button
              onClick={() => setCreateMenuOpen(!createMenuOpen)}
              disabled={actionLoading || dashboard?.isBackupInProgress}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm active:scale-95"
            >
              {dashboard?.isBackupInProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Backup <ChevronDown className="w-4 h-4 ml-0.5" />
            </button>
            
            {createMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-20">
                <div className="p-2 space-y-1">
                  <button onClick={() => handleCreateBackup('AQB')} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg flex items-center gap-3 transition-colors">
                    <Shield className="w-5 h-5 text-blue-500 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-900">Aquora Backup (.aqb)</div>
                      <div className="text-xs text-slate-500">Recommended for Restore</div>
                    </div>
                  </button>
                  <div className="h-px bg-slate-100 my-1"></div>
                  <button onClick={() => handleCreateBackup('SQL')} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg flex items-center gap-3 transition-colors">
                    <Database className="w-5 h-5 text-purple-500 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-900">SQL Backup (.sql)</div>
                      <div className="text-xs text-slate-500">Open in PostgreSQL tools</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        }
      />

      {error && (
        <div className="p-3.5 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 border border-red-100 shadow-sm text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* KPI CARDS (5 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2.5 text-emerald-600 mb-2">
            <div className="p-1.5 bg-emerald-50 rounded-lg"><HardDrive className="w-4 h-4" /></div>
            <h3 className="font-semibold text-slate-500 text-xs">Storage Used</h3>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatBytes(dashboard?.storageUsedBytes || dashboard?.totalStorageBytes || 0)}</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2.5 text-blue-600 mb-2">
            <div className="p-1.5 bg-blue-50 rounded-lg"><Database className="w-4 h-4" /></div>
            <h3 className="font-semibold text-slate-500 text-xs">Total Backups</h3>
          </div>
          <p className="text-xl font-bold text-slate-900">{dashboard?.totalBackups || 0}</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2.5 text-purple-600 mb-2">
            <div className="p-1.5 bg-purple-50 rounded-lg"><RotateCcw className="w-4 h-4" /></div>
            <h3 className="font-semibold text-slate-500 text-xs">Restore Points</h3>
          </div>
          <p className="text-xl font-bold text-slate-900">{dashboard?.recentRestores?.length || 0}</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2.5 text-slate-600 mb-2">
            <div className="p-1.5 bg-slate-100 rounded-lg"><Clock className="w-4 h-4 text-slate-600" /></div>
            <h3 className="font-semibold text-slate-500 text-xs">Last Backup</h3>
          </div>
          <p className="text-sm font-bold text-slate-900 truncate">
            {dashboard?.lastBackup 
              ? format(new Date(dashboard.lastBackup.createdAt), 'MMM d, HH:mm')
              : 'Never'}
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2.5 text-indigo-600 mb-2">
            <div className="p-1.5 bg-indigo-50 rounded-lg"><Activity className="w-4 h-4" /></div>
            <h3 className="font-semibold text-slate-500 text-xs">Auto Backup</h3>
          </div>
          <p className="text-sm font-bold text-slate-900">
            {dashboard?.automaticBackupEnabled ? 'Enabled' : 'Disabled'}
          </p>
        </div>
      </div>

      {/* HISTORY TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[380px]">
        <div className="px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
            <Archive className="w-4 h-4 text-blue-500" /> Backup History
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
                <th className="px-4 py-2.5">Backup Name</th>
                <th className="px-4 py-2.5">Created</th>
                <th className="px-4 py-2.5">Created By</th>
                <th className="px-4 py-2.5">Size</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBackups && filteredBackups.length > 0 ? (
                filteredBackups.map((backup) => (
                  <tr key={backup.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 min-w-[180px]">
                      <div className="font-semibold text-slate-900 mb-0.5 flex items-center gap-1.5">
                        {backup.backupName}
                        {backup.isEncrypted && <span title={`Encrypted: ${backup.encryption}`}><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /></span>}
                      </div>
                      <div className="text-[11px] text-slate-500 line-clamp-1" title={backup.description}>
                        {backup.description}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700 font-medium">
                      {format(new Date(backup.createdAt), 'MMM d, yyyy HH:mm')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700 font-medium">
                      {backup.createdByName || 'System'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-slate-900 font-medium">{formatBytes(backup.sizeBytes || backup.backupSize || 0)}</div>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold tracking-wider border mt-0.5 inline-block ${
                        backup.format === 'AQB' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                      }`}>
                        {backup.format}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        backup.status === 'COMPLETED' || backup.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        backup.status === 'RESTORED' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {backup.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="relative inline-block text-left">
                        <button
                          onClick={() => setActiveActionMenu(activeActionMenu === backup.id ? null : backup.id)}
                          className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-xs font-medium flex items-center gap-1 ml-auto shadow-sm"
                        >
                          Actions <ChevronDown className="w-3 h-3 text-slate-400" />
                        </button>
                        
                        {activeActionMenu === backup.id && (
                          <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-20">
                            <div className="p-1 space-y-0.5">
                              <button 
                                onClick={() => handleDownloadBackup(backup.id, backup.backupName, backup.format)} 
                                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-md flex items-center gap-2 transition-colors font-medium"
                              >
                                <ArrowDownToLine className="w-3.5 h-3.5 text-blue-500" /> Download {backup.format}
                              </button>

                              {backup.format === 'AQB' && (
                                <button onClick={() => handleInspect(backup.id)} className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-md flex items-center gap-2 transition-colors font-medium">
                                  <Eye className="w-3.5 h-3.5" /> Inspect Backup
                                </button>
                              )}

                              {backup.format === 'AQB' && (
                                <button onClick={() => handlePreviewRestore(backup.id)} className="w-full text-left px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50 rounded-md flex items-center gap-2 transition-colors font-medium">
                                  <RotateCcw className="w-3.5 h-3.5" /> Restore Backup
                                </button>
                              )}

                              <div className="h-px bg-slate-100 my-0.5"></div>
                              <button onClick={() => handleDeleteBackup(backup.id)} className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-md flex items-center gap-2 transition-colors font-medium">
                                <Trash2 className="w-3.5 h-3.5" /> Delete Backup
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <Archive className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <h3 className="text-sm font-bold text-slate-900">No Backups Found</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">Create a backup to ensure safety and disaster recovery capability.</p>
                    <button onClick={() => setCreateMenuOpen(true)} className="mt-4 px-3 py-1.5 bg-blue-50 text-blue-700 font-semibold rounded-lg text-xs hover:bg-blue-100 transition-colors">
                      Create First Backup
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INSPECT MODAL */}
      {inspectionData && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Eye className="w-5 h-5" /></div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Backup Inspector</h3>
                  <p className="text-xs text-slate-500">{inspectionData.backupName}</p>
                </div>
              </div>
              <button onClick={() => setInspectionData(null)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full transition-colors"><XCircle className="w-5 h-5" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Tenant & Schema</div>
                  <div className="font-bold text-slate-900 text-xs truncate" title={`${inspectionData.tenantName} (${inspectionData.schemaName})`}>
                    {inspectionData.tenantName || inspectionData.schemaName}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Created By</div>
                  <div className="font-bold text-slate-900 text-xs">{inspectionData.createdByName || inspectionData.createdBy || 'System'}</div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Totals</div>
                  <div className="font-bold text-slate-900 text-xs">{inspectionData.totalTables} Tables, {inspectionData.totalRecords?.toLocaleString()} Records</div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">File Size & Encryption</div>
                  <div className="font-bold text-slate-900 text-xs">{inspectionData.formattedTotalSize} ({inspectionData.encryption || 'AES-256'})</div>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-wrap gap-4 text-xs font-medium text-slate-600">
                <div><span className="text-slate-400">Checksum (SHA256):</span> <span className="font-mono text-slate-800">{inspectionData.checksum?.substring(0, 16)}...</span></div>
                <div><span className="text-slate-400">Backup Version:</span> <span className="text-slate-800">{inspectionData.version || 'v2.5.0'}</span></div>
              </div>

              <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
                <Database className="w-4 h-4 text-slate-400" /> Tables Included 
                <span className="bg-slate-200 text-slate-700 py-0.5 px-2 rounded-full text-[10px] font-semibold">
                  {inspectionData.tables?.length || 0}
                </span>
              </h4>
              
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="px-4 py-2.5">Table Name</th>
                      <th className="px-4 py-2.5 text-right">Rows</th>
                      <th className="px-4 py-2.5 text-right">Estimated Size</th>
                      <th className="px-4 py-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inspectionData.tables?.map(t => (
                      <tr key={t.tableName} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-slate-800 flex items-center gap-2">
                          <TableProperties className="w-3.5 h-3.5 text-slate-400" /> {t.tableName}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-600">{t.rows?.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{t.formattedSize || 'N/A'}</td>
                        <td className="px-4 py-2.5 text-center">
                          <button 
                            onClick={() => handlePreviewTable(inspectionData.backupId, t.tableName)}
                            className="text-[11px] bg-white border border-slate-200 text-slate-600 px-2.5 py-1 rounded-md hover:bg-slate-50 hover:text-blue-600 font-medium transition-colors inline-flex items-center gap-1 shadow-sm"
                          >
                            <Eye className="w-3 h-3" /> Preview 100 Rows
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

      {/* TABLE DATA PREVIEW MODAL */}
      {previewData && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[75vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
              <h3 className="font-bold flex items-center gap-2 text-sm">
                <TableProperties className="w-4 h-4 text-blue-400" />
                Preview: <span className="text-blue-200 font-mono">{previewData.tableName}</span> 
                <span className="bg-blue-500/20 text-blue-200 px-2 py-0.5 rounded text-[10px] font-semibold ml-2 tracking-wider uppercase">100 Rows Max</span>
              </h3>
              <button onClick={() => setPreviewData(null)} className="text-slate-400 hover:text-white transition-colors"><XCircle className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-0 bg-slate-50">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-white text-slate-700 sticky top-0 shadow-sm z-10">
                  <tr>
                    {previewData.columns.map(c => <th key={c} className="px-4 py-2 font-semibold border-b border-r border-slate-200 bg-white">{c}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {previewData.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-blue-50/50">
                      {previewData.columns.map(c => (
                        <td key={c} className="px-4 py-2 border-r border-slate-100 text-slate-700 font-mono text-[11px] truncate max-w-[200px]" title={String(row[c])}>
                          {row[c] === null ? <span className="text-slate-300 italic">NULL</span> : 
                           typeof row[c] === 'boolean' ? <span className={row[c] ? 'text-emerald-600' : 'text-rose-600'}>{String(row[c])}</span> :
                           String(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
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
                <h3 className="font-bold text-lg">Restore Backup Snapshot</h3>
              </div>
              <button onClick={() => setRestorePreviewData(null)} className="text-red-400 hover:text-red-700 p-1.5 rounded-full transition-colors"><XCircle className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 bg-white space-y-6">
              <div className="p-3.5 bg-rose-50 text-rose-800 rounded-xl flex gap-3 border border-rose-200 text-xs items-start">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
                <div>
                  <p className="font-bold mb-0.5 text-sm">Warning: Transactional Data Replacement</p>
                  <p className="leading-relaxed opacity-90">
                    Restoring will replace active tenant tables with this backup snapshot. An emergency backup is generated automatically before proceeding.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 border-b border-slate-200 pb-2 flex items-center justify-between">
                    Current Data <Database className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Tables</div>
                      <div className="text-xl font-bold text-slate-900">{restorePreviewData.currentTables}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Total Records</div>
                      <div className="text-xl font-bold text-slate-900">{restorePreviewData.currentRecords?.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200">
                  <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3 border-b border-blue-200 pb-2 flex items-center justify-between">
                    Backup Snapshot <Shield className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] text-blue-800 font-medium">Tables</div>
                      <div className="text-xl font-bold text-blue-900">{restorePreviewData.backupTables}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-blue-800 font-medium">Total Records</div>
                      <div className="text-xl font-bold text-blue-900">{restorePreviewData.backupRecords?.toLocaleString()}</div>
                    </div>
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
                  className="w-full px-4 py-2 border-2 border-slate-300 rounded-xl focus:outline-none focus:border-red-500 font-mono text-center tracking-[0.2em] uppercase text-base transition-all"
                  placeholder="RESTORE"
                />
              </div>
            </div>
            
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setRestorePreviewData(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 bg-slate-200/50 rounded-xl font-semibold text-xs transition-colors">Cancel</button>
              <button 
                onClick={executeRestore} 
                disabled={confirmationText !== 'RESTORE' || actionLoading}
                className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold text-xs hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition-all shadow-sm active:scale-95"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                EXECUTE RESTORE
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default BackupRestorePage;
