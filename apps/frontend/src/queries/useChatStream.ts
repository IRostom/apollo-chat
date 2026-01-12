/**
 * Chat Stream Query
 * Handles streaming state and frame processing for chat messages
 */

import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { retryMessage, sendMessage } from '@/api/chatService'
import type { ChatMessage, RetryMessageOptions, StreamFrame } from '@/types/chat'

/**
 * Options for creating a frame handler
 */
interface FrameHandlerOptions {
  messages: Ref<ChatMessage[]>
  currIndex: ComputedRef<number>
  isStreaming: Ref<boolean>
  isThinking: Ref<boolean>
  newConversationId?: Ref<string>
  onInvalidate?: () => void
  onStreamEnd: () => void
}

/**
 * Creates a frame handler function for processing stream frames
 * Centralizes all frame type processing logic
 */
function createFrameHandler(options: FrameHandlerOptions): (frame: StreamFrame) => void {
  const {
    messages,
    currIndex,
    isStreaming,
    isThinking,
    newConversationId,
    onInvalidate,
    onStreamEnd,
  } = options

  return (frame: StreamFrame) => {
    switch (frame.type) {
      case 'start':
        isStreaming.value = true
        break

      case 'invalidate':
        // Server deleted old messages, clear local history and signal cache invalidation
        // messages.value = []
        onInvalidate?.()
        break

      case 'role':
        // Push placeholder for new message
        if (frame.value) {
          messages.value.push({
            role: frame.value.toString() as ChatMessage['role'],
            content: '',
            thinking: '',
          })
        }
        break

      case 'isThinking':
        if (frame.value !== undefined && frame.value !== null && typeof frame.value === 'boolean') {
          isThinking.value = frame.value
        }
        break

      case 'thinking':
        if (frame.value) {
          messages.value[currIndex.value]!.thinking =
            messages.value[currIndex.value]!.thinking! + frame.value
        }
        break

      case 'conversationId':
        // Update conversationId from server response
        if (frame.value && newConversationId) {
          newConversationId.value = frame.value.toString()
        }
        break

      case 'token':
        // Accumulate tokens
        if (frame.value) {
          messages.value[currIndex.value]!.content += frame.value
        }
        break

      case 'toolName':
        if (frame.value) {
          messages.value[currIndex.value]!.toolName = frame.value as string
        }
        break

      case 'toolValue':
        if (frame.value) {
          messages.value[currIndex.value]!.content = frame.value as string
        }
        break

      case 'end':
        isStreaming.value = false
        onStreamEnd?.()
        break

      case 'error':
        // Error occurred - mark the current assistant message as failed
        isStreaming.value = false
        if (currIndex.value >= 0 && messages.value[currIndex.value]) {
          messages.value[currIndex.value]!.isError = true
        }
        onStreamEnd?.()
        break

      default:
        console.warn('Unknown frame type:', frame.type)
    }
  }
}

/**
 * Manages chat streaming state and message accumulation
 * Responsibility: Stream handling, message accumulation, frame parsing
 */
export function useChatStream(conversationId: Ref<string | undefined>) {
  const isStreaming: Ref<boolean> = ref(false)
  const isThinking: Ref<boolean> = ref(false)
  const newConversationId: Ref<string> = ref('')
  const messages: Ref<ChatMessage[]> = ref([])
  const currIndex = computed(() => messages.value.length - 1)

  /**
   * Handle stream errors consistently
   */
  const handleStreamError = (error: unknown, context: string) => {
    isStreaming.value = false
    // Mark the last assistant message as failed if it exists
    if (currIndex.value >= 0 && messages.value[currIndex.value]?.role === 'assistant') {
      messages.value[currIndex.value]!.isError = true
    }
    console.error(`Error in chat stream ${context}:`, error)
  }

  /**
   * Send a message and handle the streaming response
   * Expects pre-processed messages (image transformation done by caller)
   */
  const send = async (options: {
    model: string
    /** Message to display locally (may have image URLs) */
    displayMessage: ChatMessage
    /** Message to send to server (may have image IDs) */
    serverMessage: ChatMessage
    think?: boolean
    webTools?: boolean
    onStreamEnd: () => void
  }) => {
    const { model, displayMessage, serverMessage, think, webTools, onStreamEnd } = options

    isStreaming.value = true
    messages.value.push(displayMessage)

    try {
      await sendMessage(
        {
          model,
          message: serverMessage,
          conversationId: conversationId?.value,
          think,
          webTools,
        },
        createFrameHandler({
          messages,
          currIndex,
          isStreaming,
          isThinking,
          newConversationId,
          onStreamEnd,
        }),
      )
    } catch (error) {
      handleStreamError(error, '')
    }
  }

  const resetMessages = () => {
    messages.value = []
  }

  /**
   * Retry a message and handle the streaming response
   * Calls onInvalidate when the server signals cache invalidation is needed
   */
  const retry = async (
    options: Omit<RetryMessageOptions, 'conversationId'> & {
      onInvalidate: () => void
      onStreamEnd: () => void
    },
  ) => {
    const { messageId, model, think, webTools, onInvalidate, onStreamEnd } = options

    if (!conversationId.value) {
      throw new Error('Cannot retry without a conversation ID')
    }

    isStreaming.value = true

    try {
      await retryMessage(
        {
          messageId,
          conversationId: conversationId.value,
          model,
          think,
          webTools,
        },
        createFrameHandler({
          messages,
          currIndex,
          isStreaming,
          isThinking,
          onInvalidate,
          onStreamEnd,
        }),
      )
    } catch (error) {
      handleStreamError(error, 'retry')
    }
  }

  return {
    isStreaming,
    isThinking,
    newConversationId,
    send,
    retry,
    messages,
    resetMessages,
  }
}
