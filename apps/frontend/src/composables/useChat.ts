/**
 * Chat Composable
 * Orchestration layer for chat functionality
 * Responsibility: Combine local + server history, routing, store values, markdown, file uploads
 */

import { computed, ref, watch } from 'vue'
import { useChatStream } from '@/queries/useChatStream'
import { useChatHistory } from '@/queries/useChatHistory'
import { useConversationRoute } from './useConversationRoute'
import { renderMarkdown } from './useMarkdown'
import { useAppStore } from '@/stores/app'
import type { ChatMessage } from '@/types/chat'
import { useUploadFile } from '@/queries/upload'
import { toast } from 'vue-sonner'
import { useQueryClient } from '@tanstack/vue-query'
import { branchConversation as branchConversationApi } from '@/api/chatService'

/**
 * Chat state and operations
 * Combines streaming, history, routing, and file upload functionality
 */
export function useChat() {
  const { conversationId, navigateToConversation } = useConversationRoute()
  const appStore = useAppStore()
  const { files, uploadFile, reset: resetFiles } = useUploadFile()
  const queryClient = useQueryClient()

  const {
    send: sendStreamMessage,
    retry: retryStreamMessage,
    stop: stopGeneration,
    edit: editStreamMessage,
    isStreaming,
    isThinking,
    newConversationId,
    messages: localHistory,
    resetMessages,
  } = useChatStream(conversationId)

  // Track the message being edited
  const editingMessage = ref<ChatMessage | null>(null)

  const {
    data: chatHistoryServer,
    isError: isChatHistoryError,
    error: chatHistoryError,
  } = useChatHistory(conversationId)

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
      onStreamEnd: () => {
        console.log('onStreamEnd', conversationId.value)
        // Invalidate the chat history query to refetch from server
        queryClient.invalidateQueries({ queryKey: ['chat', conversationId.value] })
      },
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
  async function retryMessage(assistantMessageId: number) {
    if (!appStore.userSelectedModel) {
      throw new Error('No model selected. Please select a model before retrying.')
    }

    if (!conversationId.value) {
      console.error('Cannot retry without a conversation ID')
      return
    }

    // Call the retry endpoint with the assistant message ID
    await retryStreamMessage({
      messageId: assistantMessageId,
      model: appStore.userSelectedModelName!,
      think: appStore.canThink && appStore.shouldThink,
      webTools: appStore.canUseWebTools && appStore.useWebTools,
      onStreamEnd: () => {
        // Invalidate the chat history query to refetch from server
        queryClient.invalidateQueries({ queryKey: ['chat', conversationId.value] })
      },
      onInvalidate: () => {
        // Invalidate the chat history query to refetch from server
        queryClient.invalidateQueries({ queryKey: ['chat', conversationId.value] })
      },
    })
  }

  /**
   * Start editing a user message
   * Sets the editing state which should be used to populate the input
   */
  function editMessage(message: ChatMessage) {
    editingMessage.value = message
  }

  /**
   * Cancel editing mode
   */
  function cancelEdit() {
    editingMessage.value = null
  }

  /**
   * Submit an edited message
   * Updates the user message and regenerates the response
   */
  async function submitEditedMessage(newContent: string) {
    if (!appStore.userSelectedModel) {
      throw new Error('No model selected. Please select a model before editing.')
    }

    if (!conversationId.value) {
      console.error('Cannot edit without a conversation ID')
      return
    }

    if (!editingMessage.value?.id) {
      console.error('No message being edited or message has no ID')
      return
    }

    const messageId = editingMessage.value.id

    // Clear editing state
    editingMessage.value = null

    // Call the edit endpoint
    await editStreamMessage({
      messageId,
      content: newContent,
      model: appStore.userSelectedModelName!,
      think: appStore.canThink && appStore.shouldThink,
      webTools: appStore.canUseWebTools && appStore.useWebTools,
      onStreamEnd: () => {
        // Invalidate the chat history query to refetch from server
        queryClient.invalidateQueries({ queryKey: ['chat', conversationId.value] })
      },
      onInvalidate: () => {
        // Invalidate the chat history query to refetch from server
        queryClient.invalidateQueries({ queryKey: ['chat', conversationId.value] })
      },
    })
  }

  /**
   * Branch the conversation from a specific assistant message
   * Creates a new conversation with messages up to that point
   */
  async function branchConversation(assistantMessageId: number) {
    if (!conversationId.value) {
      console.error('Cannot branch without a conversation ID')
      return
    }

    try {
      const result = await branchConversationApi(conversationId.value, assistantMessageId)

      // Invalidate the chats list to show the new conversation
      queryClient.invalidateQueries({ queryKey: ['chats'] })

      // Navigate to the new conversation
      navigateToConversation(result.conversationId)

      toast.success('Conversation branched successfully')
    } catch (error) {
      console.error('Failed to branch conversation:', error)
      toast.error('Failed to branch conversation')
    }
  }

  return {
    chatMd: combinedChatMd,
    files,
    isStreaming,
    isThinking,
    editingMessage,
    sendMessage,
    stopGeneration,
    attachImageToChat,
    retryMessage,
    editMessage,
    cancelEdit,
    submitEditedMessage,
    branchConversation,
  }
}
