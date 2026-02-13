<script setup lang="ts">
import { useV1Chat } from '@/composables/useV1Chat'
import { useUploadFile } from '@/queries/upload'
import V1ChatMessages from './V1ChatMessages.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import { toast } from 'vue-sonner'

const {
    messages,
    isStreaming,
    isEmpty,
    editingMessage,
    startEdit,
    cancelEdit,
    submitEdit,
    sendMessage,
    regenerate,
    stop,
    branchConversation,
} = useV1Chat()
const { files, uploadFile, reset } = useUploadFile()

async function handleSend(message: string) {
    if (editingMessage.value) {
        await submitEdit(message)
        reset()
    } else {
        const didSend = await sendMessage(message, files.value)
        if (didSend) {
            reset()
        }
    }
}

function handleEdit(payload: { id: string; content: string }) {
    startEdit(payload)
}

function handleCancelEdit() {
    cancelEdit()
}

async function handleRetry(messageId: string) {
    const lastAssistantId = [...messages.value]
        .reverse()
        .find((message) => message.role === 'assistant')?.id

    if (lastAssistantId && messageId !== lastAssistantId) {
        await regenerate(messageId)
    } else {
        await regenerate()
    }
}

async function handleStop() {
    await stop()
    toast.info('Stopped generation')
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

async function handleBranch(messageId: string) {
    await branchConversation(messageId)
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
                        :editing-content="editingMessage?.content"
                        @send="handleSend"
                        @stop="handleStop"
                        @attach="handleAttach"
                        @cancel-edit="handleCancelEdit"
                    />
                </div>
            </div>
        </div>

        <!-- Messages -->
        <div v-else class="flex-1 overflow-auto">
            <V1ChatMessages
                :messages="messages"
                :is-streaming="isStreaming"
                @retry="handleRetry"
                @copy="handleCopy"
                @edit="handleEdit"
                @branch="handleBranch"
            />
        </div>

        <!-- Input (shown when messages exist) -->
        <ChatInput
            v-if="!isEmpty"
            :is-streaming="isStreaming"
            :files="files"
            :editing-content="editingMessage?.content"
            @send="handleSend"
            @stop="handleStop"
            @attach="handleAttach"
            @cancel-edit="handleCancelEdit"
        />
    </div>
</template>
