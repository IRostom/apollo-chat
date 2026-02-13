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
import {
  DefaultChatTransport,
  parseJsonEventStream,
  readUIMessageStream,
  uiMessageChunkSchema,
  validateUIMessages,
  type FileUIPart,
  type UIMessage,
} from 'ai'
import { computed, ref, shallowRef, watch } from 'vue'
import { useV1ConversationRoute } from './useV1ConversationRoute'
import { useAppStore } from '@/stores/app'
import { getApiUrl, API_CONFIG } from '@/config/api'
import { useQueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import { editV1Message, getV1ConversationMessages, branchV1Conversation } from '@/api/chatService'
import type { ChatFile } from '@/types/chat'

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
      const enableCodeTools = appStore.canUseCodeTools && appStore.useCodeTools
      const enableThinking = appStore.canThink && appStore.shouldThink

      if (!model) {
        throw new Error('No model selected')
      }

      // Retry: regenerate the last assistant message
      if (trigger === 'regenerate-message') {
        return {
          body: {
            provider,
            model,
            trigger,
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
      if (!lastMessage) {
        throw new Error('No message to send')
      }

      return {
        body: {
          provider,
          model,
          trigger,
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
  const isStreaming = computed(
    () =>
      chat.status === 'streaming' ||
      chat.status === 'submitted' ||
      isEditStreaming.value,
  )
  const error = computed(() => chat.error)
  const isEmpty = computed(() => chat.messages.length === 0)

  const editingMessage = ref<{ id: string; content: string } | null>(null)
  const isEditStreaming = ref(false)

  function startEdit(message: { id: string; content: string }) {
    editingMessage.value = message
  }

  function cancelEdit() {
    editingMessage.value = null
  }

  async function submitEdit(newContent: string) {
    const msg = editingMessage.value
    if (!msg) return
    if (!appStore.userSelectedModel) {
      toast.error('No model selected', {
        description: 'Please select a model before editing.',
      })
      return
    }
    if (!chatConversationId.value) {
      toast.error('Cannot edit', {
        description: 'No conversation loaded.',
      })
      return
    }

    const targetIdx = chat.messages.findIndex((m) => m.id === msg.id)
    if (targetIdx === -1) {
      toast.error('Message not found')
      cancelEdit()
      return
    }

    const originalMsg = chat.messages[targetIdx]
    if (!originalMsg || originalMsg.role !== 'user') {
      toast.error('Cannot edit this message')
      cancelEdit()
      return
    }

    const updatedUserMessage: UIMessage = {
      ...originalMsg,
      id: originalMsg.id ?? msg.id,
      role: 'user',
      parts: [{ type: 'text' as const, text: newContent }],
    }
    const messagesBeforeEdit = [
      ...chat.messages.slice(0, targetIdx),
      updatedUserMessage,
    ]

    editingMessage.value = null
    isEditStreaming.value = true

    try {
      const response = await editV1Message({
        conversationId: chatConversationId.value,
        messageId: msg.id,
        content: newContent,
        provider: getProvider(),
        model: appStore.userSelectedModelName!,
        enableWebTools: appStore.canUseWebTools && appStore.useWebTools,
        enableCodeTools: appStore.canUseCodeTools && appStore.useCodeTools,
        enableThinking: appStore.canThink && appStore.shouldThink,
      })

      if (!response.ok) {
        const res = await response.json().catch(() => ({ error: 'Edit failed' }))
        throw new Error(res.error || 'Edit failed')
      }

      if (!response.body) {
        throw new Error('Empty response body')
      }

      const chunkStream = parseJsonEventStream({
        stream: response.body,
        schema: uiMessageChunkSchema,
      }).pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            if (chunk.success) controller.enqueue(chunk.value)
            else throw chunk.error
          },
        }),
      )

      for await (const uiMessage of readUIMessageStream({ stream: chunkStream })) {
        chat.messages = [...messagesBeforeEdit, uiMessage]
      }

      queryClient.invalidateQueries({ queryKey: ['chats'] })
    } catch (err) {
      console.error('Edit error:', err)
      toast.error('Edit failed', {
        description: err instanceof Error ? err.message : 'An error occurred',
      })
    } finally {
      isEditStreaming.value = false
    }
  }

  /**
   * Send a message to the chat
   */
  async function sendMessage(text: string, files?: ChatFile[]) {
    if (!appStore.userSelectedModel) {
      toast.error('No model selected', {
        description: 'Please select a model before sending a message.',
      })
      return false
    }

    if (!text.trim() && (!files || files.length === 0)) return false

    const uploadedFiles =
      files?.filter((file) => file.isUploaded && !file.isError && (file.key || file.url)) ?? []

    if (files?.length && uploadedFiles.length === 0) {
      toast.error('Files are still uploading', {
        description: 'Please wait for the upload to finish before sending.',
      })
      return false
    }

    const fileParts: FileUIPart[] = uploadedFiles.map((file) => ({
      type: 'file',
      filename: file.file.name,
      mediaType: file.file.type || 'application/octet-stream',
      url: file.key ?? file.url!,
    }))

    if (fileParts.length > 0) {
      await chat.sendMessage({ text, files: fileParts })
    } else {
      await chat.sendMessage({ text })
    }

    return true
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
   * Stop the current streaming response.
   */
  async function stop() {
    await chat.stop()
  }

  /**
   * Clear error state
   */
  function clearError() {
    chat.clearError()
  }

  let latestLoadId: string | undefined

  /**
   * Load conversation history from the backend.
   * Uses validateUIMessages per the AI SDK docs:
   * "When loading messages from storage that contain tools, metadata,
   * or custom data parts, validate them using validateUIMessages."
   * Guards against race conditions when navigating between conversations quickly.
   */
  async function loadConversation(id: string) {
    latestLoadId = id
    try {
      const rawMessages = await getV1ConversationMessages(id)
      if (latestLoadId !== id) return
      const validated = await validateUIMessages({ messages: rawMessages })
      if (latestLoadId !== id) return
      chat.messages = validated
    } catch (err) {
      if (latestLoadId !== id) return
      console.error('Failed to load v1 conversation:', err)
      toast.error('Failed to load conversation history', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  async function branchConversation(assistantMessageId: string) {
    const convId = chatConversationId.value
    if (!convId) {
      toast.error('Cannot branch', { description: 'No conversation loaded.' })
      return
    }
    try {
      const newConvId = await branchV1Conversation(convId, assistantMessageId)
      navigateToConversation(newConvId)
      queryClient.invalidateQueries({ queryKey: ['chats'] })
      toast.success('Branched to new conversation')
    } catch (err) {
      console.error('Branch error:', err)
      toast.error('Failed to branch', {
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
    editingMessage,
    startEdit,
    cancelEdit,
    submitEdit,
    sendMessage,
    regenerate,
    stop,
    branchConversation,
    clearError,
  }
}
