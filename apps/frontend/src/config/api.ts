/**
 * API Configuration
 * Centralized configuration for API endpoints and base URL
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export const API_CONFIG = {
  baseUrl: API_BASE_URL,
  endpoints: {
    chat: {
      stream: '/chat/stream',
    },
    conversations: {
      list: '/conversations',
      get: (id: string) => `/conversations/${id}`,
    },
    models: {
      list: '/ollama/models',
    },
  },
} as const

/**
 * Get full URL for an endpoint
 */
export function getApiUrl(endpoint: string): string {
  return `${API_CONFIG.baseUrl}${endpoint}`
}

