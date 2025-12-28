/**
 * Chat composable
 * Handles chat state management and message sending
 */

import { ref, computed, watch } from 'vue'
import { useChat as useChatQuery } from '@/queries/chat'
import { useChatHistory } from '@/queries/chatHistory'
import { useConversation } from './useConversation'
import { renderMarkdown } from './useMarkdown'
import { useAppStore } from '@/stores/app'
import type { ChatMessage } from '@/types/chat'

/**
 * Chat state and operations
 */
export function useChat() {
  const { conversationId, skipRefetchForId, navigateToConversation } = useConversation()
  const appStore = useAppStore()

  const {
    send: sendMsg,
    isStreaming,
    newConversationId,
    messages: localHistory,
    resetMessages,
  } = useChatQuery(conversationId)
  const { data: chatHistoryServer } = useChatHistory(conversationId, skipRefetchForId)

  const chatHistoryServerWithMd = computed(() => {
    return (chatHistoryServer.value ?? []).map((m) => {
      return { ...m, content: m.role === 'assistant' ? renderMarkdown(m.content) : m.content }
    })
  })

  // Local chat state
  const chatWithMd = computed(() => {
    return localHistory.value.map((m) => {
      return { ...m, content: m.role === 'assistant' ? renderMarkdown(m.content) : m.content }
    })
  })

  // Watch for new conversation ID and navigate
  watch(newConversationId, () => {
    if (newConversationId.value) {
      navigateToConversation(newConversationId.value)
    }
  })

  /**
   * Send a message
   * Model is retrieved from the store automatically
   */
  async function sendMessage(message: ChatMessage) {
    if (!appStore.userSelectedModel) {
      throw new Error('No model selected. Please select a model before sending a message.')
    }

    await sendMsg({
      model: appStore.userSelectedModel,
      message,
      think: appStore.shouldThink,
      webTools: appStore.useWebTools,
    })
  }

  watch(chatHistoryServer, () => {
    resetMessages()
  })

  watch(conversationId, () => {
    if (conversationId.value) {
      return
    }
    resetMessages()
  })

  const combinedChatMd = computed(() => {
    return [...(chatHistoryServerWithMd.value ?? []), ...chatWithMd.value]
  })

  return {
    chatMd: combinedChatMd,
    isStreaming,
    sendMessage,
  }
}
