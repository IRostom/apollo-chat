import { API_CONFIG, getApiUrl } from '@/config/api'
import type { ProviderName } from '@/types/chat'

/**
 * Setting from the backend
 */
export interface Setting {
  key: string
  value: string
  isMasked: boolean
}

/**
 * Provider status from the backend
 */
export interface ProviderStatus {
  name: ProviderName
  configured: boolean
  keySource: 'env' | 'database' | null
  requiresApiKey: boolean
}

/**
 * Get all settings
 */
export async function getSettings(): Promise<{ success: boolean; settings: Setting[] }> {
  const response = await fetch(getApiUrl(API_CONFIG.endpoints.settings.list))

  if (!response.ok) {
    throw new Error('Failed to fetch settings')
  }

  return response.json()
}

/**
 * Get provider configuration status
 */
export async function getProviderStatus(): Promise<{
  success: boolean
  providers: ProviderStatus[]
}> {
  const response = await fetch(getApiUrl(API_CONFIG.endpoints.settings.providers))

  if (!response.ok) {
    throw new Error('Failed to fetch provider status')
  }

  return response.json()
}

/**
 * Update a setting
 */
export async function updateSetting(key: string, value: string): Promise<void> {
  const response = await fetch(getApiUrl(API_CONFIG.endpoints.settings.update(key)), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ value }),
  })

  if (!response.ok) {
    throw new Error('Failed to update setting')
  }
}

/**
 * Delete a setting
 */
export async function deleteSetting(key: string): Promise<void> {
  const response = await fetch(getApiUrl(API_CONFIG.endpoints.settings.delete(key)), {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error('Failed to delete setting')
  }
}
