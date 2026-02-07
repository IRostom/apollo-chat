import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { deleteV1Conversation } from '@/api/chatService'

export function useDeleteConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (conversationId: string) => {
      return deleteV1Conversation(conversationId)
    },
    onSuccess: (_data, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['chats'] })
      queryClient.removeQueries({ queryKey: ['v1-chat', conversationId] })
    },
  })
}
