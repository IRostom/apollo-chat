<script setup lang="ts">
import type { UIMessage } from 'ai'
import { isToolUIPart, getToolName } from 'ai'
import { computed } from 'vue'
import Spinner from '@/components/ui/spinner/Spinner.vue'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, ChevronUp, AlertCircle, RotateCcw, Globe } from 'lucide-vue-next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import MessageTools from '@/components/chat/MessageTools.vue'
import { renderMarkdown } from '@/composables/useMarkdown'

interface Props {
    message: UIMessage
    isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    isLoading: false,
})

const emit = defineEmits<{
    retry: [messageId: string]
    copy: [content: string]
}>()

const isUser = computed(() => props.message.role === 'user')
const isAssistant = computed(() => props.message.role === 'assistant')

// ============================================================================
// Collected parts
// ============================================================================

const reasoningParts = computed(() =>
    props.message.parts.filter((p) => p.type === 'reasoning'),
)

const toolParts = computed(() =>
    props.message.parts.filter(isToolUIPart),
)

const textContent = computed(() =>
    props.message.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join(''),
)

const fileParts = computed(() =>
  props.message.parts.filter((p): p is { type: 'file'; url: string; filename?: string; mediaType?: string } =>
    p.type === 'file',
  ),
)

const sourceParts = computed(() =>
    props.message.parts.filter((p) => p.type === 'source-url'),
)

const renderedContent = computed(() => {
    if (!isAssistant.value) return textContent.value
    return renderMarkdown(textContent.value)
})

const isTextStreaming = computed(() =>
    props.message.parts.some((p) => p.type === 'text' && 'state' in p && p.state === 'streaming'),
)

const isReasoningStreaming = computed(() =>
    reasoningParts.value.some((p) => 'state' in p && (p as any).state === 'streaming'),
)

const hasActiveTools = computed(() =>
    toolParts.value.some(
        (t) => (t as any).state === 'input-streaming' || (t as any).state === 'input-available',
    ),
)

const hasAnyContent = computed(() => props.message.parts.length > 0)

const isWaitingAfterTools = computed(
    () =>
        props.isLoading &&
        toolParts.value.length > 0 &&
        !hasActiveTools.value &&
        !textContent.value &&
        !isTextStreaming.value,
)

