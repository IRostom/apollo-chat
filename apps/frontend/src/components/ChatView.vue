<script setup lang="ts">
import { computed } from 'vue'
import { useChat } from '@/composables/useChat'
import ChatMessages from './chat/ChatMessages.vue'
import ChatInput from './chat/ChatInput.vue'
import type { ChatMessage } from '@/types/chat'
import { toast } from 'vue-sonner'

const {
  chatMd,
  isStreaming,
  sendMessage,
  stopGeneration,
  files,
  attachImageToChat,
  retryMessage,
  editMessage,
  editingMessage,
  cancelEdit,
  submitEditedMessage,
  branchConversation,
} = useChat()

const isEmpty = computed(() => chatMd.value.length === 0)

async function handleSend(message: string) {
  // If we're editing, submit the edit instead of sending a new message
  if (editingMessage.value) {
    await submitEditedMessage(message)
    return
  }

  const userMessage: ChatMessage = {
    role: 'user',
    content: message,
  }

  await sendMessage(userMessage)
}

async function handleRetry(assistantMessageId: number | string) {
  const id = typeof assistantMessageId === 'string' ? parseInt(assistantMessageId, 10) : assistantMessageId
  if (!isNaN(id)) {
    await retryMessage(id)
  }
}

function handleStop() {
  stopGeneration()
}

async function handleCopy(content: string) {
  try {
    await navigator.clipboard.writeText(content)
    toast.success('Copied to clipboard')
  } catch {
    toast.error('Failed to copy to clipboard')
  }
}

async function handleEdit(message: ChatMessage) {
  editMessage(message)
}

async function handleBranch(assistantMessageId: number | string) {
  const id = typeof assistantMessageId === 'string' ? parseInt(assistantMessageId, 10) : assistantMessageId
  if (!isNaN(id)) {
    await branchConversation(id)
  }
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
            :is-streaming="isStreaming"
            @send="handleSend"
            @attach="attachImageToChat"
            @stop="handleStop"
          />
        </div>
      </div>
    </div>
    <div v-else class="flex-1 overflow-auto">
      <ChatMessages
        :messages="chatMd"
        :is-streaming="isStreaming"
        @retry="handleRetry"
        @edit="handleEdit"
        @branch="handleBranch"
        @copy="handleCopy"
      />
    </div>
    <ChatInput
      v-if="!isEmpty"
      :files
      :is-streaming="isStreaming"
      @send="handleSend"
      @stop="handleStop"
      @attach="attachImageToChat"
      @retry="handleRetry"
      @edit="handleEdit"
      @branch="handleBranch"
      @copy="handleCopy"
      @cancel-edit="cancelEdit"
      :editing-content="editingMessage?.content"
    />
  </div>
</template>

<style scoped></style>
