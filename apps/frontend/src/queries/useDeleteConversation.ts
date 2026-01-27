import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { deleteConversation } from '@/api/chatService'

export function useDeleteConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (conversationId: string) => {
      return deleteConversation(conversationId)
    },
    onSuccess: (_data, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['chats'] })
      queryClient.removeQueries({ queryKey: ['chat', conversationId] })
    },
  })
}
