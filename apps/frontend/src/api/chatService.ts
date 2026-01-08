/**
 * Chat API Service
 * Handles all API calls related to chat functionality
 */

import { getApiUrl, API_CONFIG } from '@/config/api'
import type {
  ChatMessage,
  ChatMessageServer,
  Conversation,
  RetryMessageOptions,
  SendMessageOptions,
  StreamFrame,
} from '@/types/chat'

/**
 * Stream handler function type
 */
export type StreamHandler = (frame: StreamFrame) => void

/**
 * Stream NDJSON from an endpoint and call onFrame for each parsed frame
 */
async function streamFromEndpoint(
  url: string,
  body: object,
  onFrame: StreamHandler,
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
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
    } catch {
      // Ignore parse errors for incomplete frames
    }
  }
}

/**
 * Send a message and stream the response
 */
export async function sendMessage(
  options: SendMessageOptions,
  onFrame: StreamHandler,
): Promise<void> {
  const { model, message, conversationId, webTools, think } = options

  await streamFromEndpoint(
    getApiUrl(API_CONFIG.endpoints.chat.stream),
    {
      model,
      message,
      conversationId: conversationId || undefined,
      webTools,
      think,
    },
    onFrame,
  )
}

/**
 * Retry a message and stream the response
 */
export async function retryMessage(
  options: RetryMessageOptions,
  onFrame: StreamHandler,
): Promise<void> {
  const { messageId, conversationId, model, think, webTools } = options

  await streamFromEndpoint(
    getApiUrl(API_CONFIG.endpoints.chat.retry),
    {
      messageId,
      conversationId,
      model,
      think,
      webTools,
    },
    onFrame,
  )
}

/**
 * Check if a message has a server error based on its metadata
 */
function hasServerError(metadata?: string): boolean {
  if (!metadata) return false
  try {
    const parsed = JSON.parse(metadata)
    return parsed.done === false && parsed.done_reason === 'server_error'
  } catch {
    return false
  }
}

/**
 * Get a conversation by ID
 */
export async function getConversation(id: string): Promise<ChatMessage[]> {
  const response = await fetch(getApiUrl(API_CONFIG.endpoints.conversations.get(id)))

  if (!response.ok) {
    const res = await response.json()
    throw new Error(res.error || 'Failed to fetch chat history')
  }

  const json: ChatMessageServer[] = await response.json()
  const mapped = json.map((m) => {
    const isError = m.role === 'assistant' && hasServerError(m.metadata)
    return {
      ...m,
      toolName: m.tool_name,
      isError,
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
