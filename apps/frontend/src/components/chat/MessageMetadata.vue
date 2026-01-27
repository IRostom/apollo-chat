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

  if (meta.model) {
    items.push({
      id: 'model',
      value: meta.model,
      icon: Bot,
    })
  }

  if (meta.eval_count && meta.eval_duration) {
    const tokensPerSecond = meta.eval_count / (meta.eval_duration / 1_000_000_000)
    if (Number.isFinite(tokensPerSecond) && tokensPerSecond > 0) {
      items.push({
        id: 'tokensPerSecond',
        value: `${tokensPerSecond.toFixed(2)} tok/s`,
        icon: Gauge,
      })
    }
  }

  const totalTokens = (meta.prompt_eval_count ?? 0) + (meta.eval_count ?? 0)
  if (totalTokens > 0) {
    items.push({
      id: 'tokens',
      value: `${totalTokens.toLocaleString('en-US')} tokens`,
      icon: Cpu,
    })
  }

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
