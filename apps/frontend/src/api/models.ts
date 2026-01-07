import { API_CONFIG } from '@/config/api'

import { getApiUrl } from '@/config/api'
import type { ModelsByFamily } from '@/types/chat'

export async function getModels(): Promise<ModelsByFamily> {
  const response = await fetch(getApiUrl(API_CONFIG.endpoints.models.list))

  if (!response.ok) {
    const res = await response.json()
    const error = res.error || 'Failed to fetch models xx'
    throw new Error(error)
  }

  return response.json()
}
