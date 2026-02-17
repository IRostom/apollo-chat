<script setup lang="ts">
import V1ChatMessage from './V1ChatMessage.vue'
import Spinner from '@/components/ui/spinner/Spinner.vue'
import type { UIMessage } from 'ai'
import { computed } from 'vue'

interface Props {
    messages: UIMessage[]
    isStreaming?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    isStreaming: false,
})

const emit = defineEmits<{
    retry: [messageId: string]
    copy: [content: string]
    edit: [payload: { id: string; content: string }]
    branch: [messageId: string]
}>()

function isLastMessage(index: number) {
    return index === props.messages.length - 1
}

// Show a loading indicator when streaming but the last message is from the user
// (i.e., no assistant response has started yet)
const showPendingIndicator = computed(() => {
    if (!props.isStreaming || props.messages.length === 0) return false
    const lastMsg = props.messages[props.messages.length - 1]
    return lastMsg?.role === 'user'
})
</script>

<template>
    <div class="flex flex-col">
        <article v-for="(msg, index) in messages" :key="msg.id" class="px-16"
            :class="{ 'pt-12 pb-12': msg.role === 'user', 'pb-12': msg.role !== 'user' }">
            <div class="mx-auto max-w-3xl">
                <V1ChatMessage :message="msg" :is-loading="isStreaming && isLastMessage(index)"
                    @retry="emit('retry', $event)" @copy="emit('copy', $event)" @edit="emit('edit', $event)"
                    @branch="emit('branch', $event)" />
            </div>
        </article>

        <!-- Pending indicator: shown after user message while waiting for assistant response -->
        <article v-if="showPendingIndicator" class="px-16 pb-12">
            <div class="mx-auto max-w-3xl">
                <Spinner />
            </div>
        </article>
    </div>
</template>
