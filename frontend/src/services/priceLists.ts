import { api } from './api';

export interface PriceList {
    id: string;
    code: string;
    description?: string;
    isActive: boolean;
}

export const priceListService = {
    getAll: async () => {
        const response = await api.get<PriceList[]>('/pricelists');
        return response.data;
    },
    getById: async (id: string) => {
        const response = await api.get<PriceList>(`/pricelists/${id}`);
        return response.data;
    },
    create: async (data: Omit<PriceList, 'id'>) => {
        const response = await api.post<PriceList>('/pricelists', data);
        return response.data;
    },
    update: async (id: string, data: Partial<PriceList>) => {
        const response = await api.put<PriceList>(`/pricelists/${id}`, data);
        return response.data;
    },
    delete: async (id: string) => {
        await api.delete(`/pricelists/${id}`);
    }
};
