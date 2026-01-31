<script setup lang="ts">
import { computed } from 'vue'
import type { ChatMessageMetadata } from '@/types/chat'
import { Bot, Cpu, Gauge, Timer } from 'lucide-vue-next'

interface Props {
  metadata?: ChatMessageMetadata
}

const props = defineProps<Props>()

type MetadataItem = {
  id: string
  value: string
  icon: typeof Cpu
}

const metadataItems = computed<MetadataItem[]>(() => {
  const meta = props.metadata
  if (!meta || meta.done !== true) return []

  const items: MetadataItem[] = []

  // Model name
  if (meta.model) {
    items.push({
      id: 'model',
      value: meta.model,
      icon: Bot,
    })
  }

  // Tokens per second (use pre-calculated value or compute from Ollama metrics)
  if (meta.tokensPerSecond && Number.isFinite(meta.tokensPerSecond) && meta.tokensPerSecond > 0) {
    items.push({
      id: 'tokensPerSecond',
      value: `${meta.tokensPerSecond.toFixed(2)} tok/s`,
      icon: Gauge,
    })
  } else if (meta.eval_count && meta.eval_duration) {
    // Fallback: Calculate from Ollama metrics (duration in nanoseconds)
    const tokensPerSecond = meta.eval_count / (meta.eval_duration / 1_000_000_000)
    if (Number.isFinite(tokensPerSecond) && tokensPerSecond > 0) {
      items.push({
        id: 'tokensPerSecond',
        value: `${tokensPerSecond.toFixed(2)} tok/s`,
        icon: Gauge,
      })
    }
  }

  // Total tokens (prefer AI SDK format, fallback to Ollama)
  const totalTokens = meta.totalTokens ?? (meta.prompt_eval_count ?? 0) + (meta.eval_count ?? 0)
  if (totalTokens > 0) {
    items.push({
      id: 'tokens',
      value: `${totalTokens.toLocaleString('en-US')} tokens`,
      icon: Cpu,
    })
  }

  // Time to first token (Ollama specific)
  const timeToFirst = (meta.load_duration ?? 0) + (meta.prompt_eval_duration ?? 0)
  if (timeToFirst > 0) {
    items.push({
      id: 'timeToFirst',
      value: `${(timeToFirst / 1_000_000_000).toFixed(2)}s TTF`,
      icon: Timer,
    })
  }

  return items
})
</script>

<template>
  <div v-if="metadataItems.length" class="flex items-center gap-3 text-xs text-muted-foreground">
    <div v-for="item in metadataItems" :key="item.id" class="flex items-center gap-1">
      <component :is="item.icon" class="h-3.5 w-3.5" />
      <span>{{ item.value }}</span>
    </div>
  </div>
</template>
