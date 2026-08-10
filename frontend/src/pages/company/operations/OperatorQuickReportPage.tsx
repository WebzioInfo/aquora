import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, 
  ArrowLeft, 
  Send, 
  AlertTriangle, 
  Wrench, 
  CheckCircle2, 
  Clock,
  Layers,
  Cpu
} from 'lucide-react';
import { toast } from '../../../utils/toast';
import PageContainer from '../../../components/ui/layout/PageContainer';
import PageHeader from '../../../components/ui/layout/PageHeader';
import { EnterpriseCard } from '../../../components/ui/EnterpriseCard';
import { operationsIssueApi } from '../../../services/api/operationsIssue';

const CATEGORIES = [
  { name: 'Machine Breakdown', icon: '⚙️', color: 'bg-red-50 text-red-700 border-red-200' },
  { name: 'Power / Generator Failure', icon: '⚡', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { name: 'Bottle Jam / Conveyor', icon: '🍾', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { name: 'Leakage / Water Supply', icon: '💧', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { name: 'Material Shortage', icon: '📦', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { name: 'Safety / Other Incident', icon: '🚨', color: 'bg-rose-50 text-rose-700 border-rose-200' }
];

const MACHINES = [
  'Filling Machine #1',
  'Blowing Machine #1',
  'Labeling Machine',
  'Air Compressor #1',
  'Main Conveyor Line',
  'RO Water Treatment Plant',
  'Palletizer / Forklift',
  'Other Equipment'
];

export const OperatorQuickReportPage: React.FC = () => {
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [department, setDepartment] = useState('Production');
  const [category, setCategory] = useState('Machine Breakdown');
  const [priority, setPriority] = useState<'High' | 'Emergency' | 'Medium'>('High');
  const [selectedMachines, setSelectedMachines] = useState<string[]>(['Filling Machine #1']);
  const [description, setDescription] = useState('');
  const [downtimeMinutes, setDowntimeMinutes] = useState('15');
  const [attachment, setAttachment] = useState('');

  const toggleMachine = (machineName: string) => {
    setSelectedMachines(prev =>
      prev.includes(machineName)
        ? prev.filter(m => m !== machineName)
        : [...prev, machineName]
    );
  };

  const handleSubmit = async () => {
    if (selectedMachines.length === 0) {
      toast.error('Please select at least one affected machine.');
      return;
    }

    if (!description.trim()) {
      toast.error('Please add a short description of what happened');
      return;
    }

    setIsSubmitting(true);
    try {
      await operationsIssueApi.quickOperatorReport({
        department,
        category,
        priority,
        description: description.trim(),
        machineName: selectedMachines[0],
        affectedMachineNames: selectedMachines,
        downtimeMinutes: downtimeMinutes ? parseInt(downtimeMinutes, 10) : 0,
        attachments: attachment.trim() || undefined
      });

      toast.success('Incident reported successfully! Maintenance & Supervisors notified.');
      navigate('/company/operations-issues');
    } catch (error) {
      toast.error('Failed to report issue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer>
      {/* Header */}
      <PageHeader
        icon={Zap}
        title="30-Second Operator Incident Report"
        description="Quick tap screen for factory operators and plant technicians"
        actions={
          <button
            onClick={() => navigate('/company/operations-issues')}
            className="h-[32px] px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Issues
          </button>
        }
      />

      {/* Main Content Card */}
      <EnterpriseCard className="p-6 bg-white border border-slate-200 rounded-xl shadow-xs space-y-6">
        {/* 1. Category Selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            1. Select Incident Type *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {CATEGORIES.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setCategory(c.name)}
                className={`p-3.5 rounded-xl border text-left font-bold transition-all cursor-pointer flex flex-col justify-between h-[92px] ${
                  category === c.name
                    ? 'border-blue-600 ring-2 ring-blue-500 bg-blue-50/50 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <span className="text-2xl">{c.icon}</span>
                <span className="text-xs font-bold text-slate-900 leading-tight">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Machine Selection */}
        <div className="space-y-2 border-t border-slate-100 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              2. Affected Machine / Equipment *
            </label>
            <span className="text-[11px] font-medium text-slate-500">Select all affected machines or equipment.</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {MACHINES.map((m) => {
              const isSelected = selectedMachines.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMachine(m)}
                  className={`h-[44px] px-3 rounded-lg border text-xs font-bold transition-all text-center flex items-center justify-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'border-blue-600 bg-blue-600 text-white shadow-xs ring-2 ring-blue-400 font-bold'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {isSelected && <CheckCircle2 className="w-4 h-4 fill-current text-white shrink-0" />}
                  <span>{m}</span>
                </button>
              );
            })}
          </div>

          {selectedMachines.length > 0 ? (
            <p className="text-[11px] font-semibold text-blue-600 mt-1">
              ✓ {selectedMachines.length} machine{selectedMachines.length > 1 ? 's' : ''} selected: {selectedMachines.join(', ')}
            </p>
          ) : (
            <p className="text-[11px] font-semibold text-rose-500 mt-1">
              ⚠️ Please select at least one affected machine.
            </p>
          )}
        </div>

        {/* 3. Priority & Downtime */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-100 pt-5">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              3. Severity / Priority
            </label>
            <div className="flex gap-2">
              {(['Medium', 'High', 'Emergency'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 h-[40px] text-xs font-black rounded-lg border transition-all cursor-pointer ${
                    priority === p
                      ? p === 'Emergency'
                        ? 'bg-red-600 border-red-600 text-white'
                        : p === 'High'
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              4. Estimated Downtime (Minutes)
            </label>
            <input
              type="number"
              value={downtimeMinutes}
              onChange={(e) => setDowntimeMinutes(e.target.value)}
              placeholder="e.g. 15"
              className="w-full h-[40px] px-3 text-xs font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 5. Description */}
        <div className="space-y-2 border-t border-slate-100 pt-5">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            5. What Happened? (Short Description) *
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Bottle capping unit jammed at main line, motor overheating..."
            className="w-full p-3 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 6. Submit Button */}
        <div className="border-t border-slate-100 pt-4">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="w-full h-[46px] bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white font-extrabold text-sm rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Submitting Incident Report...</span>
            ) : (
              <>
                <Send className="w-4 h-4" /> Submit Incident Report
              </>
            )}
          </button>
        </div>
      </EnterpriseCard>
    </PageContainer>
  );
};

export default OperatorQuickReportPage;
