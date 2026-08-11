import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from '../../../utils/toast';

import PageContainer from '../../../components/ui/layout/PageContainer';
import PageHeader from '../../../components/ui/layout/PageHeader';
import { EnterpriseCard } from '../../../components/ui/EnterpriseCard';
import { EnterpriseInput } from '../../../components/ui/EnterpriseInput';
import { EnterpriseSelect } from '../../../components/ui/EnterpriseSelect';
import { EnterpriseButton } from '../../../components/ui/EnterpriseButton';
import { EnterpriseLoading } from '../../../components/ui/EnterpriseLoading';
import { AquoraMultiMachineSelect } from '../../../components/ui/AquoraMultiMachineSelect';

import { operationsIssueApi } from '../../../services/api/operationsIssue';
import type { CreateOperationsIssueRequest, AffectedMachineItem } from '../../../services/api/operationsIssue';

const DEPARTMENTS = ['Production', 'Warehouse', 'Dispatch', 'QC', 'Quality', 'HR', 'Maintenance', 'General'];
const CATEGORIES = [
  'Machine Breakdown',
  'Power Failure',
  'Generator Failure',
  'Compressor Failure',
  'Filling Machine Issue',
  'Blowing Machine Issue',
  'Leakage',
  'Conveyor Problem',
  'Bottle Jam',
  'Production Stopped',
  'Material Shortage',
  'Quality Failure',
  'Stock Mismatch',
  'Damaged Stock',
  'Vehicle Breakdown',
  'Safety Incident',
  'General Maintenance'
];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical', 'Emergency'];

