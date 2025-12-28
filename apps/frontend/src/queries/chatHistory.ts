import { useQuery } from '@tanstack/vue-query'
import type { ComputedRef, Ref } from 'vue'
import { getConversation } from '@/api/chatService'

export function useChatHistory(
  chatId: Ref<string | undefined> | ComputedRef<string | undefined>,
  skipRefetchForId?: Ref<string | undefined>,
) {
  const { isPending, isFetching, isError, data, error } = useQuery({
    queryKey: ['chat', chatId],
    queryFn: async () => {
      if (!chatId.value) {
        throw new Error('Chat ID is required')
      }
      return getConversation(chatId.value)
    },
    enabled: () => {
      // Skip refetch if this is the conversationId we're programmatically navigating to
      if (skipRefetchForId?.value && chatId.value === skipRefetchForId.value) {
        return false
      }
      return !!chatId.value
    },
  })

  return {
    data,
    isFetching,
  }
}
