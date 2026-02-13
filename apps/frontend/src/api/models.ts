import { API_CONFIG, getApiUrl } from '@/config/api'
import { authFetch } from '@/lib/auth'
import type { ProvidersResponse } from '@/types/chat'

export async function getModels(): Promise<ProvidersResponse> {
  const response = await authFetch(getApiUrl(API_CONFIG.endpoints.models.list))

  if (!response.ok) {
    let error = 'Failed to fetch models'
    try {
      const res = await response.json()
      error = res.error || error
    } catch {
      // Response body is not JSON, use default error message
    }
    throw new Error(error)
  }

  return response.json()
}
