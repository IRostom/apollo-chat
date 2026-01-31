<script setup lang="ts">
import {
  ArrowUpIcon,
  PlusIcon,
  ChevronDown,
  Globe,
  Image,
  Mic,
  Square,
  Eye,
  Hammer,
} from 'lucide-vue-next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { Toggle } from '@/components/ui/toggle'
import { ref, computed, watch, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { useModels } from '@/queries/models'
import type { ChatFile, Model, ProviderName } from '@/types/chat'
import { useRecordAndTranscribe } from '@/composables/useRecordAndTranscribe'
import Spinner from '../ui/spinner/Spinner.vue'
import { toast } from 'vue-sonner'

interface Props {
  isStreaming?: boolean
  files?: ChatFile[]
  editingContent?: string
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false,
})

const emit = defineEmits<{
  send: [message: string]
  stop: []
  attach: [file: File]
  cancelEdit: []
}>()

const isEditing = computed(() => props.editingContent !== undefined)

const appStore = useAppStore()
const { data: modelsByProvider, isError: isModelsError, error: modelsError } = useModels()

// Get list of providers that have models
const providers = computed(() => Object.keys(modelsByProvider.value ?? {}) as ProviderName[])

// Provider display names
const providerLabels: Record<ProviderName, string> = {
  ollama: 'Ollama',
  openai: 'OpenAI',
  google: 'Google',
  anthropic: 'Anthropic',
}

const { startRecording, stopRecordingAndTranscribe, isRecording, isTranscribing, canRecord } =
  useRecordAndTranscribe((result) => {
    console.log('transcribe result: ', result)
    userMsg.value = result
  })

watch(isModelsError, (hasError) => {
  if (hasError) {
    console.log('modelsError: ', modelsError.value?.message)
    toast.error('Failed to fetch models', {
      description: modelsError.value?.message,
    })
  }
})

// Populate input when editing content changes, clear when editing is canceled
watch(
  () => props.editingContent,
  (content, oldContent) => {
    if (content !== undefined) {
      userMsg.value = content
    } else if (oldContent !== undefined) {
      // Editing was canceled, clear the input
      userMsg.value = ''
    }
  },
)

const userMsg = ref('')
const userSelectedModelName = computed(() => appStore.userSelectedModelName)
const canUseTools = computed(() => appStore.canUseTools)
const supportsVision = computed(() => appStore.supportsVision)

function send() {
  if (props.isStreaming || !userSelectedModelName.value?.length || !userMsg.value.trim()) {
    return
  }
  emit('send', userMsg.value)
  userMsg.value = ''
}

function stop() {
  emit('stop')
}

function onEnterKey(e: KeyboardEvent) {
  if (props.isStreaming || !userSelectedModelName.value?.length || !userMsg.value.trim()) return
  // If the user held Shift, we let the textarea handle it (newline)
  if (e.shiftKey) return

  // Prevent the default behaviour – otherwise the textarea would insert a newline
  e.preventDefault()

  // Submit whatever is in `text`
  send()
}

function updateSelectedModel(model: Model) {
  appStore.updateUserSelectedModel(model)
}

const fileInputRef = ref<HTMLInputElement | null>(null)

function openFilePicker() {
  fileInputRef.value?.click()
}

function onFileChange(event: Event) {
  const files = (event.target as HTMLInputElement).files
  if (!files || !files.length) return
  const file = files[0]

  if (files.length === 1) {
    emit('attach', file!)
  }

  console.log('Selected file:', file)
}

const filesUrls = ref<Array<ChatFile & { url: string }>>([])
const createdUrls: string[] = []

function revokeUrls() {
  createdUrls.forEach((url) => URL.revokeObjectURL(url))
  createdUrls.length = 0
}

watch(
  () => props.files,
  (newFiles) => {
    revokeUrls()
    filesUrls.value =
      newFiles?.map((f) => {
        const url = URL.createObjectURL(f.file)
        createdUrls.push(url)
        return { ...f, url }
      }) ?? []
  },
  { immediate: true, deep: true },
)

onUnmounted(() => {
  revokeUrls()
})
</script>

