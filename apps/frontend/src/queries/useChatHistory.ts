/**
 * Chat History Query
 * Fetches server-side chat history using Vue Query
 */

import { useQuery } from '@tanstack/vue-query'
import type { ComputedRef, Ref } from 'vue'
import { getConversation } from '@/api/chatService'

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
      return getConversation(chatId.value)
    },
    enabled: () => {
      return !!chatId.value
    },
  })
}
