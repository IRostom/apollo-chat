<script setup lang="ts">
import type { ChatMessage } from '@/types/chat'
import { computed, ref, watch } from 'vue'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, ChevronUp, Globe } from 'lucide-vue-next'

interface Props {
    message: ChatMessage
}

const props = defineProps<Props>()

const isTool = computed(() => props.message.role === 'tool')
const runCodeTab = ref<'code' | 'result'>('result')

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

watch(
    () => props.message.id,
    () => {
        runCodeTab.value = 'result'
    }
)
</script>

<template>
    <div class="mx-auto dark:prose-invert prose lg:prose-lg flex flex-col">
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
                        <a target="_blank" rel="noopener noreferrer" :href="result.url">{{ result.title }}</a>
                    </li>
                </ul>
                <div v-else-if="message.toolName === 'runCode'" class="flex flex-col gap-3">
                    <div class="rounded-md border overflow-hidden">
                        <div class="flex items-center justify-between bg-muted px-3 py-2 text-xs">
                            <div class="uppercase tracking-wide text-muted-foreground">
                                {{ codeLanguageLabel || 'Code' }}
                            </div>
                            <div class="flex items-center gap-2">
                                <button class="rounded px-2 py-1 transition"
                                    :class="runCodeTab === 'code' ? 'bg-background text-foreground' : 'text-muted-foreground'"
                                    type="button" @click="runCodeTab = 'code'">
                                    Code
                                </button>
                                <button class="rounded px-2 py-1 transition"
                                    :class="runCodeTab === 'result' ? 'bg-background text-foreground' : 'text-muted-foreground'"
                                    type="button" @click="runCodeTab = 'result'">
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
                <div v-else>
                    {{ message.content }}
                </div>
            </CollapsibleContent>
        </Collapsible>
    </div>
</template>
