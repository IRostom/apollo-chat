/**
 * Chat API Service
 * Handles all API calls related to chat functionality
 */

import { getApiUrl, API_CONFIG } from '@/config/api'
import type {
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
 * Stream NDJSON frames from an endpoint and invoke `onFrame` for each parsed frame.
 *
 * @param signal - Optional AbortSignal to cancel the stream.
 * @returns `true` if streaming completed normally, `false` if aborted by the provided signal.
 */
async function streamFromEndpoint(
  url: string,
  body: object,
  onFrame: StreamHandler,
  signal?: AbortSignal,
): Promise<boolean> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
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

  try {
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

    return true // Completed normally
  } catch (error) {
    // Handle abort gracefully - not an error condition
    if (error instanceof Error && error.name === 'AbortError') {
      return false // Aborted by user
    }
    throw error // Re-throw other errors
  }
}

/**
 * Send a chat message and stream NDJSON frames from the server to the provided handler.
 *
 * @param options - Message send options (model, message, conversationId, webTools, think)
 * @param onFrame - Callback invoked for each streamed frame
 * @param signal - Optional AbortSignal to cancel the stream
 * @returns `true` if the stream completed normally, `false` if it was aborted
 */
export async function sendMessage(
  options: SendMessageOptions,
  onFrame: StreamHandler,
  signal?: AbortSignal,
): Promise<boolean> {
  const { model, message, conversationId, webTools, think } = options

  return streamFromEndpoint(
    getApiUrl(API_CONFIG.endpoints.chat.stream),
    {
      model,
      message,
      conversationId: conversationId || undefined,
      webTools,
      think,
    },
    onFrame,
    signal,
  )
}

/**
 * Retry sending a message to the chat endpoint and stream resulting NDJSON frames to the provided handler.
 *
 * @param options - Parameters including `messageId`, `conversationId`, `model`, `think`, and `webTools`
 * @param onFrame - Callback invoked for each parsed stream frame
 * @param signal - Optional AbortSignal to cancel the stream
 * @returns `true` if the stream completed normally, `false` if aborted
 */
export async function retryMessage(
  options: RetryMessageOptions,
  onFrame: StreamHandler,
  signal?: AbortSignal,
): Promise<boolean> {
  const { messageId, conversationId, model, think, webTools } = options

  return streamFromEndpoint(
    getApiUrl(API_CONFIG.endpoints.chat.retry),
    {
      messageId,
      conversationId,
      model,
      think,
      webTools,
    },
    onFrame,
    signal,
  )
}

/**
 * Get a conversation by ID
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