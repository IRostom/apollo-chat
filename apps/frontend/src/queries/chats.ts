import { useQuery } from '@tanstack/vue-query'
import { getConversations } from '@/api/chatService'

export function useChats() {
  return useQuery({
    queryKey: ['chats'],
    queryFn: async () => {
      return getConversations()
    },
    initialData: [],
  })
}
