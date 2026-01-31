<script setup lang="ts">
import ChatMessage from './ChatMessage.vue'
import type { ChatMessage as ChatMessageType, UIMessage } from '@/types/chat'

// Accept both AI SDK UIMessage and legacy ChatMessage formats
type MessageType = (UIMessage & { metadata?: ChatMessageType['metadata'] }) | ChatMessageType

interface Props {
  messages: Array<MessageType>
  isStreaming?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false,
})

const emit = defineEmits<{
  retry: [assistantMessageId: number | string]
  edit: [message: MessageType]
  branch: [assistantMessageId: number | string]
  copy: [content: string]
}>()

function isLastMessage(index: number) {
  return index === props.messages.length - 1
}

function getMessageKey(msg: MessageType, index: number): string | number {
  if ('id' in msg && msg.id !== undefined) {
    return msg.id
  }
  return index
}
</script>

<template>
  <div class="flex flex-col">
    <article
      v-for="(msg, index) in messages"
      :key="getMessageKey(msg, index)"
      class="px-16"
      :class="{ 'pt-12 pb-12': msg.role === 'user', 'pb-12': msg.role !== 'user' }"
    >
      <div class="mx-auto max-w-3xl">
        <ChatMessage
          :message="msg"
          :is-loading="isStreaming && isLastMessage(index)"
          @retry="emit('retry', $event)"
          @edit="emit('edit', $event)"
          @branch="emit('branch', $event)"
          @copy="emit('copy', $event)"
        />
      </div>
    </article>
  </div>
</template>
