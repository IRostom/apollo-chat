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
    const res = await response.json().catch(() => ({ error: 'Failed to fetch v1 chat history' }))
    throw new Error(res.error || 'Failed to fetch v1 chat history')
  }

  return response.json()
}

export interface EditV1MessageParams {
  conversationId: string
  messageId: string
  content: string
  provider: string
  model: string
  enableWebTools?: boolean
  enableCodeTools?: boolean
  enableThinking?: boolean
}

/**
 * Edit a user message and regenerate the response.
 * Returns the raw Response so the caller can consume the UIMessage stream.
 */
export function editV1Message(params: EditV1MessageParams): Promise<Response> {
  const {
    conversationId,
    messageId,
    content,
    provider,
    model,
    enableWebTools = false,
    enableCodeTools = false,
    enableThinking = false,
  } = params

  return fetch(getApiUrl(API_CONFIG.endpoints.v1Chat.edit), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      model,
      messageId,
      conversationId,
      content,
      enableWebTools,
      enableCodeTools,
      enableThinking,
      responseFormat: 'ui',
    }),
  })
}

/**
 * Branch a conversation at an assistant message.
 * Creates a new conversation with messages up to and including that message.
 * Returns the new conversation ID.
 */
export async function branchV1Conversation(
  conversationId: string,
  messageId: string
): Promise<string> {
  const response = await fetch(
    getApiUrl(API_CONFIG.endpoints.v1Conversations.branch(conversationId)),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId }),
    }
  )

  if (!response.ok) {
    const res = await response.json().catch(() => ({ error: 'Failed to branch conversation' }))
    throw new Error(res.error || 'Failed to branch conversation')
  }

  const { id } = await response.json()
  return String(id)
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
