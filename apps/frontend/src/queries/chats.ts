import { useQuery } from '@tanstack/vue-query'
import { getConversations } from '@/api/chatService'

export function useChats() {
  const { isPending, isFetching, isError, data, error } = useQuery({
    queryKey: ['chats'],
    queryFn: async () => {
      return getConversations()
    },
    initialData: [],
  })

  return {
    data,
    isFetching,
  }
}
