/**
 * Chat API Service (v1)
 */

import { getApiUrl, API_CONFIG } from '@/config/api'
import type { Conversation } from '@/types/chat'
import type { UIMessage } from 'ai'

/**
 * Get all v1 conversations
 */
export async function getV1Conversations(): Promise<Conversation[]> {
  const response = await fetch(getApiUrl(API_CONFIG.endpoints.v1Conversations.list))

  if (!response.ok) {
    throw new Error(`network response failed: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Get messages for a v1 conversation in UIMessage format
 */
export async function getV1ConversationMessages(id: string): Promise<UIMessage[]> {
  const response = await fetch(getApiUrl(API_CONFIG.endpoints.v1Conversations.messages(id)))

  if (!response.ok) {
    const res = await response.json()
    throw new Error(res.error || 'Failed to fetch v1 chat history')
  }

  return response.json()
}

/**
 * Delete a v1 conversation
 */
export async function deleteV1Conversation(id: string): Promise<void> {
  const response = await fetch(getApiUrl(API_CONFIG.endpoints.v1Conversations.delete(id)), {
    method: 'DELETE',
  })

  if (!response.ok) {
    const res = await response.json().catch(() => ({ error: 'Failed to delete conversation' }))
    throw new Error(res.error || 'Failed to delete conversation')
  }
}
