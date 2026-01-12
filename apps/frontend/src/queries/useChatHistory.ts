/**
 * Chat History Query
 * Fetches server-side chat history using Vue Query
 */

import { useQuery } from '@tanstack/vue-query'
import type { ComputedRef, Ref } from 'vue'
import { getConversation } from '@/api/chatService'
import type { ChatMessage, ChatMessageServer } from '@/types/chat'

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
 * Fetches chat history from the server
 * Responsibility: Server history fetching via Vue Query
 */
export function useChatHistory(chatId: Ref<string | undefined> | ComputedRef<string | undefined>) {
  return useQuery({
    queryKey: ['chat', chatId],
    queryFn: async () => {
      if (!chatId.value) {
        throw new Error('Chat ID is required')
      }
      const json: ChatMessageServer[] = await getConversation(chatId.value)
      const mapped: ChatMessage[] = json.map((m) => {
        const isError = m.role === 'assistant' && hasServerError(m.metadata)
        return {
          ...m,
          toolName: m.tool_name,
          isError,
        }
      })
      return mapped
    },
    enabled: () => {
      return !!chatId.value
    },
  })
}
