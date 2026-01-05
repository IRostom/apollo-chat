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

/**
 * Chat state and operations
 * Combines streaming, history, routing, and file upload functionality
 */
export function useChat() {
  const { conversationId, skipRefetchForId, navigateToConversation } = useConversationRoute()
  const appStore = useAppStore()
  const { files, uploadFile, reset: resetFiles } = useUploadFile()

  const {
    send: sendStreamMessage,
    isStreaming,
    isThinking,
    newConversationId,
    messages: localHistory,
    resetMessages,
  } = useChatStream(conversationId)

  const { data: chatHistoryServer } = useChatHistory(conversationId, skipRefetchForId)

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

  return {
    chatMd: combinedChatMd,
    files,
    isStreaming,
    isThinking,
    sendMessage,
    attachImageToChat,
  }
}