// ============================================================================
// Tool output helpers
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getToolOutput(tool: any): any {
    const output = tool?.output
    if (!output) return null
    if (output && typeof output === 'object' && 'type' in output && 'value' in output) {
        const t = output.type
        if (t === 'json' || t === 'text' || t === 'error-json' || t === 'error-text') {
            return output.value
        }
    }
    return output
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getWebSearchResults(tool: any): { title: string; url: string }[] | null {
    const output = getToolOutput(tool)
    if (!output) return null
    if (Array.isArray(output?.results)) return output.results
    if (Array.isArray(output)) return output
    return null
}

function handleRetry() {
    emit('retry', props.message.id)
}
</script>

<template>
    <!-- Loading spinner for empty assistant message -->
    <Spinner v-if="isLoading && isAssistant && !hasAnyContent" />

    <!-- User message -->
    <div v-else-if="isUser" class="flex flex-col gap-2 group">
        <Card class="w-fit ms-auto py-4">
            <CardContent>
                <div class="whitespace-break-spaces">{{ textContent }}</div>
                <div v-if="fileParts.length" class="mt-3 flex flex-wrap gap-2 justify-end">
                    <template v-for="file in fileParts" :key="file.url">
                        <img
                            v-if="file.mediaType?.startsWith('image/')"
                            :src="file.url"
                            :alt="file.filename ?? 'attachment'"
                            class="max-w-56 max-h-56 rounded-lg border"
                        />
                        <a
                            v-else
                            :href="file.url"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-xs border rounded-lg px-2 py-1 hover:bg-muted transition-colors no-underline"
                        >
                            {{ file.filename ?? 'Attachment' }}
                        </a>
                    </template>
                </div>
            </CardContent>
        </Card>
        <MessageTools role="user" class="ms-auto opacity-0 group-hover:opacity-100 transition-opacity"
            @copy="emit('copy', textContent)" />
    </div>

    <!-- Assistant message -->
    <div v-else-if="isAssistant" class="mx-auto dark:prose-invert prose lg:prose-lg prose-pre:p-0 flex flex-col group">

        <!-- Reasoning (single collapsible for all reasoning parts) -->
        <Collapsible v-if="reasoningParts.length" class="border rounded-lg my-1" v-slot="{ open }">
            <CollapsibleTrigger class="py-2 px-3 cursor-pointer w-full text-start flex items-center">
                <div class="flex items-center gap-2">
                    <Spinner v-if="isReasoningStreaming" />
                    {{ isReasoningStreaming ? 'Thinking' : 'Thought process' }}
                </div>
                <ChevronDown v-if="!open" class="ml-auto" />
                <ChevronUp v-if="open" class="ml-auto" />
            </CollapsibleTrigger>
            <CollapsibleContent class="mt-2 max-h-60 overflow-y-auto p-3 pt-0">
                {{reasoningParts.map((p) => (p as any).text).join('')}}
            </CollapsibleContent>
        </Collapsible>

        <!-- Tool calls -->
        <div v-for="tool in toolParts" :key="(tool as any).toolCallId" class="my-2">
            <Collapsible class="border rounded-lg" v-slot="{ open }">
                <CollapsibleTrigger class="py-2 px-3 cursor-pointer w-full text-start flex items-center">
                    <div class="flex items-center gap-2">
                        <Globe v-if="getToolName(tool) === 'webSearch'" class="h-4 w-4" />
                        <Spinner
                            v-if="(tool as any).state === 'input-streaming' || (tool as any).state === 'input-available'" />
                        {{ getToolName(tool) }}
                    </div>
                    <ChevronDown v-if="!open" class="ml-auto" />
                    <ChevronUp v-if="open" class="ml-auto" />
                </CollapsibleTrigger>
                <CollapsibleContent class="mt-2 max-h-60 overflow-y-auto p-3 pt-0">
                    <template v-if="(tool as any).state === 'output-available' && (tool as any).output">
                        <ul v-if="getToolName(tool) === 'webSearch' && getWebSearchResults(tool)" class="flex flex-col">
                            <li v-for="result in getWebSearchResults(tool)" :key="result.url" class="text-nowrap">
                                <a target="_blank" rel="noopener noreferrer" :href="result.url">{{ result.title }}</a>
                            </li>
                        </ul>
                        <pre v-else
                            class="text-sm whitespace-pre-wrap">{{ JSON.stringify(getToolOutput(tool), null, 2) }}</pre>
                    </template>
                    <template v-else-if="(tool as any).input">
                        <pre
                            class="text-sm whitespace-pre-wrap">{{ JSON.stringify((tool as any).input, null, 2) }}</pre>
                    </template>
                </CollapsibleContent>
            </Collapsible>
        </div>

        <!-- Generating indicator after tools complete but before text arrives -->
        <Spinner v-if="isWaitingAfterTools" class="my-2" />

        <!-- Source URLs -->
        <div v-if="sourceParts.length" class="flex flex-wrap gap-2 my-2">
            <a v-for="source in sourceParts" :key="'sourceId' in source ? (source as any).sourceId : undefined"
                :href="(source as any).url" target="_blank" rel="noopener noreferrer"
                class="text-xs border rounded-lg px-2 py-1 hover:bg-muted transition-colors no-underline">
                {{ (source as any).title || (source as any).url }}
            </a>
        </div>

        <!-- Main text content -->
        <div v-if="textContent" v-html="renderedContent"></div>

        <!-- Assistant attachments -->
        <div v-if="fileParts.length" class="mt-3 flex flex-wrap gap-2">
            <template v-for="file in fileParts" :key="file.url">
                <img
                    v-if="file.mediaType?.startsWith('image/')"
                    :src="file.url"
                    :alt="file.filename ?? 'attachment'"
                    class="max-w-56 max-h-56 rounded-lg border"
                />
                <a
                    v-else
                    :href="file.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-xs border rounded-lg px-2 py-1 hover:bg-muted transition-colors no-underline"
                >
                    {{ file.filename ?? 'Attachment' }}
                </a>
            </template>
        </div>

        <!-- Error state -->
        <div v-if="!isTextStreaming && !textContent && !isLoading && !toolParts.length"
            class="mt-4 flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
            <AlertCircle class="h-5 w-5 shrink-0" />
            <span class="flex-1 text-sm">An error occurred while generating a response.</span>
            <Button variant="outline" size="sm" class="gap-2" @click="handleRetry">
                <RotateCcw class="h-4 w-4" />
                Retry
            </Button>
        </div>

        <!-- Message tools (copy, retry) -->
        <div v-if="!isTextStreaming && textContent.trim().length > 0" class="mt-2 flex items-center gap-3">
            <MessageTools role="assistant" class="opacity-0 group-hover:opacity-100 transition-opacity"
                @copy="emit('copy', textContent)" @retry="handleRetry" />
        </div>
    </div>
</template>
