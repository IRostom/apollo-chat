/**
 * Chat API Service
 * Handles conversation and history API calls
 * Note: Message streaming is now handled by @ai-sdk/vue useChat
 */

import { getApiUrl, API_CONFIG } from '@/config/api'
import type { ChatMessageServer, Conversation } from '@/types/chat'

/**
 * Get a conversation's messages by ID
 */
export async function getConversation(id: string): Promise<ChatMessageServer[]> {
  const response = await fetch(getApiUrl(API_CONFIG.endpoints.conversations.get(id)))

  if (!response.ok) {
    const res = await response.json()
    throw new Error(res.error || 'Failed to fetch chat history')
  }

  return response.json()
}

/**
 * Get all conversations
 */
export async function getConversations(): Promise<Conversation[]> {
  const response = await fetch(getApiUrl(API_CONFIG.endpoints.conversations.list))

  if (!response.ok) {
    throw new Error(`network response failed: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Delete a conversation by ID
 */
export async function deleteConversation(id: string): Promise<void> {
  const response = await fetch(getApiUrl(API_CONFIG.endpoints.conversations.delete(id)), {
    method: 'DELETE',
  })

  if (!response.ok) {
    const res = await response.json().catch(() => ({ error: 'Failed to delete conversation' }))
    throw new Error(res.error || 'Failed to delete conversation')
  }
}

/**
 * Branch a conversation from a specific message
 * Creates a new conversation with messages up to the specified message
 */
export async function branchConversation(
  conversationId: string,
  messageId: number,
): Promise<{ conversationId: string }> {
  const response = await fetch(getApiUrl(API_CONFIG.endpoints.chat.branch), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversationId,
      messageId,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to branch conversation')
  }

  return response.json()
}
