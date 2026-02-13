import { useQuery } from '@tanstack/vue-query'
import { getV1Conversations } from '@/api/chatService'

export function useChats() {
  return useQuery({
    queryKey: ['chats'],
    queryFn: async () => {
      return getV1Conversations()
    },
    initialData: [],
  })
}
