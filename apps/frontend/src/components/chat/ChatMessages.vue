<script setup lang="ts">
import ChatMessage from './ChatMessage.vue'
import type { ChatMessage as ChatMessageType } from '@/types/chat'

interface Props {
  messages: Array<ChatMessageType>
  isStreaming?: boolean
  isThinking?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false,
})

const emit = defineEmits<{
  retry: [assistantMessageId: number]
}>()

function isLastMessage(index: number) {
  return index === props.messages.length - 1
}
</script>

<template>
  <div class="flex flex-col">
    <article
      v-for="(msg, index) in messages"
      :key="msg.id ?? index"
      class="px-16"
      :class="{ 'pt-12 pb-12': msg.role === 'user', 'pb-12': msg.role !== 'user' }"
    >
      <div class="mx-auto max-w-3xl">
        <ChatMessage
          :message="msg"
          :is-loading="isStreaming && isLastMessage(index)"
          :is-thinking="isThinking && isLastMessage(index)"
          @retry="msg.id && emit('retry', msg.id)"
        />
      </div>
    </article>
  </div>
</template>
