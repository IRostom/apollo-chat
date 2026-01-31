<script setup lang="ts">
import type { ChatMessage, UIMessage } from '@/types/chat'
import { computed } from 'vue'
import Spinner from '@/components/ui/spinner/Spinner.vue'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, ChevronUp, AlertCircle, RotateCcw } from 'lucide-vue-next'
import { getImageUrl } from '@/config/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import MessageTools from './MessageTools.vue'
import ToolMessage from './ToolMessage.vue'
import MessageMetadata from './MessageMetadata.vue'

// Support both AI SDK UIMessage and legacy ChatMessage formats
type MessageType = (UIMessage & { metadata?: ChatMessage['metadata']; isError?: boolean }) | ChatMessage

interface Props {
  message: MessageType
  isLoading?: boolean
  isThinking?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
})

const emit = defineEmits<{
  retry: [assistantMessageId: number | string]
  edit: [message: MessageType]
  branch: [assistantMessageId: number | string]
  copy: [content: string]
}>()

// Role checks
const isUser = computed(() => props.message.role === 'user')
const isAssistant = computed(() => props.message.role === 'assistant')
const isTool = computed(() => props.message.role === 'tool')
const hasError = computed(() => (props.message as ChatMessage).isError === true)

// Get message ID (works with both formats)
const messageId = computed(() => {
  const msg = props.message
  if ('id' in msg && msg.id !== undefined) {
    return typeof msg.id === 'number' ? msg.id : parseInt(msg.id, 10) || msg.id
  }
  return undefined
})

// Check if message has AI SDK parts
const hasParts = computed(() => {
  return 'parts' in props.message && Array.isArray(props.message.parts)
})

// Get text content from message (handles both formats)
const textContent = computed(() => {
  if (hasParts.value) {
    // Extract text from AI SDK parts
    const parts = (props.message as UIMessage).parts || []
    return parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('')
  }
  // Legacy format - content is already a string
  return typeof props.message.content === 'string' ? props.message.content : ''
})

// Get tool invocation parts (AI SDK format)
const toolParts = computed(() => {
  if (!hasParts.value) return []
  const parts = (props.message as UIMessage).parts || []
  return parts.filter((p) => p.type === 'tool-invocation')
})

// Get file parts (AI SDK format)
const fileParts = computed(() => {
  if (!hasParts.value) return []
  const parts = (props.message as UIMessage).parts || []
  return parts.filter(
    (p): p is { type: 'file'; url: string; mediaType?: string; filename?: string } =>
      p.type === 'file',
  )
})

// Get images from legacy format
const legacyImages = computed(() => {
  if (hasParts.value) return []
  return (props.message as ChatMessage).images || []
})

// Get thinking content (legacy format)
const thinkingContent = computed(() => {
  return (props.message as ChatMessage).thinking
})

// Get metadata
const metadata = computed(() => {
  return (props.message as ChatMessage).metadata
})

// Has any visible content
const hasContent = computed(() => {
  return textContent.value.trim().length > 0 || toolParts.value.length > 0
})

function handleRetry() {
  if (messageId.value !== undefined) {
    emit('retry', messageId.value)
  }
}

function handleBranch() {
  if (messageId.value !== undefined) {
    emit('branch', messageId.value)
  }
}

function handleCopy() {
  emit('copy', textContent.value)
}
</script>

<template>
  <!-- Loading spinner -->
  <Spinner
    v-if="isLoading && isAssistant && !textContent.length && !thinkingContent?.length"
  />

  <!-- User message -->
  <div v-else-if="isUser" class="flex flex-col gap-2 group">
    <!-- Images from AI SDK file parts -->
    <div v-if="fileParts.length" class="flex items-center justify-end gap-2">
      <div v-for="(file, index) in fileParts" :key="index" class="border rounded-xl p-1">
        <img
          v-if="file.mediaType?.startsWith('image/')"
          :src="file.url"
          :alt="file.filename"
          class="w-14.5 h-14.5 object-cover"
        />
      </div>
    </div>

    <!-- Images from legacy format -->
    <div v-else-if="legacyImages.length" class="flex items-center justify-end gap-2">
      <div v-for="image in legacyImages" :key="String(image)" class="border rounded-xl p-1">
        <img :src="getImageUrl(String(image))" class="w-14.5 h-14.5" />
      </div>
    </div>

    <Card class="w-fit ms-auto py-4">
      <CardContent>
        <div class="whitespace-break-spaces">
          {{ textContent }}
        </div>
      </CardContent>
    </Card>
    <MessageTools
      role="user"
      class="ms-auto opacity-0 group-hover:opacity-100 transition-opacity"
      @copy="handleCopy"
      @edit="emit('edit', message)"
    />
  </div>

  <!-- Assistant message -->
  <div
    v-else-if="isAssistant"
    class="mx-auto dark:prose-invert prose lg:prose-lg prose-pre:p-0 flex flex-col group"
  >
    <!-- Thinking collapsible (legacy format) -->
    <Collapsible v-if="thinkingContent?.length" class="border rounded-lg" v-slot="{ open }">
      <CollapsibleTrigger class="py-2 px-3 cursor-pointer w-full text-start flex items-center">
        <div class="flex items-center gap-2">
          <Spinner v-if="isThinking" />
          {{ isThinking ? 'Thinking' : 'Thought process' }}
        </div>
        <ChevronDown v-if="!open" class="ml-auto" />
        <ChevronUp v-if="open" class="ml-auto" />
      </CollapsibleTrigger>
      <CollapsibleContent class="mt-2 max-h-60 overflow-y-auto p-3 pt-0">
        {{ thinkingContent }}
      </CollapsibleContent>
    </Collapsible>

    <!-- Text content (already rendered as HTML from useChat) -->
    <div v-if="textContent" v-html="textContent"></div>

    <!-- Tool invocations (AI SDK format) -->
    <template v-for="(part, index) in toolParts" :key="index">
      <ToolMessage :part="part as any" />
    </template>

    <!-- Error state with retry button -->
    <div
      v-if="hasError"
      class="mt-4 flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive"
    >
      <AlertCircle class="h-5 w-5 shrink-0" />
      <span class="flex-1 text-sm">An error occurred while generating a response.</span>
      <Button variant="outline" size="sm" class="gap-2" @click="handleRetry">
        <RotateCcw class="h-4 w-4" />
        Retry
      </Button>
    </div>

    <!-- Message tools and metadata -->
    <div
      v-if="!hasError && !isThinking && hasContent"
      class="mt-2 flex items-center gap-3"
    >
      <MessageTools
        role="assistant"
        class="opacity-0 group-hover:opacity-100 transition-opacity"
        @copy="handleCopy"
        @retry="handleRetry"
        @branch="handleBranch"
      />
      <MessageMetadata
        :metadata="metadata"
        class="opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </div>
  </div>

  <!-- Tool message (legacy format) -->
  <ToolMessage v-else-if="isTool" :message="message as any" />
</template>
