<script setup lang="ts">
import { computed } from 'vue'
import { useChat } from '@/composables/useChat'
import ChatMessages from './chat/ChatMessages.vue'
import ChatInput from './chat/ChatInput.vue'
import type { ChatMessage } from '@/types/chat'

const { chatMd, isStreaming, isThinking, sendMessage, files, attachImageToChat, retryMessage } =
  useChat()

const isEmpty = computed(() => chatMd.value.length === 0)

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
</script>

<template>
  <div class="flex flex-col min-h-[calc(100svh-4rem-2rem)]">
    <div v-if="isEmpty" class="flex-1 flex flex-col items-center justify-center px-4">
      <div class="max-w-3xl w-full flex flex-col items-center gap-8">
        <p class="text-2xl text-muted-foreground">How can I help you today?</p>
        <div class="w-full">
          <ChatInput
            :files
            :disabled="isStreaming"
            @send="handleSend"
            @attach="attachImageToChat"
          />
        </div>
      </div>
    </div>
    <div v-else class="flex-1 overflow-auto">
      <ChatMessages
        :messages="chatMd"
        :is-streaming="isStreaming"
        :is-thinking="isThinking"
        @retry="handleRetry"
      />
    </div>
    <ChatInput
      v-if="!isEmpty"
      :files
      :disabled="isStreaming"
      @send="handleSend"
      @attach="attachImageToChat"
    />
  </div>
</template>

<style scoped></style>
