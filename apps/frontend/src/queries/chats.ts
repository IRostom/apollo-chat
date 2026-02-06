import { useQuery } from '@tanstack/vue-query'
import { getConversations, getV1Conversations } from '@/api/chatService'

export function useChats() {
  return useQuery({
    queryKey: ['chats'],
    queryFn: async () => {
      return getConversations()
    },
    initialData: [],
  })
}

export function useV1Chats() {
  return useQuery({
    queryKey: ['v1-chats'],
    queryFn: async () => {
      return getV1Conversations()
    },
    initialData: [],
  })
}
