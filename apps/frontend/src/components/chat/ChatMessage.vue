<script setup lang="ts">
import type { ChatMessage } from '@/types/chat'
import { computed } from 'vue'
import Spinner from '@/components/ui/spinner/Spinner.vue'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, ChevronUp, Globe } from 'lucide-vue-next'

interface Props {
  message: ChatMessage
  isLoading?: boolean
  isThinking?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
})

const isUser = computed(() => props.message.role === 'user')
const isAssistant = computed(() => props.message.role === 'assistant')
const isTool = computed(() => props.message.role === 'tool')

const toolResult = computed(() => {
  if (!isTool.value) {
    return undefined
  }
  if (props.message.toolName === 'webSearch') {
    const json = JSON.parse(props.message.content)
    return json.results
  }
  return props.message.content
})
</script>

<template>
  <Spinner
    v-if="isLoading && isAssistant && (!message.content.length || !message.thinking?.length)"
  />
  <div
    v-else-if="isUser"
    class="rounded-2xl w-fit ms-auto bg-amber-300 p-3"
    v-html="message.content"
  ></div>
  <div v-else-if="isAssistant" class="mx-auto prose lg:prose-lg flex flex-col">
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
  </div>

  <div v-else-if="isTool" class="mx-auto prose lg:prose-lg flex flex-col">
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
          <li v-for="result of toolResult" :key="result.url" class="text-nowrap">
            <a target="_blank" :href="result.url">{{ result.title }}</a>
          </li>
        </ul>
        <div v-else>
          {{ message.content }}
        </div>
      </CollapsibleContent>
    </Collapsible>
  </div>
</template>
