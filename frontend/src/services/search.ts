import { api } from './api'

export interface GlobalSearchAction {
  label: string
  routeUrl: string
  icon?: string
  permission?: string
}

export interface GlobalSearchResult {
  id: string
  title: string
  subtitle?: string
  category: string
  type: string
  routeUrl: string
  status?: string
  icon?: string
  score: number
  metadata: Record<string, string | null>
  actions: GlobalSearchAction[]
}

export interface GlobalSearchGroup {
  type: string
  label: string
  icon: string
  totalCount: number
  results: GlobalSearchResult[]
}

export interface GlobalSearchResponse {
  query: string
  totalMatches: number
  groups: GlobalSearchGroup[]
  executionTimeMs: number
}

export const searchService = {
  async search(
    query: string,
    scope = 'all',
    distributorId?: string,
    limit = 5,
    signal?: AbortSignal
  ): Promise<GlobalSearchResponse> {
    const res = await api.get('/api/v1/search', {
      params: {
        q: query,
        scope,
        distributorId,
        limit
      },
      signal
    })
    return res.data?.data as GlobalSearchResponse
  }
}
