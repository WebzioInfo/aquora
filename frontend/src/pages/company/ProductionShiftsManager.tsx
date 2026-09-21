import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Trash2, Edit2, Plus, Clock, Users, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import { productionShiftsService, type ProductionShift } from '../../services/productionShifts';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useAuthStore } from '../../store/useAuthStore';
import EnterpriseCard from '../../components/ui/EnterpriseCard';
import EnterpriseInput from '../../components/ui/EnterpriseInput';
import EnterpriseButton from '../../components/ui/EnterpriseButton';
import EnterpriseModal from '../../components/ui/EnterpriseModal';
import EnterpriseLoading from '../../components/ui/EnterpriseLoading';
import { EnterpriseTimePicker } from '../../components/ui/EnterpriseTimePicker';

// Validation Schema
const shiftSchema = z.object({
  name: z.string().min(1, "Shift Name is required.").max(50, "Shift Name must be less than 50 characters."),
  startTime: z.string().min(1, "Start Time is required."),
  endTime: z.string().min(1, "End Time is required."),
  description: z.string().optional(),
  isActive: z.boolean(),
}).refine(data => data.startTime !== data.endTime, {
  message: "End Time cannot equal Start Time.",
  path: ["endTime"],
});

type ShiftFormData = z.infer<typeof shiftSchema>;

// Duration Calculation Utility
export function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  const str = timeStr.trim().toUpperCase();
  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3];
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  const hhmmMatch = str.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmmMatch) {
    const hours = parseInt(hhmmMatch[1], 10);
    const minutes = parseInt(hhmmMatch[2], 10);
    return hours * 60 + minutes;
  }
  return null;
}

export function calculateShiftDuration(startTimeStr: string, endTimeStr: string): string {
  const startMins = parseTimeToMinutes(startTimeStr);
  const endMins = parseTimeToMinutes(endTimeStr);

  if (startMins === null || endMins === null || startMins === endMins) return '0 Hours';

  let diffMins = endMins - startMins;
  if (diffMins < 0) {
    // Overnight Shift (e.g. 10:00 PM to 06:00 AM)
    diffMins += 24 * 60;
  }

  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  if (mins === 0) {
    return hours === 1 ? '1 Hour' : `${hours} Hours`;
  }
  return `${hours}h ${mins}m`;
}

