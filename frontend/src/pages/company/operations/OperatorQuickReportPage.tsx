import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, 
  ArrowLeft, 
  Send, 
  Camera, 
  Upload, 
  AlertTriangle, 
  Wrench, 
  CheckCircle2, 
  Clock,
  Layers,
  Cpu
} from 'lucide-react';
import { toast } from '../../../utils/toast';
import PageContainer from '../../../components/ui/layout/PageContainer';
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
  const [selectedMachine, setSelectedMachine] = useState('Filling Machine #1');
  const [description, setDescription] = useState('');
  const [downtimeMinutes, setDowntimeMinutes] = useState('15');
  const [attachment, setAttachment] = useState('');

  const handleSubmit = async () => {
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
        machineName: selectedMachine,
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
      <div className="max-w-[800px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/company/operations-issues')}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Zap className="w-6 h-6 text-amber-500 fill-amber-500" /> 30-Second Operator Incident Report
              </h1>
              <p className="text-xs text-slate-500 font-medium">Quick tap screen for factory operators and plant technicians</p>
            </div>
          </div>
        </div>

        {/* 1. Category Selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">1. Select Incident Type *</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CATEGORIES.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setCategory(c.name)}
                className={`p-4 rounded-xl border text-left font-bold transition-all cursor-pointer flex flex-col justify-between h-[90px] ${
                  category === c.name
                    ? 'border-blue-600 ring-2 ring-blue-500 bg-blue-50/50 shadow-sm'
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
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">2. Affected Machine / Equipment *</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {MACHINES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedMachine(m)}
                className={`p-3 rounded-lg border text-xs font-bold transition-all text-center ${
                  selectedMachine === m
                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Priority & Downtime */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">3. Severity / Priority</label>
            <div className="flex gap-2">
              {(['Medium', 'High', 'Emergency'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 py-2.5 text-xs font-black rounded-lg border transition-all ${
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

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">4. Estimated Downtime (Minutes)</label>
            <input
              type="number"
              value={downtimeMinutes}
              onChange={(e) => setDowntimeMinutes(e.target.value)}
              placeholder="e.g. 15"
              className="w-full p-2.5 text-xs font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 4. Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">5. What Happened? (Short Description) *</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Bottle capping unit jammed at main line, motor overheating..."
            className="w-full p-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 5. Submit Button */}
        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleSubmit}
          className="w-full py-4 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white font-black text-base rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          <Send className="w-5 h-5" /> Submit Incident Report
        </button>
      </div>
    </PageContainer>
  );
};

export default OperatorQuickReportPage;
