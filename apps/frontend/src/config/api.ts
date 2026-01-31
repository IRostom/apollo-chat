/**
 * API Configuration
 * Centralized configuration for API endpoints and base URL
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export const API_CONFIG = {
  baseUrl: API_BASE_URL,
  endpoints: {
    chat: {
      api: '/api/chat', // New AI SDK endpoint with trigger routing
      stream: '/chat/stream', // Legacy endpoint
      retry: '/chat/stream/retry', // Legacy endpoint
      edit: '/chat/stream/edit', // Legacy endpoint
      branch: '/chat/branch',
    },
    settings: {
      list: '/settings',
      providers: '/settings/providers',
      update: (key: string) => `/settings/${key}`,
      delete: (key: string) => `/settings/${key}`,
    },
    conversations: {
      list: '/conversations',
      get: (id: string) => `/conversations/${id}`,
      delete: (id: string) => `/conversations/${id}`,
    },
    models: {
      list: '/models',
    },
    upload: {
      file: '/upload',
      files: '/upload-multiple',
    },
    transcribe: '/transcribe',
  },
} as const

/**
 * Get full URL for an endpoint
 */
export function getApiUrl(endpoint: string): string {
  return `${API_CONFIG.baseUrl}${endpoint}`
}

export function getImageUrl(image: string): string {
  return `${API_CONFIG.baseUrl}/uploads/${image}`
}
