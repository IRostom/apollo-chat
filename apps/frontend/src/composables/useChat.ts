/**
 * Chat Composable
 * Uses AI SDK's Chat class with trigger-based routing for send/retry/edit
 */

import { computed, ref, watch, shallowRef, onUnmounted } from 'vue'
import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { useConversationRoute } from './useConversationRoute'
import { renderMarkdown } from './useMarkdown'
import { useAppStore } from '@/stores/app'
import type { ChatMessage } from '@/types/chat'
import { useUploadFile } from '@/queries/upload'
import { toast } from 'vue-sonner'
import { useQueryClient } from '@tanstack/vue-query'
import { branchConversation as branchConversationApi } from '@/api/chatService'
import { useChatHistory } from '@/queries/useChatHistory'
import { getApiUrl, API_CONFIG } from '@/config/api'

/**
 * Chat state and operations using AI SDK
 */
export function useChat() {
  const { conversationId, navigateToConversation } = useConversationRoute()
  const appStore = useAppStore()
  const { files, uploadFile, reset: resetFiles } = useUploadFile()
  const queryClient = useQueryClient()

  // Track the message being edited
  const editingMessage = ref<ChatMessage | null>(null)

  // Reactive state derived from Chat instance
  const messages = shallowRef<UIMessage[]>([])
  const status = ref<'submitted' | 'streaming' | 'ready' | 'error'>('ready')
  const error = ref<Error | undefined>(undefined)

  // Create Chat instance with transport
  const chat = shallowRef<Chat<UIMessage> | null>(null)

  function createChat() {
    const transport = new DefaultChatTransport({
      api: getApiUrl(API_CONFIG.endpoints.chat.api),
      // Use prepareSendMessagesRequest to dynamically set body for each request
      prepareSendMessagesRequest: (options) => {
        // The options include: messages, id, body, headers, credentials, api, trigger, messageId
        return {
          ...options,
          body: {
            ...options.body,
            // Include the messages from the options
            messages: options.messages,
            // Add our custom fields
            provider: appStore.userSelectedProvider,
            model: appStore.userSelectedModelId,
            webTools: appStore.useWebTools,
            trigger: options.trigger === 'regenerate-message' ? 'retry' : 'send',
            data: {
              conversationId: conversationId.value,
              messageId: options.messageId,
            },
          },
        }
      },
    })

    return new Chat<UIMessage>({
      transport,
      onFinish: () => {
        // Invalidate queries to refetch from server
        queryClient.invalidateQueries({ queryKey: ['chat', conversationId.value] })
        queryClient.invalidateQueries({ queryKey: ['chats'] })
        syncState()
      },
      onError: (err) => {
        console.error('Chat error:', err)
        toast.error('Failed to send message', {
          description: err.message,
        })
        syncState()
      },
    })
  }

  // Initialize chat
  chat.value = createChat()

  // Sync reactive state from Chat instance
  function syncState() {
    if (chat.value) {
      messages.value = chat.value.messages
      status.value = chat.value.status
      error.value = chat.value.error
    }
  }

  // Load server history for existing conversations
  const {
    data: chatHistoryServer,
    isError: isChatHistoryError,
    error: chatHistoryError,
  } = useChatHistory(conversationId)

  // Computed states
  const isStreaming = computed(() => status.value === 'streaming' || status.value === 'submitted')
  const isReady = computed(() => status.value === 'ready')

  // Watch for chat history errors
  watch(isChatHistoryError, (hasError) => {
    if (hasError) {
      toast.error('Failed to fetch chat history', {
        description: chatHistoryError.value?.message,
      })
    }
  })

  // Sync server history with Chat messages when conversation changes
  watch(
    [conversationId, chatHistoryServer],
    ([newConvId, serverHistory]) => {
      if (newConvId && serverHistory && serverHistory.length > 0) {
        // Convert server messages to AI SDK format
        const uiMessages: UIMessage[] = serverHistory.map((msg) => ({
          id: msg.id?.toString() || `server-${Date.now()}-${Math.random()}`,
          role: msg.role as UIMessage['role'],
          content: msg.content,
          parts: [{ type: 'text' as const, text: msg.content }],
        }))
        if (chat.value) {
          chat.value.messages = uiMessages
          syncState()
        }
      } else if (!newConvId) {
        // Clear messages for new conversation - recreate chat
        chat.value = createChat()
        syncState()
      }
      editingMessage.value = null
    },
    { immediate: true },
  )

  // Watch for model/provider changes and update transport
  watch(
    () => [appStore.userSelectedProvider, appStore.userSelectedModelId, appStore.useWebTools],
    () => {
      // Recreate chat with new transport settings
      const currentMessages = chat.value?.messages || []
      chat.value = createChat()
      if (currentMessages.length > 0) {
        chat.value.messages = currentMessages
      }
      syncState()
    },
  )

  // Transform messages with markdown rendering for display
  const chatMd = computed(() => {
    return messages.value.map((msg) => {
      // Extract text content from parts
      let textContent = ''
      if (msg.parts) {
        for (const part of msg.parts) {
          if (part.type === 'text') {
            textContent += part.text
          }
        }
      } else if (typeof msg.content === 'string') {
        textContent = msg.content
      }

      return {
        ...msg,
        content: msg.role === 'assistant' ? renderMarkdown(textContent) : textContent,
        // Keep original parts for tool display
        parts: msg.parts,
      }
    })
  })

  /**
   * Send a new message
   */
  async function sendMessage(message: ChatMessage) {
    if (!appStore.userSelectedModel) {
      throw new Error('No model selected. Please select a model before sending a message.')
    }

    if (!chat.value) {
      chat.value = createChat()
    }

    // The transport's prepareSendMessagesRequest handles adding provider, model, etc.
    await chat.value.sendMessage({
      text: message.content,
    })

    syncState()
    resetFiles()
  }

  /**
   * Retry from a specific assistant message
   */
  async function retryMessage(assistantMessageId: number) {
    if (!appStore.userSelectedModel) {
      throw new Error('No model selected. Please select a model before retrying.')
    }

    if (!conversationId.value || !chat.value) {
      console.error('Cannot retry without a conversation ID')
      return
    }

    // Use regenerate method with message ID
    // The transport's prepareSendMessagesRequest handles adding provider, model, etc.
    await chat.value.regenerate({
      messageId: String(assistantMessageId),
    })

    syncState()
  }

  /**
   * Start editing a user message
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
   */
  async function submitEditedMessage(newContent: string) {
    if (!appStore.userSelectedModel) {
      throw new Error('No model selected. Please select a model before editing.')
    }

    if (!conversationId.value || !editingMessage.value?.id || !chat.value) {
      console.error('Cannot edit without conversation ID or message ID')
      return
    }

    const messageId = editingMessage.value.id
    editingMessage.value = null

    // Use sendMessage with messageId to replace the message
    // The transport's prepareSendMessagesRequest handles adding provider, model, etc.
    await chat.value.sendMessage({
      text: newContent,
      messageId: String(messageId),
    })

    syncState()
  }

  /**
   * Stop the current generation
   */
  function stopGeneration() {
    chat.value?.stop()
    syncState()
  }

  /**
   * Set messages directly
   */
  function setMessages(newMessages: UIMessage[]) {
    if (chat.value) {
      chat.value.messages = newMessages
      syncState()
    }
  }

  /**
   * Attach an image file to the chat
   */
  function attachImageToChat(file: File) {
    uploadFile(file)
  }

  /**
   * Branch conversation from a specific message
   */
  async function branchConversation(assistantMessageId: number) {
    if (!conversationId.value) {
      console.error('Cannot branch without a conversation ID')
      return
    }

    try {
      const result = await branchConversationApi(conversationId.value, assistantMessageId)
      queryClient.invalidateQueries({ queryKey: ['chats'] })
      navigateToConversation(result.conversationId)
      toast.success('Conversation branched successfully')
    } catch (error) {
      console.error('Failed to branch conversation:', error)
      toast.error('Failed to branch conversation')
    }
  }

  return {
    // State
    chatMd,
    messages,
    files,
    isStreaming,
    isReady,
    status,
    error,
    editingMessage,

    // Actions
    sendMessage,
    stopGeneration,
    attachImageToChat,
    retryMessage,
    editMessage,
    cancelEdit,
    submitEditedMessage,
    branchConversation,
    setMessages,
  }
}