export const ProductionShiftsManager: React.FC = () => {
  const queryClient = useQueryClient();
  const { showToast } = useNotificationStore();
  const { user } = useAuthStore();
  const [editingShift, setEditingShift] = useState<ProductionShift | null>(null);

  // Role permissions: Company Admin / Super Admin full access, Supervisor/Operator view-only
  const userRoles = (user?.roles || []).map((r: string) => r.toLowerCase().replace(/[\s_]/g, ''));
  const primaryRole = (user?.roleName || '').toLowerCase().replace(/[\s_]/g, '');
  const isOwner = userRoles.some((r: string) => ['owner', 'companyowner', 'platformowner'].includes(r)) || primaryRole === 'owner';
  const canManage = !isOwner && (
    !!user?.isPlatformAdmin ||
    userRoles.some((r: string) => ['companyadmin', 'accountant', 'admin', 'superadmin', 'platformadmin'].includes(r)) ||
    ['companyadmin', 'accountant', 'admin', 'superadmin', 'platformadmin'].includes(primaryRole)
  );

  const { data: shifts = [], isLoading } = useQuery<ProductionShift[]>({
    queryKey: ['productionShifts'],
    queryFn: async () => {
      try {
        const res = await productionShiftsService.getAll();
        if (!res.data?.success) {
          showToast(res.data?.message || 'Unable to load Production Shifts. Please try again.', 'warning');
          return [];
        }
        return res.data?.data || [];
      } catch (err) {
        showToast('Unable to load Production Shifts. Please try again later.', 'error');
        return [];
      }
    }
  });

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<ShiftFormData>({
    resolver: zodResolver(shiftSchema),
    defaultValues: { name: '', startTime: '06:00 AM', endTime: '02:00 PM', description: '', isActive: true }
  });

  const { register: registerEdit, handleSubmit: handleSubmitEdit, control: controlEdit, reset: resetEdit, formState: { errors: editErrors } } = useForm<ShiftFormData>({
    resolver: zodResolver(shiftSchema),
    defaultValues: { name: '', startTime: '', endTime: '', description: '', isActive: true }
  });

  const createMutation = useMutation({
    mutationFn: async (payload: ShiftFormData) => {
      // Duplicate shift name check
      const duplicate = shifts.some(s => s.name.trim().toLowerCase() === payload.name.trim().toLowerCase());
      if (duplicate) {
        throw new Error('A shift with this name already exists.');
      }
      const res = await productionShiftsService.create({
        name: payload.name.trim(),
        startTime: payload.startTime,
        endTime: payload.endTime,
        description: payload.description,
        isActive: payload.isActive
      });
      return res.data;
    },
    onSuccess: () => {
      showToast('Production shift created successfully.', 'success');
      reset({ name: '', startTime: '06:00 AM', endTime: '02:00 PM', description: '', isActive: true });
      queryClient.invalidateQueries({ queryKey: ['productionShifts'] });
    },
    onError: (err: any) => {
      showToast(err.message || err.response?.data?.message || 'Failed to create shift.', 'error');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string, payload: ShiftFormData }) => {
      const duplicate = shifts.some(s => s.id !== id && s.name.trim().toLowerCase() === payload.name.trim().toLowerCase());
      if (duplicate) {
        throw new Error('A shift with this name already exists.');
      }
      const res = await productionShiftsService.update(id, {
        name: payload.name.trim(),
        startTime: payload.startTime,
        endTime: payload.endTime,
        description: payload.description,
        isActive: payload.isActive
      });
      return res.data;
    },
    onSuccess: () => {
      showToast('Production shift updated successfully.', 'success');
      setEditingShift(null);
      queryClient.invalidateQueries({ queryKey: ['productionShifts'] });
    },
    onError: (err: any) => {
      showToast(err.message || err.response?.data?.message || 'Failed to update shift.', 'error');
    }
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string, isActive: boolean }) => {
      const res = await productionShiftsService.patchStatus(id, isActive);
      return res.data;
    },
    onSuccess: () => {
      showToast('Shift status updated.', 'success');
      queryClient.invalidateQueries({ queryKey: ['productionShifts'] });
    },
    onError: (err: any) => {
      showToast(err.message || err.response?.data?.message || 'Failed to update shift status.', 'error');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await productionShiftsService.delete(id);
      return res.data;
    },
    onSuccess: () => {
      showToast('Shift deleted successfully.', 'success');
      queryClient.invalidateQueries({ queryKey: ['productionShifts'] });
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || err.message || 'Cannot delete shift because it is currently used by production batches.', 'error');
    }
  });

  const onSubmit = (data: ShiftFormData) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: ShiftFormData) => {
    if (editingShift) {
      updateMutation.mutate({ id: editingShift.id, payload: data });
    }
  };

  return (
    <div className="space-y-6">
      {!canManage && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2.5 text-xs text-amber-800 font-medium shadow-sm">
          <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>You have View-Only permissions for Production Shifts. Only Company Admins can create, edit, or disable shifts.</span>
        </div>
      )}

      {/* Form Card (Only for Company Admin) */}
      {canManage && (
        <EnterpriseCard title="Create New Production Shift">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <EnterpriseInput
                  label="Shift Name *"
                  placeholder="e.g. Morning Shift, Night Shift"
                  {...register('name')}
                  error={errors.name?.message}
                />
              </div>

              <div>
                <Controller
                  name="startTime"
                  control={control}
                  render={({ field }) => (
                    <EnterpriseTimePicker
                      label="Start Time"
                      required
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.startTime?.message}
                    />
                  )}
                />
              </div>

              <div>
                <Controller
                  name="endTime"
                  control={control}
                  render={({ field }) => (
                    <EnterpriseTimePicker
                      label="End Time"
                      required
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.endTime?.message}
                    />
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-2">
                <EnterpriseInput
                  label="Description (Optional)"
                  placeholder="e.g. Standard morning shift for Line A & B"
                  {...register('description')}
                  error={errors.description?.message}
                />
              </div>

              <div className="flex items-center justify-between gap-3 bg-slate-50 border border-[#E5E7EB] rounded-lg p-2.5 h-11">
                <span className="text-xs font-semibold text-slate-700">Active Shift</span>
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                    </label>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <EnterpriseButton
                type="button"
                variant="secondary"
                onClick={() => reset({ name: '', startTime: '06:00 AM', endTime: '02:00 PM', description: '', isActive: true })}
              >
                Cancel
              </EnterpriseButton>
              <EnterpriseButton type="submit" loading={createMutation.isPending}>
                <Plus className="w-4 h-4 mr-2" />
                Save Shift
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseCard>
      )}

      {/* Shifts Table Card */}
      <EnterpriseCard title="Production Shifts Directory">
        {isLoading ? (
          <div className="h-36 flex items-center justify-center border border-[#E5E7EB] rounded-lg">
            <EnterpriseLoading />
          </div>
        ) : shifts.length > 0 ? (
          <div className="border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm bg-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none h-[36px]">
                  <th className="py-2 px-4">Shift Name</th>
                  <th className="py-2 px-4">Start Time</th>
                  <th className="py-2 px-4">End Time</th>
                  <th className="py-2 px-4">Duration</th>
                  <th className="py-2 px-4">Status</th>
                  <th className="py-2 px-4">Employees Assigned</th>
                  {canManage && <th className="py-2 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] text-[13px] text-slate-700">
                {shifts.map((shift, i) => {
                  const durationStr = calculateShiftDuration(shift.startTime, shift.endTime);
                  return (
                    <tr key={shift.id} className={`h-[38px] transition-colors ${i%2===0?'bg-white':'bg-[#FAFBFC]'} hover:bg-blue-50/30`}>
                      <td className="py-2 px-4">
                        <div className="text-xs font-bold text-slate-900">{shift.name}</div>
                        {shift.description && (
                          <div className="text-[11px] text-slate-500 font-normal">{shift.description}</div>
                        )}
                      </td>
                      <td className="p-3 text-xs text-slate-700 font-semibold">{shift.startTime}</td>
                      <td className="p-3 text-xs text-slate-700 font-semibold">{shift.endTime}</td>
                      <td className="p-3 text-xs font-semibold text-blue-700">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                          <Clock className="w-3 h-3 mr-1 text-blue-500" />
                          {durationStr}
                        </span>
                      </td>
                      <td className="p-3">
                        {canManage ? (
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={shift.isActive}
                              onChange={(e) => toggleMutation.mutate({ id: shift.id, isActive: e.target.checked })}
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                          </label>
                        ) : (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              shift.isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {shift.isActive ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                            {shift.isActive ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-slate-700 font-semibold">
                        <span className="inline-flex items-center text-slate-600">
                          <Users className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          {shift.employeesAssigned ?? 0}
                        </span>
                      </td>
                      {canManage && (
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingShift(shift);
                                resetEdit({
                                  name: shift.name,
                                  startTime: shift.startTime,
                                  endTime: shift.endTime,
                                  description: shift.description || '',
                                  isActive: shift.isActive
                                });
                              }}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                              title="Edit Shift"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete shift '${shift.name}'?`)) {
                                  deleteMutation.mutate(shift.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                              title="Delete Shift"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 border border-dashed border-[#E5E7EB] rounded-lg bg-slate-50/50">
            <Clock className="w-8 h-8 text-slate-400 mb-2" />
            <p className="text-xs font-bold text-slate-800 mb-0.5">No Production Shifts Configured</p>
            <p className="text-[11px] text-slate-500">
              {canManage
                ? 'Fill out the form above to add your company production shifts.'
                : 'No production shifts have been created by the Company Administrator yet.'}
            </p>
          </div>
        )}
      </EnterpriseCard>

      {/* Edit Shift Modal */}
      {canManage && (
        <EnterpriseModal
          isOpen={!!editingShift}
          onClose={() => setEditingShift(null)}
          title="Edit Production Shift"
        >
          <form onSubmit={handleSubmitEdit(onEditSubmit)} className="space-y-4">
            <EnterpriseInput
              label="Shift Name *"
              {...registerEdit('name')}
              error={editErrors.name?.message}
            />

            <div className="grid grid-cols-2 gap-4">
              <Controller
                name="startTime"
                control={controlEdit}
                render={({ field }) => (
                  <EnterpriseTimePicker
                    label="Start Time"
                    required
                    value={field.value}
                    onChange={field.onChange}
                    error={editErrors.startTime?.message}
                  />
                )}
              />

              <Controller
                name="endTime"
                control={controlEdit}
                render={({ field }) => (
                  <EnterpriseTimePicker
                    label="End Time"
                    required
                    value={field.value}
                    onChange={field.onChange}
                    error={editErrors.endTime?.message}
                  />
                )}
              />
            </div>

            <EnterpriseInput
              label="Description (Optional)"
              {...registerEdit('description')}
              error={editErrors.description?.message}
            />

            <div className="flex items-center justify-between gap-3 bg-slate-50 border border-[#E5E7EB] rounded-lg p-2.5">
              <span className="text-xs font-semibold text-slate-700">Active Shift</span>
              <Controller
                name="isActive"
                control={controlEdit}
                render={({ field }) => (
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
              <EnterpriseButton type="button" variant="secondary" onClick={() => setEditingShift(null)}>
                Cancel
              </EnterpriseButton>
              <EnterpriseButton type="submit" loading={updateMutation.isPending}>
                Save Changes
              </EnterpriseButton>
            </div>
          </form>
        </EnterpriseModal>
      )}
    </div>
  );
};
