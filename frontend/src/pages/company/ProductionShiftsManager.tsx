import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Trash2, Edit2, Plus, Clock } from 'lucide-react';
import { productionShiftsService } from '../../services/productionShifts';
import { useNotificationStore } from '../../store/useNotificationStore';
import EnterpriseCard from '../../components/ui/EnterpriseCard';
import EnterpriseInput from '../../components/ui/EnterpriseInput';
import EnterpriseButton from '../../components/ui/EnterpriseButton';
import EnterpriseModal from '../../components/ui/EnterpriseModal';
import EnterpriseLoading from '../../components/ui/EnterpriseLoading';

const shiftSchema = z.object({
  name: z.string().min(2, "Shift Name must be at least 2 characters.").max(50, "Shift Name must be less than 50 characters."),
  startTime: z.string().min(1, "Start Time is required."),
  endTime: z.string().min(1, "End Time is required."),
}).refine(data => data.startTime !== data.endTime, {
  message: "End Time cannot equal Start Time.",
  path: ["endTime"],
});

type ShiftFormData = z.infer<typeof shiftSchema>;

export const ProductionShiftsManager: React.FC = () => {
  const queryClient = useQueryClient();
  const { showToast } = useNotificationStore();
  const [editingShift, setEditingShift] = useState<any>(null);

  const { data: shifts = [], isLoading } = useQuery<any[]>({
    queryKey: ['productionShifts'],
    queryFn: async () => {
      const res = await productionShiftsService.getAll();
      return res.data?.data || [];
    }
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ShiftFormData>({
    resolver: zodResolver(shiftSchema),
    defaultValues: { name: '', startTime: '', endTime: '' }
  });

  const { register: registerEdit, handleSubmit: handleSubmitEdit, reset: resetEdit, formState: { errors: editErrors } } = useForm<ShiftFormData>({
    resolver: zodResolver(shiftSchema)
  });

  const createMutation = useMutation({
    mutationFn: async (payload: ShiftFormData) => {
      const res = await productionShiftsService.create({ ...payload, isActive: true });
      return res.data;
    },
    onSuccess: () => {
      showToast('Shift created successfully.', 'success');
      reset();
      queryClient.invalidateQueries({ queryKey: ['productionShifts'] });
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to create shift.', 'error');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string, payload: any }) => {
      const res = await productionShiftsService.update(id, payload);
      return res.data;
    },
    onSuccess: () => {
      showToast('Shift updated successfully.', 'success');
      setEditingShift(null);
      queryClient.invalidateQueries({ queryKey: ['productionShifts'] });
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to update shift.', 'error');
    }
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string, payload: any }) => {
      const res = await productionShiftsService.update(id, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionShifts'] });
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to toggle shift.', 'error');
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
      showToast(err.message || 'Failed to delete shift.', 'error');
    }
  });

  const onSubmit = (data: ShiftFormData) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: ShiftFormData) => {
    if (editingShift) {
      updateMutation.mutate({ id: editingShift.id, payload: { ...data, isActive: editingShift.isActive } });
    }
  };

  return (
    <EnterpriseCard title="Production Shifts">
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="sm:col-span-1">
          <EnterpriseInput
            label="Shift Name *"
            placeholder="e.g. Day Shift"
            {...register('name')}
            error={errors.name?.message}
          />
        </div>
        <div className="sm:col-span-1">
          <EnterpriseInput
            label="Start Time *"
            type="time"
            {...register('startTime')}
            error={errors.startTime?.message}
          />
        </div>
        <div className="sm:col-span-1">
          <EnterpriseInput
            label="End Time *"
            type="time"
            {...register('endTime')}
            error={errors.endTime?.message}
          />
        </div>
        <div className="sm:col-span-1 flex items-end">
          <EnterpriseButton type="submit" loading={createMutation.isPending} className="w-full h-11">
            <Plus className="w-4 h-4 mr-2" />
            Add Shift
          </EnterpriseButton>
        </div>
      </form>

      {isLoading ? (
        <div className="h-32 flex items-center justify-center border border-[#E5E7EB] rounded-[8px]">
          <EnterpriseLoading />
        </div>
      ) : shifts.length > 0 ? (
        <div className="border border-[#E5E7EB] rounded-[8px] overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-[#E5E7EB]">
                <th className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Shift Name</th>
                <th className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Time</th>
                <th className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] bg-white">
              {shifts.map((shift: any) => (
                <tr key={shift.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-3 text-sm font-medium text-slate-900">
                    {shift.name}
                  </td>
                  <td className="p-3 text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      {shift.startTime} to {shift.endTime}
                    </div>
                  </td>
                  <td className="p-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={shift.isActive}
                        onChange={(e) => toggleMutation.mutate({
                          id: shift.id,
                          payload: { name: shift.name, startTime: shift.startTime, endTime: shift.endTime, isActive: e.target.checked }
                        })}
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                    </label>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        type="button"
                        onClick={() => {
                          setEditingShift(shift);
                          resetEdit({ name: shift.name, startTime: shift.startTime, endTime: shift.endTime });
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                        title="Edit Shift"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          if(window.confirm('Are you sure you want to delete this shift?')) {
                            deleteMutation.mutate(shift.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                        title="Delete Shift"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 border border-dashed border-[#E5E7EB] rounded-[8px] bg-slate-50/50">
          <Clock className="w-8 h-8 text-slate-400 mb-3" />
          <p className="text-sm font-medium text-slate-900 mb-1">No production shifts have been created yet.</p>
          <p className="text-xs text-slate-500">Fill out the form above and click "Add Shift" to create your first shift.</p>
        </div>
      )}

      {/* Edit Modal */}
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
            <EnterpriseInput
              label="Start Time *"
              type="time"
              {...registerEdit('startTime')}
              error={editErrors.startTime?.message}
            />
            <EnterpriseInput
              label="End Time *"
              type="time"
              {...registerEdit('endTime')}
              error={editErrors.endTime?.message}
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
    </EnterpriseCard>
  );
};

