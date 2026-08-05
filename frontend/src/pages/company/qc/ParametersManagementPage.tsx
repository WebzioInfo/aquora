import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Sliders, 
  Plus, 
  Edit2, 
  ChevronRight, 
  FlaskConical, 
  Activity, 
  Search, 
  CheckCircle2 
} from 'lucide-react';
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
import type { WaterTestParameter } from '../../../services/api/waterTest';

export const ParametersManagementPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [parameters, setParameters] = useState<WaterTestParameter[]>([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');

  // Parameter Edit Modal State
  const [editingParam, setEditingParam] = useState<Partial<WaterTestParameter> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchParameters();
  }, []);

  const fetchParameters = async () => {
    setIsLoading(true);
    try {
      const res = await waterTestApi.getParameters();
      setParameters(res.data);
    } catch (error) {
      toast.error('Failed to load laboratory parameters');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveParameter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParam || !editingParam.name?.trim()) {
      toast.error('Parameter Name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await waterTestApi.saveParameter({
        id: editingParam.id,
        name: editingParam.name.trim(),
        category: editingParam.category || 'PHYSICAL',
        unit: editingParam.unit || '—',
        minAcceptable: editingParam.minAcceptable !== undefined && editingParam.minAcceptable !== null ? Number(editingParam.minAcceptable) : null,
        maxAcceptable: editingParam.maxAcceptable !== undefined && editingParam.maxAcceptable !== null ? Number(editingParam.maxAcceptable) : null,
      });
      toast.success(`Parameter '${editingParam.name}' saved successfully.`);
      setEditingParam(null);
      fetchParameters();
    } catch (error) {
      toast.error('Failed to save parameter');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredParameters = parameters.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    if (filterCategory !== 'ALL') return matchesSearch && p.category === filterCategory;
    return matchesSearch;
  });

  const columns: ColumnDef<WaterTestParameter>[] = [
    {
      id: 'name',
      header: 'Parameter Name',
      accessorKey: 'name',
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.category === 'MICROBIOLOGY' ? (
            <Activity className="w-4 h-4 text-emerald-600" />
          ) : (
            <FlaskConical className="w-4 h-4 text-blue-600" />
          )}
          <span className="font-semibold text-slate-900">{row.name}</span>
        </div>
      )
    },
    {
      id: 'category',
      header: 'Category',
      accessorKey: 'category',
      cell: (row) => (
        <EnterpriseBadge variant={row.category === 'MICROBIOLOGY' ? 'success' : 'info'}>
          {row.category}
        </EnterpriseBadge>
      )
    },
    {
      id: 'unit',
      header: 'Measurement Unit',
      accessorKey: 'unit',
      cell: (row) => <span className="font-medium text-slate-600">{row.unit}</span>
    },
    {
      id: 'range',
      header: 'Standard Limits (BIS IS 14543)',
      cell: (row) => {
        if (row.category === 'MICROBIOLOGY') {
          return <span className="text-xs font-semibold text-slate-700">Absent / 250ml or &lt; 20 CFU/ml</span>;
        }
        if (row.minAcceptable !== null && row.maxAcceptable !== null) {
          return <span className="text-xs font-semibold text-slate-700">{row.minAcceptable} - {row.maxAcceptable} {row.unit}</span>;
        }
        if (row.maxAcceptable !== null) {
          return <span className="text-xs font-semibold text-slate-700">Max {row.maxAcceptable} {row.unit}</span>;
        }
        if (row.minAcceptable !== null) {
          return <span className="text-xs font-semibold text-slate-700">Min {row.minAcceptable} {row.unit}</span>;
        }
        return <span className="text-xs font-medium text-slate-500">Agreeable / Unobjectionable</span>;
      }
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (row: WaterTestParameter) => (
        <div className="flex justify-end">
          <EnterpriseButton
            variant="ghost"
            size="sm"
            onClick={() => setEditingParam(row)}
          >
            <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Edit Limits
          </EnterpriseButton>
        </div>
      )
    }
  ];

  if (isLoading) {
    return (
      <div className="p-8">
        <EnterpriseLoading label="Loading laboratory parameter configuration..." />
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
          <span className="text-slate-900 font-semibold">Laboratory Parameters</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <EnterpriseHeader
            title="BIS Drinking Water Parameter Specifications"
            description="Manage physical, chemical, and microbiological test parameters, measurement units, and acceptable standard ranges."
          />

          <EnterpriseButton
            variant="primary"
            onClick={() => setEditingParam({ name: '', category: 'PHYSICAL', unit: 'mg/L' })}
          >
            <Plus className="w-4 h-4 mr-2" /> Add New Parameter
          </EnterpriseButton>
        </div>
      </div>

      {/* Filter Bar */}
      <EnterpriseCard className="p-4 bg-white border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="md:col-span-2">
            <EnterpriseInput
              placeholder="Search parameter by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>
          <EnterpriseSelect
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Categories' },
              { value: 'PHYSICAL', label: 'Physical Parameters' },
              { value: 'CHEMICAL', label: 'Chemical Parameters' },
              { value: 'MICROBIOLOGY', label: 'Microbiological Organisms' }
            ]}
          />
        </div>
      </EnterpriseCard>

      {/* Data Table Card */}
      <EnterpriseCard className="overflow-hidden border border-slate-200 shadow-sm bg-white">
        <EnterpriseTable
          columns={columns}
          data={filteredParameters}
          emptyMessage="No laboratory parameters found."
        />
      </EnterpriseCard>

      {/* Edit Parameter Modal */}
      {editingParam && (
        <EnterpriseModal
          isOpen={Boolean(editingParam)}
          onClose={() => setEditingParam(null)}
          title={editingParam.id ? `Edit Parameter — ${editingParam.name}` : 'Create Laboratory Parameter'}
        >
          <form onSubmit={handleSaveParameter} className="space-y-4 pt-2">
            <EnterpriseInput
              label="Parameter Name *"
              placeholder="e.g. pH, TDS, E.coli"
              value={editingParam.name || ''}
              onChange={(e) => setEditingParam({ ...editingParam, name: e.target.value })}
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <EnterpriseSelect
                label="Category"
                value={editingParam.category || 'PHYSICAL'}
                onChange={(e) => setEditingParam({ ...editingParam, category: e.target.value })}
                options={[
                  { value: 'PHYSICAL', label: 'Physical' },
                  { value: 'CHEMICAL', label: 'Chemical' },
                  { value: 'MICROBIOLOGY', label: 'Microbiology' }
                ]}
              />

              <EnterpriseInput
                label="Unit of Measurement"
                placeholder="e.g. mg/L, NTU, CFU/ml"
                value={editingParam.unit || ''}
                onChange={(e) => setEditingParam({ ...editingParam, unit: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <EnterpriseInput
                label="Min Acceptable Limit (Optional)"
                type="number"
                step="0.01"
                placeholder="e.g. 6.5"
                value={editingParam.minAcceptable ?? ''}
                onChange={(e) => setEditingParam({ ...editingParam, minAcceptable: e.target.value !== '' ? Number(e.target.value) : undefined })}
              />

              <EnterpriseInput
                label="Max Acceptable Limit (Optional)"
                type="number"
                step="0.01"
                placeholder="e.g. 8.5 or 500"
                value={editingParam.maxAcceptable ?? ''}
                onChange={(e) => setEditingParam({ ...editingParam, maxAcceptable: e.target.value !== '' ? Number(e.target.value) : undefined })}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <EnterpriseButton
                type="button"
                variant="secondary"
                onClick={() => setEditingParam(null)}
              >
                Cancel
              </EnterpriseButton>
              <EnterpriseButton
                type="submit"
                variant="primary"
                loading={isSubmitting}
              >
                Save Parameter
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
      )}

    </div>
  );
};

export default ParametersManagementPage;
