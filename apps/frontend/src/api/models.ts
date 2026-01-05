import { API_CONFIG } from '@/config/api'

import { getApiUrl } from '@/config/api'
import type { ModelsByFamily } from '@/types/chat'

export async function getModels(): Promise<ModelsByFamily> {
  const response = await fetch(getApiUrl(API_CONFIG.endpoints.models.list))

  if (!response.ok) {
    throw new Error(`network response failed: ${response.statusText}`)
  }

  return response.json()
}
