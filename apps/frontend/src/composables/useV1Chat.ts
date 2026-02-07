/**
 * V1 Chat Composable
 * Uses @ai-sdk/vue Chat class with DefaultChatTransport
 * to communicate with the backend v1 chat API.
 *
 * Follows the AI SDK "Chatbot Message Persistence" patterns:
 * - Sends only the last user UIMessage to the backend
 * - Backend loads previous messages from DB
 * - Uses validateUIMessages when loading stored messages
 */

import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport, validateUIMessages, type UIMessage } from 'ai'
import { computed, ref, shallowRef, watch } from 'vue'
import { useV1ConversationRoute } from './useV1ConversationRoute'
import { useAppStore } from '@/stores/app'
import { getApiUrl, API_CONFIG } from '@/config/api'
import { useQueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import { getV1ConversationMessages } from '@/api/chatService'

/**
 * V1 Chat state and operations
 * Uses AI SDK Chat class for streaming with the v1 backend API
 */
export function useV1Chat() {
  const { conversationId, navigateToConversation } = useV1ConversationRoute()
  const appStore = useAppStore()
  const queryClient = useQueryClient()

  // Track the conversation ID for the current chat session
  // This may differ from the route param during new conversation creation
  const chatConversationId = ref<string | undefined>(conversationId.value)

  // Sync route conversationId to our tracked ID
  watch(conversationId, (id) => {
    chatConversationId.value = id
  })

  /**
   * Get the provider name for the currently selected model.
   */
  function getProvider(): string {
    return appStore.userSelectedProvider ?? appStore.userSelectedModel?.providerId ?? 'ollama-local'
  }

  // Create transport with custom request preparation
  const transport = new DefaultChatTransport({
    api: getApiUrl(API_CONFIG.endpoints.v1Chat.send),

    /**
     * Transform the request to match our backend v1 API format.
     *
     * Per the AI SDK persistence pattern, we send only the last user UIMessage.
     * The backend loads previous messages from DB and combines them.
     */
    prepareSendMessagesRequest: ({ messages, trigger, messageId }) => {
      const provider = getProvider()
      const model = appStore.userSelectedModelName
      const enableWebTools = appStore.canUseWebTools && appStore.useWebTools
      const enableCodeTools = false
      const enableThinking = appStore.canThink && appStore.shouldThink

      if (!model) {
        throw new Error('No model selected')
      }

      // Retry: regenerate the last assistant message
      if (trigger === 'regenerate-message' && messageId) {
        return {
          api: getApiUrl(API_CONFIG.endpoints.v1Chat.retry),
          body: {
            provider,
            model,
            messageId, // UIMessage ID (string)
            conversationId: chatConversationId.value,
            enableWebTools,
            enableCodeTools,
            enableThinking,
            responseFormat: 'ui',
          },
        }
      }

      // Send new message: send the last UIMessage (from the Chat class)
      const lastMessage = messages[messages.length - 1]

      return {
        body: {
          provider,
          model,
          message: lastMessage, // Full UIMessage with id, role, parts
          conversationId: chatConversationId.value,
          enableWebTools,
          enableCodeTools,
          enableThinking,
          responseFormat: 'ui',
        },
      }
    },

    /**
     * Custom fetch to intercept response headers.
     * Extracts X-Conversation-Id for new conversations.
     */
    fetch: async (url, init) => {
      const response = await fetch(url as string, init as RequestInit)

      // Extract conversation ID from response headers for new conversations
      const convId = response.headers.get('X-Conversation-Id')
      if (convId && !chatConversationId.value) {
        chatConversationId.value = convId
        navigateToConversation(convId)
        // Invalidate v1 chats list to show in sidebar
        queryClient.invalidateQueries({ queryKey: ['chats'] })
      }

      return response
    },
  })

  // Create the reactive Chat instance from @ai-sdk/vue
  const chatRef = shallowRef<Chat<UIMessage>>(
    new Chat<UIMessage>({
      transport,
      onError: (error: unknown) => {
        console.error('V1 Chat error:', error)
        toast.error('Chat error', {
          description: error instanceof Error ? error.message : 'An error occurred',
        })
      },
      onFinish: ({ message }) => {
        console.log('V1 Chat finished:', message.id)
      },
    }),
  )

  const chat = chatRef.value

  // Reactive accessors - these read from the Chat's Vue-reactive state
  const messages = computed(() => chat.messages)
  const status = computed(() => chat.status)
  const isStreaming = computed(() => chat.status === 'streaming' || chat.status === 'submitted')
  const error = computed(() => chat.error)
  const isEmpty = computed(() => chat.messages.length === 0)

  /**
   * Send a message to the chat
   */
  async function sendMessage(text: string) {
    if (!appStore.userSelectedModel) {
      toast.error('No model selected', {
        description: 'Please select a model before sending a message.',
      })
      return
    }

    if (!text.trim()) return

    await chat.sendMessage({ text })
  }

  /**
   * Regenerate the last assistant message
   */
  async function regenerate(messageId?: string) {
    if (!appStore.userSelectedModel) {
      toast.error('No model selected', {
        description: 'Please select a model before retrying.',
      })
      return
    }

    await chat.regenerate({ messageId })
  }

  /**
   * Clear error state
   */
  function clearError() {
    chat.clearError()
  }

  /**
   * Load conversation history from the backend.
   * Uses validateUIMessages per the AI SDK docs:
   * "When loading messages from storage that contain tools, metadata,
   * or custom data parts, validate them using validateUIMessages."
   */
  async function loadConversation(id: string) {
    try {
      const rawMessages = await getV1ConversationMessages(id)
      // Validate stored messages (structural validation without tool schemas)
      const validated = await validateUIMessages({ messages: rawMessages })
      chat.messages = validated
    } catch (err) {
      console.error('Failed to load v1 conversation:', err)
      toast.error('Failed to load conversation history', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  // Handle route changes: load history or reset for new chat
  watch(
    conversationId,
    (id) => {
      if (!id) {
        chat.messages = []
        chatConversationId.value = undefined
      } else {
        // Load messages for existing conversation
        loadConversation(id)
      }
    },
    { immediate: true },
  )

  return {
    messages,
    status,
    isStreaming,
    error,
    isEmpty,
    sendMessage,
    regenerate,
    clearError,
  }
}
