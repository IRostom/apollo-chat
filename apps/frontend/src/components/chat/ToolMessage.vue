<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, ChevronUp, Globe, Code, Loader2 } from 'lucide-vue-next'

/**
 * Tool invocation part from AI SDK UIMessage
 */
interface ToolInvocationPart {
  type: 'tool-invocation'
  toolInvocation: {
    toolCallId: string
    toolName: string
    args: Record<string, unknown>
    state: 'pending' | 'result'
    result?: unknown
  }
}

/**
 * Legacy tool message format (for backward compatibility)
 */
interface LegacyToolMessage {
  role: 'tool'
  content: string
  toolName?: string
  codeLanguage?: string
  codeContent?: string
}

interface Props {
  // Can be either a tool-invocation part (AI SDK) or legacy tool message
  part?: ToolInvocationPart
  message?: LegacyToolMessage
}

const props = defineProps<Props>()

const runCodeTab = ref<'code' | 'result'>('result')

// Determine if using AI SDK format or legacy format
const isAISdkFormat = computed(() => !!props.part)

// Tool name from either format
const toolName = computed(() => {
  if (props.part) {
    return props.part.toolInvocation.toolName
  }
  return props.message?.toolName
})

// Tool state (pending or result) - only for AI SDK format
const toolState = computed(() => {
  if (props.part) {
    return props.part.toolInvocation.state
  }
  return 'result' // Legacy messages are always complete
})

// Tool arguments (AI SDK format)
const toolArgs = computed(() => {
  if (props.part) {
    return props.part.toolInvocation.args
  }
  return undefined
})

// Tool result (AI SDK format)
const toolResult = computed(() => {
  if (props.part) {
    return props.part.toolInvocation.result as Record<string, unknown> | undefined
  }
  // Parse legacy message content as JSON
  if (props.message?.content) {
    try {
      return JSON.parse(props.message.content) as Record<string, unknown>
    } catch {
      return undefined
    }
  }
  return undefined
})

// Web search results
type WebSearchResult = { url: string; title: string }

const webSearchResults = computed((): WebSearchResult[] | undefined => {
  if (toolName.value !== 'webSearch') {
    return undefined
  }
  const results = toolResult.value?.results
  if (Array.isArray(results)) {
    return results as WebSearchResult[]
  }
  return undefined
})

// Code execution helpers
const codeLanguage = computed(() => {
  // From AI SDK args
  if (toolArgs.value?.language) {
    return toolArgs.value.language as string
  }
  // From legacy message
  if (props.message?.codeLanguage) {
    return props.message.codeLanguage
  }
  // From result
  return (toolResult.value?.language as string) ?? undefined
})

const codeLanguageLabel = computed(() => {
  if (codeLanguage.value === 'javascript') return 'JavaScript'
  if (codeLanguage.value === 'python') return 'Python'
  return codeLanguage.value
})

const codeContent = computed(() => {
  // From AI SDK args
  if (toolArgs.value?.code) {
    return toolArgs.value.code as string
  }
  // From legacy message
  if (props.message?.codeContent) {
    return props.message.codeContent
  }
  // From result
  return (toolResult.value?.code as string) ?? undefined
})

const codeOutput = computed(() => {
  return (toolResult.value?.stdout as string) ?? (toolResult.value?.output as string) ?? undefined
})

const codeError = computed(() => {
  return (toolResult.value?.error as string) ?? (toolResult.value?.stderr as string) ?? undefined
})

const codeExitCode = computed(() => {
  return (toolResult.value?.exitCode as number | null) ?? null
})

const codeTimedOut = computed(() => {
  return toolResult.value?.timedOut === true
})

// Has any content to display
const hasContent = computed(() => {
  if (isAISdkFormat.value) {
    return true // Always show for AI SDK parts
  }
  return !!props.message?.content?.length
})

// Reset tab when message changes
watch(
  () => props.part?.toolInvocation.toolCallId ?? props.message?.content,
  () => {
    runCodeTab.value = 'result'
  },
)
</script>

<template>
  <div class="mx-auto dark:prose-invert prose lg:prose-lg flex flex-col">
    <Collapsible v-if="hasContent" class="border rounded-lg" v-slot="{ open }">
      <CollapsibleTrigger class="py-2 px-3 cursor-pointer w-full text-start flex items-center">
        <div class="flex items-center gap-2">
          <Loader2 v-if="toolState === 'pending'" class="h-4 w-4 animate-spin" />
          <Globe v-else-if="toolName === 'webSearch'" class="h-4 w-4" />
          <Code v-else-if="toolName === 'runCode'" class="h-4 w-4" />
          {{ toolName }}
        </div>
        <ChevronDown v-if="!open" class="ml-auto" />
        <ChevronUp v-if="open" class="ml-auto" />
      </CollapsibleTrigger>
      <CollapsibleContent class="mt-2 max-h-60 overflow-y-auto p-3 pt-0">
        <!-- Pending state -->
        <div v-if="toolState === 'pending'" class="text-muted-foreground text-sm">
          Executing...
        </div>

        <!-- Web search results -->
        <ul v-else-if="toolName === 'webSearch' && webSearchResults" class="flex flex-col">
          <li v-for="result in webSearchResults" :key="result.url" class="text-nowrap">
            <a target="_blank" rel="noopener noreferrer" :href="result.url">{{ result.title }}</a>
          </li>
        </ul>

        <!-- Code execution -->
        <div v-else-if="toolName === 'runCode'" class="flex flex-col gap-3">
          <div class="rounded-md border overflow-hidden">
            <div class="flex items-center justify-between bg-muted px-3 py-2 text-xs">
              <div class="uppercase tracking-wide text-muted-foreground">
                {{ codeLanguageLabel || 'Code' }}
              </div>
              <div class="flex items-center gap-2">
                <button
                  class="rounded px-2 py-1 transition"
                  :class="
                    runCodeTab === 'code'
                      ? 'bg-background text-foreground'
                      : 'text-muted-foreground'
                  "
                  type="button"
                  @click="runCodeTab = 'code'"
                >
                  Code
                </button>
                <button
                  class="rounded px-2 py-1 transition"
                  :class="
                    runCodeTab === 'result'
                      ? 'bg-background text-foreground'
                      : 'text-muted-foreground'
                  "
                  type="button"
                  @click="runCodeTab = 'result'"
                >
                  Result
                </button>
              </div>
            </div>
            <div class="p-3">
              <pre v-if="runCodeTab === 'code'" class="text-sm">
                <code class="whitespace-pre-wrap">{{ codeContent || '' }}</code>
              </pre>
              <pre v-else class="text-sm">
                <code class="whitespace-pre-wrap">{{
                  codeTimedOut ? 'Execution timed out.' : (codeError || codeOutput || '')
                }}</code>
              </pre>
            </div>
          </div>
          <div v-if="codeExitCode !== null" class="text-xs text-muted-foreground">
            Exit code: {{ codeExitCode }}
          </div>
        </div>

        <!-- Generic tool result -->
        <pre v-else class="text-sm">{{ JSON.stringify(toolResult, null, 2) }}</pre>
      </CollapsibleContent>
    </Collapsible>
  </div>
</template>
