<script setup lang="ts">
import type { ChatMessage } from '@/types/chat'
import { computed } from 'vue'
import Spinner from '@/components/ui/spinner/Spinner.vue'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, ChevronUp, Globe, AlertCircle, RotateCcw } from 'lucide-vue-next'
import { getImageUrl } from '@/config/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import MessageTools from './MessageTools.vue'

interface Props {
  message: ChatMessage
  isLoading?: boolean
  isThinking?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
})

const emit = defineEmits<{
  retry: [assistantMessageId: number]
  edit: [message: ChatMessage]
  branch: [assistantMessageId: number]
  copy: [content: string]
}>()

const isUser = computed(() => props.message.role === 'user')
const isAssistant = computed(() => props.message.role === 'assistant')
const isTool = computed(() => props.message.role === 'tool')
const hasError = computed(() => props.message.isError === true)

const toolPayload = computed(() => {
  if (!isTool.value || !props.message.content) {
    return undefined
  }
  try {
    return JSON.parse(props.message.content)
  } catch {
    return undefined
  }
})

type WebSearchResult = {
  url: string
  title: string
}

const webSearchResults = computed((): WebSearchResult[] | undefined => {
  if (!isTool.value || props.message.toolName !== 'webSearch') {
    return undefined
  }
  const results = (toolPayload.value as { results?: unknown } | undefined)?.results
  if (Array.isArray(results)) {
    return results as WebSearchResult[]
  }
  return undefined
})


const codeLanguage = computed(() => {
  return props.message.codeLanguage ?? (toolPayload.value as { language?: string } | undefined)?.language
})

const codeLanguageLabel = computed(() => {
  if (codeLanguage.value === 'javascript') {
    return 'JavaScript'
  }
  if (codeLanguage.value === 'python') {
    return 'Python'
  }
  return codeLanguage.value
})

const codeContent = computed(() => {
  return props.message.codeContent ?? (toolPayload.value as { code?: string } | undefined)?.code
})

const codeOutput = computed(() => {
  return (
    (toolPayload.value as { stdout?: string; output?: string } | undefined)?.stdout ??
    (toolPayload.value as { output?: string } | undefined)?.output
  )
})

const codeError = computed(() => {
  return (toolPayload.value as { error?: string; stderr?: string } | undefined)?.error ??
    (toolPayload.value as { stderr?: string } | undefined)?.stderr
})

const codeExitCode = computed(() => {
  return (toolPayload.value as { exitCode?: number | null } | undefined)?.exitCode ?? null
})

const codeTimedOut = computed(() => {
  return (toolPayload.value as { timedOut?: boolean } | undefined)?.timedOut === true
})

function handleRetry() {
  if (props.message.id) {
    console.log('retry', props.message.id)
    emit('retry', props.message.id)
  }
}

function handleBranch() {
  if (props.message.id) {
    emit('branch', props.message.id)
  }
}
</script>

<template>
  <Spinner
    v-if="isLoading && isAssistant && !message.content.length && !message.thinking?.length"
  />

  <div v-else-if="isUser" class="flex flex-col gap-2 group">
    <div class="flex items-center justify-end gap-2">
      <div v-for="image in message.images" :key="image" class="border rounded-xl p-1">
        <img :src="getImageUrl(image as string)" class="w-14.5 h-14.5" />
      </div>
    </div>
    <Card class="w-fit ms-auto py-4">
      <CardContent>
        <div class="whitespace-break-spaces">
          {{ message.content }}
        </div>
      </CardContent>
    </Card>
    <MessageTools
      role="user"
      class="ms-auto opacity-0 group-hover:opacity-100 transition-opacity"
      @copy="emit('copy', message.content)"
      @edit="emit('edit', message)"
    />
  </div>

  <div
    v-else-if="isAssistant"
    class="mx-auto dark:prose-invert prose lg:prose-lg prose-pre:p-0 flex flex-col group"
  >
    <Collapsible v-if="message.thinking?.length" class="border rounded-lg" v-slot="{ open }">
      <CollapsibleTrigger class="py-2 px-3 cursor-pointer w-full text-start flex items-center">
        <div class="flex items-center gap-2">
          <Spinner v-if="isThinking" />
          {{ isThinking ? 'Thinking' : 'Thought process' }}
        </div>
        <ChevronDown v-if="!open" class="ml-auto" />
        <ChevronUp v-if="open" class="ml-auto" />
      </CollapsibleTrigger>
      <CollapsibleContent class="mt-2 max-h-60 overflow-y-auto p-3 pt-0">
        {{ message.thinking }}
      </CollapsibleContent>
    </Collapsible>
    <div v-html="message.content"></div>

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

    <MessageTools
      v-if="!hasError && !isThinking && !!message.content && message.content.trim().length > 0"
      role="assistant"
      class="mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
      @copy="emit('copy', message.content)"
      @retry="handleRetry"
      @branch="handleBranch"
    />
  </div>

  <div v-else-if="isTool" class="mx-auto dark:prose-invert prose lg:prose-lg flex flex-col">
    <Collapsible v-if="message.content?.length" class="border rounded-lg" v-slot="{ open }">
      <CollapsibleTrigger class="py-2 px-3 cursor-pointer w-full text-start flex items-center">
        <div class="flex items-center gap-2">
          <Globe class="h-4 w-4" v-if="message.toolName === 'webSearch'" />
          {{ message.toolName }}
        </div>
        <ChevronDown v-if="!open" class="ml-auto" />
        <ChevronUp v-if="open" class="ml-auto" />
      </CollapsibleTrigger>
      <CollapsibleContent class="mt-2 max-h-60 overflow-y-auto p-3 pt-0">
        <ul v-if="message.toolName === 'webSearch'" class="flex flex-col">
          <li v-for="result of webSearchResults" :key="result.url" class="text-nowrap">
            <a target="_blank" :href="result.url">{{ result.title }}</a>
          </li>
        </ul>
        <div v-else-if="message.toolName === 'runCode'" class="flex flex-col gap-3">
          <div v-if="codeLanguageLabel" class="text-xs uppercase text-muted-foreground tracking-wide">
            {{ codeLanguageLabel }}
          </div>
          <pre v-if="codeContent?.length" class="rounded-md bg-muted p-3 text-sm">
            <code class="whitespace-pre-wrap">{{ codeContent }}</code>
          </pre>
          <div class="flex flex-col gap-1">
            <div class="text-xs uppercase text-muted-foreground tracking-wide">Output</div>
            <pre class="rounded-md bg-muted p-3 text-sm">
              <code class="whitespace-pre-wrap">{{ codeOutput || '' }}</code>
            </pre>
          </div>
          <div v-if="codeError || codeTimedOut" class="text-sm text-destructive whitespace-pre-wrap">
            <div v-if="codeTimedOut">Execution timed out.</div>
            <div v-else>{{ codeError }}</div>
          </div>
          <div v-if="codeExitCode !== null" class="text-xs text-muted-foreground">
            Exit code: {{ codeExitCode }}
          </div>
        </div>
        <div v-else>
          {{ message.content }}
        </div>
      </CollapsibleContent>
    </Collapsible>
  </div>
</template>
