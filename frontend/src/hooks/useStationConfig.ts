import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'

export const useStationConfig = () => {
  const queryClient = useQueryClient()
  
  const query = useQuery<string[]>({
    queryKey: ['enabledProductionStations'],
    queryFn: async () => {
      const res = await api.get('/api/v1/production-configuration')
      return res.data?.data || []
    }
  })

  const isBlowingEnabled = query.data?.includes('Blowing') ?? true
  const isFillingEnabled = query.data?.includes('Filling') ?? true
  // Support both Labeling and Labelling spelling
  const isLabelingEnabled = query.data?.some(name => name === 'Labeling' || name === 'Labelling') ?? true
  const isPackingEnabled = query.data?.includes('Packing') ?? true

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['enabledProductionStations'] })
  }

  return {
    enabledStations: query.data || [],
    isBlowingEnabled,
    isFillingEnabled,
    isLabelingEnabled,
    isPackingEnabled,
    isLoading: query.isLoading,
    invalidate
  }
}