export const OperationsIssueFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState('Production');
  const [category, setCategory] = useState('Machine Breakdown');
  const [priority, setPriority] = useState('Medium');

  // Machines state
  const [availableMachines, setAvailableMachines] = useState<AffectedMachineItem[]>([]);
  const [isMachinesLoading, setIsMachinesLoading] = useState(false);
  const [selectedMachineIds, setSelectedMachineIds] = useState<string[]>([]);
  const [selectedMachineItems, setSelectedMachineItems] = useState<AffectedMachineItem[]>([]);

  const [productionLineName, setProductionLineName] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [downtimeMinutes, setDowntimeMinutes] = useState('');
  const [requiresMaintenance, setRequiresMaintenance] = useState(true);

  useEffect(() => {
    fetchAvailableMachines();
    if (id) fetchIssueData(id);
  }, [id]);

  const fetchAvailableMachines = async () => {
    setIsMachinesLoading(true);
    try {
      const res = await operationsIssueApi.getAvailableMachines();
      if (res.data) {
        setAvailableMachines(res.data);
      }
    } catch {
      toast.error('Failed to load available machines');
    } finally {
      setIsMachinesLoading(false);
    }
  };

  const fetchIssueData = async (issueId: string) => {
    setIsLoading(true);
    try {
      const res = await operationsIssueApi.getIssueById(issueId);
      const data = res.data;
      if (data) {
        setTitle(data.title);
        setDescription(data.description);
        setDepartment(data.department);
        setCategory(data.category);
        setPriority(data.priority);
        setProductionLineName(data.productionLineName || '');
        setBatchNumber(data.batchNumber || '');
        setEstimatedCost(data.estimatedCost ? data.estimatedCost.toString() : '');
        setDowntimeMinutes(data.downtimeMinutes ? data.downtimeMinutes.toString() : '');
        setRequiresMaintenance(data.requiresMaintenance);

        // Populate multi-machine selections
        if (data.affectedMachineIds && data.affectedMachineIds.length > 0) {
          setSelectedMachineIds(data.affectedMachineIds);
          if (data.affectedMachines && data.affectedMachines.length > 0) {
            setSelectedMachineItems(data.affectedMachines);
          }
        } else if (data.machineId) {
          setSelectedMachineIds([data.machineId]);
          if (data.machineName) {
            setSelectedMachineItems([{ machineId: data.machineId, machineName: data.machineName }]);
          }
        }
      }
    } catch {
      toast.error('Failed to load issue data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error('Description is required');
      return;
    }

    setIsSaving(true);
    try {
      const primaryMachine = selectedMachineItems[0];
      const payload: CreateOperationsIssueRequest = {
        title: title.trim() || `${category} in ${department}`,
        description: description.trim(),
        department,
        category,
        priority,
        machineId: primaryMachine?.machineId,
        machineName: primaryMachine?.machineName,
        affectedMachineIds: selectedMachineIds,
        affectedMachineNames: selectedMachineItems.map(m => m.machineName),
        productionLineName: productionLineName.trim() || undefined,
        batchNumber: batchNumber.trim() || undefined,
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : undefined,
        downtimeMinutes: downtimeMinutes ? parseInt(downtimeMinutes, 10) : undefined,
        requiresMaintenance
      };

      if (id) {
        await operationsIssueApi.updateIssue(id, payload);
        toast.success('Operations issue updated successfully');
      } else {
        await operationsIssueApi.createIssue(payload);
        toast.success('New operations issue logged successfully');
      }

      navigate('/company/operations-issues');
    } catch {
      toast.error('Failed to save operations issue');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="p-12 text-center">
          <EnterpriseLoading label="Loading form data..." />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={isEdit ? 'Edit Operations Issue' : 'Report New Operations Issue'}
        description="Comprehensive plant incident, machine breakdown, and maintenance ticket logging"
        actions={
          <button
            onClick={() => navigate('/company/operations-issues')}
            className="h-[32px] px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        }
      />

      <form onSubmit={handleSave} className="space-y-6">
        <EnterpriseCard className="p-6 space-y-6 bg-white border border-slate-200">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3">
            1. Issue Categorization & Priority
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <EnterpriseSelect
              label="Department *"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              options={DEPARTMENTS.map((d) => ({ label: d, value: d }))}
            />

            <EnterpriseSelect
              label="Category *"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={CATEGORIES.map((c) => ({ label: c, value: c }))}
            />

            <EnterpriseSelect
              label="Priority Level *"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              options={PRIORITIES.map((p) => ({ label: p, value: p }))}
            />
          </div>

          <div className="space-y-4">
            <EnterpriseInput
              label="Issue Title"
              placeholder="Short title (e.g. Electrical failure stopping 20L Bottling Line)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Detailed Description *</label>
              <textarea
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what happened, symptoms, observations, or immediate impact..."
                className="w-full p-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </EnterpriseCard>

        {/* Equipment & Linked Context */}
        <EnterpriseCard className="p-6 space-y-6 bg-white border border-slate-200">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3">
            2. Affected Machines & Production Context
          </h3>

          {/* Multi-Machine Selection Component */}
          <AquoraMultiMachineSelect
            label="Affected Machines / Equipment (Select All That Apply)"
            machines={availableMachines}
            selectedMachineIds={selectedMachineIds}
            onChange={(ids, items) => {
              setSelectedMachineIds(ids);
              setSelectedMachineItems(items);
            }}
            isLoading={isMachinesLoading}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <EnterpriseInput
              label="Production Line Name"
              placeholder="e.g. 20L Bottling Line A"
              value={productionLineName}
              onChange={(e) => setProductionLineName(e.target.value)}
            />

            <EnterpriseInput
              label="Batch Number (If applicable)"
              placeholder="e.g. BATCH-2026-0805"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <EnterpriseInput
              label="Estimated Downtime (Minutes)"
              type="number"
              placeholder="e.g. 30"
              value={downtimeMinutes}
              onChange={(e) => setDowntimeMinutes(e.target.value)}
            />

            <EnterpriseInput
              label="Estimated Repair Cost (₹)"
              type="number"
              placeholder="e.g. 1500.00"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
            />
          </div>
        </EnterpriseCard>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/company/operations-issues')}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            Cancel
          </button>
          <EnterpriseButton type="submit" variant="primary" loading={isSaving}>
            <Save className="w-3.5 h-3.5 mr-1.5" /> Save Issue Log
          </EnterpriseButton>
        </div>
      </form>
    </PageContainer>
  );
};

export default OperationsIssueFormPage;
