/**
 * Chat Stream Query
 * Handles streaming state and frame processing for chat messages
 */

import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { editMessage, retryMessage, sendMessage } from '@/api/chatService'
import type { ChatMessage, EditMessageOptions, RetryMessageOptions, StreamFrame } from '@/types/chat'

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
        // Server deleted old messages, signal cache invalidation
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

  // AbortController for cancelling the current stream
  let abortController: AbortController | null = null

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
   * Stop the current generation
   * Aborts the ongoing stream and marks it as stopped (not error)
   */
  const stop = () => {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    isStreaming.value = false
    isThinking.value = false
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

    // Create new AbortController for this stream
    abortController = new AbortController()

    isStreaming.value = true
    messages.value.push(displayMessage)

    try {
      const completed = await sendMessage(
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
        abortController.signal,
      )

      // Only call onStreamEnd if not aborted (aborted streams handle their own cleanup)
      if (!completed) {
        // Stream was aborted - ensure streaming state is reset
        isStreaming.value = false
        isThinking.value = false
      }
    } catch (error) {
      handleStreamError(error, '')
    } finally {
      abortController = null
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

    // Create new AbortController for this stream
    abortController = new AbortController()

    isStreaming.value = true

    try {
      const completed = await retryMessage(
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
        abortController.signal,
      )

      // Only call onStreamEnd if not aborted (aborted streams handle their own cleanup)
      if (!completed) {
        // Stream was aborted - ensure streaming state is reset
        isStreaming.value = false
        isThinking.value = false
      }
    } catch (error) {
      handleStreamError(error, 'retry')
    } finally {
      abortController = null
    }
  }

  /**
   * Edit a user message and handle the streaming response
   * Updates the user message content, deletes subsequent messages, and regenerates
   */
  const edit = async (
    options: Omit<EditMessageOptions, 'conversationId'> & {
      onInvalidate: () => void
      onStreamEnd: () => void
    },
  ) => {
    const { messageId, content, model, think, webTools, onInvalidate, onStreamEnd } = options

    if (!conversationId.value) {
      throw new Error('Cannot edit without a conversation ID')
    }

    // Create new AbortController for this stream
    abortController = new AbortController()

    isStreaming.value = true

    try {
      const completed = await editMessage(
        {
          messageId,
          conversationId: conversationId.value,
          content,
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
        abortController.signal,
      )

      if (!completed) {
        // Stream was aborted - ensure streaming state is reset
        isStreaming.value = false
        isThinking.value = false
      }
    } catch (error) {
      handleStreamError(error, 'edit')
    } finally {
      abortController = null
    }
  }

  return {
    isStreaming,
    isThinking,
    newConversationId,
    send,
    retry,
    stop,
    edit,
    messages,
    resetMessages,
  }
}
