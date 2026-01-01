/**
 * Chat Stream Query
 * Handles streaming state and frame processing for chat messages
 */

import { computed, ref, type Ref } from 'vue'
import { sendMessage } from '@/api/chatService'
import type { ChatMessage, StreamFrame } from '@/types/chat'

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
  }) => {
    const { model, displayMessage, serverMessage, think, webTools } = options

    isStreaming.value = true
    // Push user message for display
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
        (frame: StreamFrame) => {
          switch (frame.type) {
            case 'start':
              // Stream started
              isStreaming.value = true
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
              if (
                frame.value !== undefined &&
                frame.value !== null &&
                typeof frame.value === 'boolean'
              ) {
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
              if (frame.value) {
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
              // Stream completed
              isStreaming.value = false
              break

            case 'error':
              // Error occurred
              isStreaming.value = false
              throw new Error(frame.message || 'Unknown error occurred')

            default:
              console.warn('Unknown frame type:', frame.type)
          }
        },
      )
    } catch (error) {
      isStreaming.value = false
      console.error('Error in chat stream:', error)
      throw error
    }
  }

  const resetMessages = () => {
    messages.value = []
  }

  return {
    isStreaming,
    isThinking,
    newConversationId,
    send,
    messages,
    resetMessages,
  }
}
