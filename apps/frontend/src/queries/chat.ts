import { computed, ref, type Ref } from 'vue'
import { sendMessage } from '@/api/chatService'
import type { ChatMessage, SendMessageOptions, StreamFrame } from '@/types/chat'

export function useChat(conversationId: Ref<string | undefined>) {
  const isStreaming: Ref<boolean> = ref(false)
  const isThinking: Ref<boolean> = ref(false)
  const newConversationId: Ref<string> = ref('')
  const messages: Ref<ChatMessage[]> = ref([])
  const currIndex = computed(() => messages.value.length - 1)

  const send = async (options: SendMessageOptions) => {
    const { model, message, think, webTools, images } = options

    const messageWithImageIds: ChatMessage = { ...message }
    if (images?.length) {
      messageWithImageIds.images = images.map((f) => f.id!)
    }

    const messageWithImageUrls: ChatMessage = { ...message }
    if (images?.length) {
      messageWithImageUrls.images = images.map((f) => f.path!)
    }

    isStreaming.value = true
    // push user message
    messages.value.push(messageWithImageUrls)
    try {
      await sendMessage(
        {
          model,
          message: messageWithImageIds,
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
              // push placeholder for new message
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
                // response.value += frame.value
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
    newConversationId,
    send,
    messages,
    resetMessages,
  }
}
