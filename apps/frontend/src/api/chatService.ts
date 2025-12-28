/**
 * Chat API Service
 * Handles all API calls related to chat functionality
 */

import { getApiUrl, API_CONFIG } from '@/config/api'
import type {
  ChatMessage,
  ChatMessageServer,
  Conversation,
  Model,
  SendMessageOptions,
  StreamFrame,
} from '@/types/chat'

/**
 * Stream handler function type
 */
export type StreamHandler = (frame: StreamFrame) => void

/**
 * Send a message and stream the response
 */
export async function sendMessage(
  options: SendMessageOptions,
  onFrame: StreamHandler,
): Promise<void> {
  const { model, message, conversationId, webTools, think } = options

  const response = await fetch(getApiUrl(API_CONFIG.endpoints.chat.stream), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      message,
      conversationId: conversationId || undefined,
      webTools,
      think,
    }),
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  if (!response.body) {
    throw new Error('Response body is null')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    // Decode the chunk and add to buffer
    buffer += decoder.decode(value, { stream: true })

    // Process complete lines (NDJSON format)
    const lines = buffer.split('\n')
    buffer = lines.pop() || '' // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue

      try {
        const frame = JSON.parse(line) as StreamFrame
        onFrame(frame)
      } catch (parseError) {
        console.error('Error parsing frame:', parseError, 'Line:', line)
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim()) {
    try {
      const frame = JSON.parse(buffer) as StreamFrame
      onFrame(frame)
    } catch (e) {
      // Ignore parse errors for incomplete frames
    }
  }
}

/**
 * Get a conversation by ID
 */
export async function getConversation(id: string): Promise<ChatMessage[]> {
  const response = await fetch(getApiUrl(API_CONFIG.endpoints.conversations.get(id)))

  if (!response.ok) {
    throw new Error(`network response failed: ${response.statusText}`)
  }

  const json: ChatMessageServer[] = await response.json()
  const mapped = json.map((m) => {
    return {
      ...m,
      toolName: m.tool_name,
    }
  })

  return mapped
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
 * Get available models
 */
export async function getModels(): Promise<Model[]> {
  const response = await fetch(getApiUrl(API_CONFIG.endpoints.models.list))

  if (!response.ok) {
    throw new Error(`network response failed: ${response.statusText}`)
  }

  const data = await response.json()
  return data.models as Model[]
}
