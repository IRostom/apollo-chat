import { API_CONFIG, getApiUrl } from '@/config/api'
import type { ModelsByProvider } from '@/types/chat'

/**
 * Fetch models from all configured providers
 */
export async function getModels(): Promise<ModelsByProvider> {
  const response = await fetch(getApiUrl(API_CONFIG.endpoints.models.list))

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
