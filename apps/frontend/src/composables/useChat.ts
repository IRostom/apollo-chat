/**
 * Chat Composable
 * Orchestration layer for chat functionality
 * Responsibility: Combine local + server history, routing, store values, markdown, file uploads
 */

import { computed, watch } from 'vue'
import { useChatStream } from '@/queries/useChatStream'
import { useChatHistory } from '@/queries/useChatHistory'
import { useConversationRoute } from './useConversationRoute'
import { renderMarkdown } from './useMarkdown'
import { useAppStore } from '@/stores/app'
import type { ChatMessage } from '@/types/chat'
import { useUploadFile } from '@/queries/upload'
import { toast } from 'vue-sonner'
import { useQueryClient } from '@tanstack/vue-query'

/**
 * Chat state and operations
 * Combines streaming, history, routing, and file upload functionality
 */
export function useChat() {
  const { conversationId, skipRefetchForId, navigateToConversation } = useConversationRoute()
  const appStore = useAppStore()
  const { files, uploadFile, reset: resetFiles } = useUploadFile()
  const queryClient = useQueryClient()

  const {
    send: sendStreamMessage,
    retry: retryStreamMessage,
    isStreaming,
    isThinking,
    newConversationId,
    streamError,
    messages: localHistory,
    resetMessages,
    clearError,
  } = useChatStream(conversationId)

  const {
    data: chatHistoryServer,
    isError: isChatHistoryError,
    error: chatHistoryError,
  } = useChatHistory(conversationId, skipRefetchForId)

  watch(isChatHistoryError, (isChatHistoryError) => {
    if (isChatHistoryError) {
      console.log('chatHistoryError: ', chatHistoryError.value)
      toast.error('Failed to fetch chat history', {
        description: chatHistoryError.value?.message,
      })
    }
  })

  // Transform server history with markdown rendering
  const chatHistoryServerWithMd = computed(() => {
    return (chatHistoryServer.value ?? []).map((m) => ({
      ...m,
      content: m.role === 'assistant' ? renderMarkdown(m.content) : m.content,
    }))
  })

  // Transform local history with markdown rendering
  const chatWithMd = computed(() => {
    return localHistory.value.map((m) => ({
      ...m,
      content: m.role === 'assistant' ? renderMarkdown(m.content) : m.content,
    }))
  })

  // Combined chat history (server + local) with markdown
  const combinedChatMd = computed(() => {
    return [...(chatHistoryServerWithMd.value ?? []), ...chatWithMd.value]
  })

  // Navigate when a new conversation is created
  watch(newConversationId, (id) => {
    if (id) {
      queryClient.invalidateQueries({ queryKey: ['chats'] })
      navigateToConversation(id)
    }
  })

  // Reset local messages when server history changes (conversation loaded)
  watch(chatHistoryServer, () => {
    resetMessages()
  })

  // Reset local messages when navigating to a new conversation
  watch(conversationId, (id) => {
    if (!id) {
      resetMessages()
    }
  })

  /**
   * Prepare message with image transformations
   * Creates display version (with URLs) and server version (with IDs)
   */
  function prepareMessageWithImages(message: ChatMessage) {
    const currentFiles = files.value

    // Message for local display (includes image URLs for rendering)
    const displayMessage: ChatMessage = { ...message }
    if (currentFiles.length) {
      displayMessage.images = currentFiles.map((f) => f.path!)
    }

    // Message for server (includes image IDs for storage)
    const serverMessage: ChatMessage = { ...message }
    if (currentFiles.length) {
      serverMessage.images = currentFiles.map((f) => f.id!)
    }

    return { displayMessage, serverMessage }
  }

  /**
   * Send a message
   * Model and options are retrieved from the store automatically
   */
  async function sendMessage(message: ChatMessage) {
    if (!appStore.userSelectedModel) {
      throw new Error('No model selected. Please select a model before sending a message.')
    }

    const { displayMessage, serverMessage } = prepareMessageWithImages(message)

    await sendStreamMessage({
      model: appStore.userSelectedModelName!,
      displayMessage,
      serverMessage,
      think: appStore.canThink && appStore.shouldThink,
      webTools: appStore.canUseWebTools && appStore.useWebTools,
    })

    resetFiles()
  }

  /**
   * Attach an image file to the chat
   */
  function attachImageToChat(file: File) {
    uploadFile(file)
  }

  /**
   * Retry the last failed message
   * Uses the server-side retry endpoint to delete old messages and regenerate
   */
  async function retryLastMessage() {
    if (!appStore.userSelectedModel) {
      throw new Error('No model selected. Please select a model before retrying.')
    }

    if (!conversationId.value) {
      console.error('Cannot retry without a conversation ID')
      return
    }

    // Clear the error state
    clearError()

    // Find the last assistant message with an error (from server or local history)
    const allMessages = [...(chatHistoryServer.value ?? []), ...localHistory.value]
    const lastAssistantMessage = allMessages.findLast(
      (msg) => msg.role === 'assistant' && msg.isError,
    )

    if (!lastAssistantMessage?.id) {
      console.error('No failed assistant message found to retry')
      return
    }

    // Call the retry endpoint with the assistant message ID
    await retryStreamMessage({
      messageId: lastAssistantMessage.id,
      model: appStore.userSelectedModelName!,
      think: appStore.canThink && appStore.shouldThink,
      webTools: appStore.canUseWebTools && appStore.useWebTools,
      onInvalidate: () => {
        // Invalidate the chat history query to refetch from server
        queryClient.invalidateQueries({ queryKey: ['chat', conversationId] })
      },
    })
  }

  return {
    chatMd: combinedChatMd,
    files,
    isStreaming,
    isThinking,
    streamError,
    sendMessage,
    attachImageToChat,
    retryLastMessage,
  }
}
