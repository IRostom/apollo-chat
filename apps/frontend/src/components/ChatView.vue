<script setup lang="ts">
import { useChat } from '@/composables/useChat'
import ChatMessages from './chat/ChatMessages.vue'
import ChatInput from './chat/ChatInput.vue'
import type { ChatMessage } from '@/types/chat'

const { chatMd, isStreaming, sendMessage } = useChat()

async function handleSend(message: string) {
  const userMessage: ChatMessage = {
    role: 'user',
    content: message,
  }

  await sendMessage(userMessage)
}
</script>

<template>
  <div class="flex flex-col h-full">
    <ChatMessages :messages="chatMd" :is-streaming="isStreaming" />
    <ChatInput :disabled="isStreaming" @send="handleSend" />
  </div>
</template>

<style scoped></style>
