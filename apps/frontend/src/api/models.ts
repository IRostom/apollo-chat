import { API_CONFIG } from '@/config/api'

import { getApiUrl } from '@/config/api'
import type { ModelsByFamily } from '@/types/chat'

export async function getModels(): Promise<ModelsByFamily> {
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