<template>
  <div class="sticky bottom-0 max-w-3xl w-full mx-auto pb-4 bg-background">
    <!-- Editing indicator -->
    <div
      v-if="isEditing"
      class="flex items-center justify-between px-3 py-2 mb-2 rounded-lg bg-muted border"
    >
      <span class="text-sm text-muted-foreground">Editing message</span>
      <button
        @click="emit('cancelEdit')"
        class="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Cancel
      </button>
    </div>
    <InputGroup>
      <InputGroupAddon align="block-start">
        <div class="flex items-center justify-start gap-3">
          <div v-for="file in filesUrls" :key="file.url" class="border rounded-xl p-1">
            <img :src="file.url" class="w-14.5 h-14.5" />
          </div>
        </div>
      </InputGroupAddon>
      <InputGroupTextarea
        v-model="userMsg"
        @keydown.enter="onEnterKey"
        placeholder="Ask anything"
        :disabled="isStreaming || isTranscribing || isRecording"
      />
      <InputGroupAddon align="block-end">
        <InputGroupButton variant="outline" class="rounded-full" size="icon-xs">
          <PlusIcon class="size-4" />
        </InputGroupButton>
        <InputGroupButton
          size="icon-sm"
          class="rounded-full"
          aria-label="Attach file"
          :disabled="!supportsVision"
          @click="openFilePicker"
        >
          <Image />
        </InputGroupButton>
        <input
          id="picture"
          type="file"
          class="hidden"
          ref="fileInputRef"
          accept="image/*"
          @change="onFileChange"
        />
        <Toggle
          size="sm"
          :modelValue="appStore.useWebTools"
          :disabled="!canUseTools"
          @update:modelValue="appStore.updateUseWebTools"
          aria-label="Toggle web search"
        >
          <Globe class="h-4 w-4" />
          Search
        </Toggle>
        <div class="ml-auto flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <InputGroupButton variant="ghost" class="capitalize">
                {{ userSelectedModelName ?? 'Select Model' }}
                <ChevronDown />
              </InputGroupButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" class="[--radius:0.95rem]">
              <DropdownMenuSub v-for="provider in providers" :key="provider">
                <DropdownMenuSubTrigger class="capitalize">{{
                  providerLabels[provider] || provider
                }}</DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      v-for="model in modelsByProvider?.[provider] ?? []"
                      :key="model.id"
                      @click="updateSelectedModel(model)"
                      class="capitalize"
                    >
                      {{ model.name }}
                      <div
                        v-if="model.capabilities?.vision"
                        class="border border-yellow-300 rounded py-0.5 px-1"
                      >
                        <Eye class="size-4 text-yellow-300" />
                      </div>
                      <div
                        v-if="model.capabilities?.tools"
                        class="border border-blue-300 rounded py-0.5 px-1"
                      >
                        <Hammer class="size-4 text-blue-300" />
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- Stop button - shown while streaming -->
          <InputGroupButton
            v-if="isStreaming"
            variant="destructive"
            class="rounded-full ml-auto"
            size="icon-xs"
            @click="stop()"
          >
            <Square class="size-4" />
            <span class="sr-only">Stop generation</span>
          </InputGroupButton>

          <!-- Send button - shown when there's text or can't record -->
          <InputGroupButton
            v-else-if="userMsg.trim().length || !canRecord"
            variant="default"
            class="rounded-full ml-auto"
            size="icon-xs"
            @click="send()"
            :disabled="
              isStreaming ||
              !userSelectedModelName?.length ||
              isTranscribing ||
              isRecording ||
              !userMsg.trim().length
            "
          >
            <ArrowUpIcon class="size-4" />
            <span class="sr-only">Send</span>
          </InputGroupButton>

          <!-- Record button - shown when can record and no text -->
          <InputGroupButton
            v-else-if="canRecord"
            variant="default"
            class="rounded-full ml-auto"
            size="icon-xs"
            @click="isRecording ? stopRecordingAndTranscribe() : startRecording()"
            :disabled="isStreaming || isTranscribing"
          >
            <Square v-if="isRecording" class="size-4" />
            <Mic v-else-if="!isTranscribing" class="size-4" />
            <Spinner v-else class="size-4 animate-spin" />
            <span class="sr-only">{{
              isTranscribing ? 'Transcribing...' : isRecording ? 'Stop Recording' : 'Record'
            }}</span>
          </InputGroupButton>
        </div>
      </InputGroupAddon>
    </InputGroup>
  </div>
</template>
