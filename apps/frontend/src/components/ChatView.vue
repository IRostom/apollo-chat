<script setup lang="ts">
import { useChat } from '@/composables/useChat'
import ChatMessages from './chat/ChatMessages.vue'
import ChatInput from './chat/ChatInput.vue'
import type { ChatMessage } from '@/types/chat'

const {
  chatMd,
  isStreaming,
  isThinking,
  sendMessage,
  stopGeneration,
  files,
  attachImageToChat,
  retryMessage,
} = useChat()

async function handleSend(message: string) {
  const userMessage: ChatMessage = {
    role: 'user',
    content: message,
  }

  await sendMessage(userMessage)
}

async function handleRetry(assistantMessageId: number) {
  await retryMessage(assistantMessageId)
}

function handleStop() {
  stopGeneration()
}
</script>

<template>
  <div class="flex flex-col h-full">
    <ChatMessages
      :messages="chatMd"
      :is-streaming="isStreaming"
      :is-thinking="isThinking"
      @retry="handleRetry"
    />
    <ChatInput
      :files
      :is-streaming="isStreaming"
      @send="handleSend"
      @stop="handleStop"
      @attach="attachImageToChat"
    />
  </div>
</template>

<style scoped></style>
