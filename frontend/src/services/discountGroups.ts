import { api } from './api';

export interface DiscountGroup {
    id: string;
    code: string;
    description?: string;
    isActive: boolean;
}

export const discountGroupService = {
    getAll: async () => {
        const response = await api.get<DiscountGroup[]>('/discountgroups');
        return response.data;
    },
    getById: async (id: string) => {
        const response = await api.get<DiscountGroup>(`/discountgroups/${id}`);
        return response.data;
    },
    create: async (data: Omit<DiscountGroup, 'id'>) => {
        const response = await api.post<DiscountGroup>('/discountgroups', data);
        return response.data;
    },
    update: async (id: string, data: Partial<DiscountGroup>) => {
        const response = await api.put<DiscountGroup>(`/discountgroups/${id}`, data);
        return response.data;
    },
    delete: async (id: string) => {
        await api.delete(`/discountgroups/${id}`);
    }
};
