import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Check, ChevronDown, CheckSquare, Square, Cpu } from 'lucide-react';
import type { AffectedMachineItem } from '../../services/api/operationsIssue';

interface AquoraMultiMachineSelectProps {
  label?: string;
  machines: AffectedMachineItem[];
  selectedMachineIds: string[];
  onChange: (selectedIds: string[], selectedItems: AffectedMachineItem[]) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export const AquoraMultiMachineSelect: React.FC<AquoraMultiMachineSelectProps> = ({
  label = 'Affected Machines',
  machines,
  selectedMachineIds,
  onChange,
  isLoading = false,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredMachines = machines.filter(
    (m) =>
      m.machineName.toLowerCase().includes(search.toLowerCase()) ||
      (m.machineCode && m.machineCode.toLowerCase().includes(search.toLowerCase()))
  );

  const selectedItems = machines.filter((m) => selectedMachineIds.includes(m.machineId));

  const toggleSelect = (machine: AffectedMachineItem) => {
    if (disabled) return;
    const exists = selectedMachineIds.includes(machine.machineId);
    let updatedIds: string[];
    if (exists) {
      updatedIds = selectedMachineIds.filter((id) => id !== machine.machineId);
    } else {
      updatedIds = [...selectedMachineIds, machine.machineId];
    }
    const updatedItems = machines.filter((m) => updatedIds.includes(m.machineId));
    onChange(updatedIds, updatedItems);
  };

  const handleSelectAll = () => {
    if (disabled) return;
    const allIds = Array.from(new Set([...selectedMachineIds, ...filteredMachines.map((m) => m.machineId)]));
    const updatedItems = machines.filter((m) => allIds.includes(m.machineId));
    onChange(allIds, updatedItems);
  };

  const handleClearAll = () => {
    if (disabled) return;
    onChange([], []);
  };

  const removeChip = (machineId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    const updatedIds = selectedMachineIds.filter((id) => id !== machineId);
    const updatedItems = machines.filter((m) => updatedIds.includes(m.machineId));
    onChange(updatedIds, updatedItems);
  };

  return (
    <div className="space-y-1.5" ref={dropdownRef}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-blue-600" />
          {label}
        </label>
        {selectedMachineIds.length > 0 && (
          <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
            {selectedMachineIds.length} {selectedMachineIds.length === 1 ? 'machine' : 'machines'} selected
          </span>
        )}
      </div>

      {/* Control Box */}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled || isLoading}
          className={`w-full min-h-[42px] p-2 text-left bg-white border ${
            isOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'
          } rounded-lg flex items-center justify-between gap-2 transition-all cursor-pointer ${
            disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''
          }`}
        >
          <div className="flex flex-wrap gap-1.5 items-center flex-1 pr-2">
            {isLoading ? (
              <span className="text-xs text-slate-400 font-medium italic">Loading machines...</span>
            ) : selectedItems.length === 0 ? (
              <span className="text-xs text-slate-400 font-medium">Select affected machines...</span>
            ) : (
              selectedItems.map((item) => (
                <span
                  key={item.machineId}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded-md hover:bg-slate-200 transition-colors"
                >
                  <span>{item.machineName}</span>
                  {item.machineCode && <span className="text-slate-400 font-mono text-[10px]">({item.machineCode})</span>}
                  <X
                    className="w-3 h-3 text-slate-500 hover:text-red-600 cursor-pointer ml-0.5"
                    onClick={(e) => removeChip(item.machineId, e)}
                  />
                </span>
              ))
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in-50 duration-150">
            {/* Header with Search and Actions */}
            <div className="p-2.5 bg-slate-50 border-b border-slate-200 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search machines by name or code..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {search && (
                  <X
                    className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                    onClick={() => setSearch('')}
                  />
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-blue-600 font-bold hover:text-blue-800 cursor-pointer"
                  >
                    Select All ({filteredMachines.length})
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-slate-500 font-medium hover:text-slate-700 cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
                <span className="text-slate-400 font-medium">
                  {selectedMachineIds.length} of {machines.length} Selected
                </span>
              </div>
            </div>

            {/* Machine List */}
            <div className="max-h-60 overflow-y-auto p-1 divide-y divide-slate-100">
              {filteredMachines.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  {machines.length === 0 ? 'No machines configured for this plant' : 'No matching machines found'}
                </div>
              ) : (
                filteredMachines.map((m) => {
                  const isSelected = selectedMachineIds.includes(m.machineId);
                  return (
                    <div
                      key={m.machineId}
                      onClick={() => toggleSelect(m)}
                      className={`flex items-center justify-between px-3 py-2 text-xs rounded-md cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50 text-blue-900 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 flex-shrink-0" />
                        )}
                        <span>{m.machineName}</span>
                      </div>
                      {m.machineCode && (
                        <span className="text-[10px] font-mono font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {m.machineCode}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
