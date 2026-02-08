<script setup lang="ts">
import { useV1Chat } from '@/composables/useV1Chat'
import { useUploadFile } from '@/queries/upload'
import V1ChatMessages from './V1ChatMessages.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import { toast } from 'vue-sonner'

const { messages, isStreaming, isEmpty, sendMessage, regenerate } = useV1Chat()
const { files, uploadFile, reset } = useUploadFile()

async function handleSend(message: string) {
    const didSend = await sendMessage(message, files.value)
    if (didSend) {
        reset()
    }
}

async function handleRetry(messageId: string) {
    await regenerate(messageId)
}

function handleStop() {
    // TODO: implement stop when Chat class exposes abort
    toast.info('Stop is not yet supported in v1 chat')
}

async function handleAttach(file: File) {
    await uploadFile(file)
}

async function handleCopy(content: string) {
    try {
        await navigator.clipboard.writeText(content)
        toast.success('Copied to clipboard')
    } catch {
        toast.error('Failed to copy to clipboard')
    }
}
</script>

<template>
    <div class="flex flex-col min-h-[calc(100svh-4rem-2rem)]">
        <!-- Empty state -->
        <div v-if="isEmpty" class="flex-1 flex flex-col items-center justify-center px-4">
            <div class="max-w-3xl w-full flex flex-col items-center gap-8">
                <p class="text-2xl text-muted-foreground">How can I help you today?</p>
                <div class="w-full">
                    <ChatInput
                        :is-streaming="isStreaming"
                        :files="files"
                        @send="handleSend"
                        @stop="handleStop"
                        @attach="handleAttach"
                    />
                </div>
            </div>
        </div>

        <!-- Messages -->
        <div v-else class="flex-1 overflow-auto">
            <V1ChatMessages :messages="messages" :is-streaming="isStreaming" @retry="handleRetry" @copy="handleCopy" />
        </div>

        <!-- Input (shown when messages exist) -->
        <ChatInput
            v-if="!isEmpty"
            :is-streaming="isStreaming"
            :files="files"
            @send="handleSend"
            @stop="handleStop"
            @attach="handleAttach"
        />
    </div>
</template>
