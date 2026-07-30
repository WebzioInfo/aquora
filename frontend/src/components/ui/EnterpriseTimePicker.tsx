import React, { useState, useRef, useEffect } from 'react';
import { Clock, ChevronDown } from 'lucide-react';

interface EnterpriseTimePickerProps {
  label?: string;
  value: string; // e.g. "09:00 AM" or "06:30 PM"
  onChange: (val: string) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}

export const EnterpriseTimePicker: React.FC<EnterpriseTimePickerProps> = ({
  label,
  value,
  onChange,
  error,
  disabled = false,
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper to parse "09:30 AM" or "09:30" or default "09:00 AM"
  const parseValue = (val: string) => {
    if (!val) return { hour: '09', minute: '00', period: 'AM' };
    const matchAmPm = val.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
    if (matchAmPm) {
      const h = parseInt(matchAmPm[1], 10);
      return {
        hour: h < 10 ? `0${h}` : `${h}`,
        minute: matchAmPm[2],
        period: matchAmPm[3]
      };
    }
    const match24 = val.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      let h = parseInt(match24[1], 10);
      const period = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h === 0) h = 12;
      return {
        hour: h < 10 ? `0${h}` : `${h}`,
        minute: match24[2],
        period
      };
    }
    return { hour: '09', minute: '00', period: 'AM' };
  };

  const parsed = parseValue(value);
  const [selectedHour, setSelectedHour] = useState(parsed.hour);
  const [selectedMinute, setSelectedMinute] = useState(parsed.minute);
  const [selectedPeriod, setSelectedPeriod] = useState(parsed.period);

  useEffect(() => {
    const updated = parseValue(value);
    setSelectedHour(updated.hour);
    setSelectedMinute(updated.minute);
    setSelectedPeriod(updated.period);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateTime = (h: string, m: string, p: string) => {
    setSelectedHour(h);
    setSelectedMinute(m);
    setSelectedPeriod(p);
    onChange(`${h}:${m} ${p}`);
  };

  const hours = Array.from({ length: 12 }, (_, i) => {
    const val = i + 1;
    return val < 10 ? `0${val}` : `${val}`;
  });

  const minutes = ['00', '15', '30', '45'];

  const presets = [
    '06:00 AM',
    '09:00 AM',
    '02:00 PM',
    '02:30 PM',
    '06:00 PM',
    '06:30 PM',
    '10:00 PM',
    '12:00 AM',
  ];

  return (
    <div className="relative flex flex-col gap-1 text-left select-none" ref={containerRef}>
      {label && (
        <label className="text-[12px] font-semibold text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm bg-white border ${
          error ? 'border-red-500' : isOpen ? 'border-blue-600 ring-2 ring-blue-100' : 'border-[#E5E7EB]'
        } rounded-lg shadow-sm hover:border-slate-400 transition-all ${
          disabled ? 'bg-slate-50 cursor-not-allowed opacity-60' : 'cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-2 font-medium text-slate-900">
          <Clock className="w-4 h-4 text-blue-600" />
          <span>{value ? value : 'Select Time'}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {error && <span className="text-[11px] text-red-500 font-medium">{error}</span>}

      {isOpen && (
        <div className="absolute top-[100%] left-0 mt-1.5 w-72 bg-white border border-[#E5E7EB] rounded-xl shadow-xl z-50 p-4 divide-y divide-slate-100">
          {/* Quick Presets */}
          <div className="pb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Popular Presets
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    const p = parseValue(preset);
                    updateTime(p.hour, p.minute, p.period);
                    setIsOpen(false);
                  }}
                  className={`text-[11px] font-semibold py-1 px-1.5 rounded-md border text-center transition-all ${
                    value === preset
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Time Picker Wheel / Selectors */}
          <div className="pt-3 flex flex-col gap-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Custom Time Selection
            </span>
            <div className="grid grid-cols-3 gap-2">
              {/* Hour */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 font-medium">Hour</span>
                <select
                  value={selectedHour}
                  onChange={(e) => updateTime(e.target.value, selectedMinute, selectedPeriod)}
                  className="w-full text-xs font-semibold p-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 focus:border-blue-600 focus:outline-none"
                >
                  {hours.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              {/* Minute */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 font-medium">Minute</span>
                <select
                  value={selectedMinute}
                  onChange={(e) => updateTime(selectedHour, e.target.value, selectedPeriod)}
                  className="w-full text-xs font-semibold p-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 focus:border-blue-600 focus:outline-none"
                >
                  {minutes.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* AM/PM */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 font-medium">Period</span>
                <div className="grid grid-cols-2 gap-1 h-9 items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg">
                  <button
                    type="button"
                    onClick={() => updateTime(selectedHour, selectedMinute, 'AM')}
                    className={`h-full text-[11px] font-bold rounded ${
                      selectedPeriod === 'AM' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTime(selectedHour, selectedMinute, 'PM')}
                    className={`h-full text-[11px] font-bold rounded ${
                      selectedPeriod === 'PM' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
