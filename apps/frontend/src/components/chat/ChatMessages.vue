<script setup lang="ts">
import ChatMessage from './ChatMessage.vue'
import type { ChatMessage as ChatMessageType } from '@/types/chat'

interface Props {
  messages: Array<ChatMessageType>
  isStreaming?: boolean
  isThinking?: boolean
}

withDefaults(defineProps<Props>(), {
  isStreaming: false,
})
</script>

<template>
  <div class="flex flex-col h-full">
    <article
      v-for="(msg, index) in messages"
      :key="msg.id ?? index"
      class="px-16"
      :class="{ 'pt-12 pb-12': msg.role === 'user', 'pb-12': msg.role !== 'user' }"
    >
      <div class="mx-auto max-w-3xl">
        <ChatMessage :message="msg" :is-loading="isStreaming" />
      </div>
    </article>
  </div>
</template>
