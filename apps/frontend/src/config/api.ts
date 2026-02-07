/**
 * API Configuration
 * Centralized configuration for API endpoints and base URL
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export const API_CONFIG = {
  baseUrl: API_BASE_URL,
  endpoints: {
    v1Chat: {
      send: '/api/v1/chat',
      retry: '/api/v1/chat/retry',
      edit: '/api/v1/chat/edit',
    },
    v1Conversations: {
      list: '/api/v1/conversations',
      messages: (id: string) => `/api/v1/conversations/${id}/messages`,
      delete: (id: string) => `/api/v1/conversations/${id}`,
    },
    models: {
      list: '/api/v1/models',
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
