<script setup lang="ts">
import { ArrowUpIcon, PlusIcon, ChevronDown, Brain, Globe } from 'lucide-vue-next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { Toggle } from '@/components/ui/toggle'
import { ref, computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { useModels } from '@/queries/models'

interface Props {
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const emit = defineEmits<{
  send: [message: string]
}>()

const appStore = useAppStore()
const { data: models } = useModels()

const userMsg = ref('')
const userSelectedModel = computed(() => appStore.userSelectedModel)

function send() {
  if (props.disabled || !userSelectedModel.value?.length || !userMsg.value.trim()) {
    return
  }
  emit('send', userMsg.value)
  userMsg.value = ''
}

function onEnterKey(e: KeyboardEvent) {
  if (props.disabled || !userSelectedModel.value?.length || !userMsg.value.trim()) return
  // If the user held Shift, we let the textarea handle it (newline)
  if (e.shiftKey) return

  // Prevent the default behaviour – otherwise the textarea would insert a newline
  e.preventDefault()

  // Submit whatever is in `text`
  send()
}

function updateSelectedModel(model: string) {
  appStore.updateUserSelectedModel(model)
}
</script>

<template>
  <div class="sticky bottom-0 max-w-3xl w-full mx-auto pb-4 bg-white">
    <InputGroup>
      <InputGroupTextarea
        v-model="userMsg"
        @keydown.enter="onEnterKey"
        placeholder="Ask anything"
        :disabled="disabled"
      />
      <InputGroupAddon align="block-end">
        <InputGroupButton variant="outline" class="rounded-full" size="icon-xs">
          <PlusIcon class="size-4" />
        </InputGroupButton>
        <Toggle
          size="sm"
          :modelValue="appStore.shouldThink"
          @update:modelValue="appStore.updateShouldThink"
          aria-label="Toggle think"
        >
          <Brain class="h-4 w-4" />
          Think
        </Toggle>
        <Toggle
          size="sm"
          :modelValue="appStore.useWebTools"
          @update:modelValue="appStore.updateUseWebTools"
          aria-label="Toggle think"
        >
          <Globe class="h-4 w-4" />
          Search
        </Toggle>
        <div class="ml-auto flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <InputGroupButton variant="ghost">
                {{ userSelectedModel ?? 'Select Model' }}
                <ChevronDown />
              </InputGroupButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" class="[--radius:0.95rem]">
              <DropdownMenuItem
                v-for="model in models"
                :key="model.name"
                @click="updateSelectedModel(model.name)"
                >{{ model.name }}</DropdownMenuItem
              >
            </DropdownMenuContent>
          </DropdownMenu>

          <InputGroupButton
            variant="default"
            class="rounded-full ml-auto"
            size="icon-xs"
            @click="send()"
            :disabled="disabled || !userSelectedModel?.length"
          >
            <ArrowUpIcon class="size-4" />
            <span class="sr-only">Send</span>
          </InputGroupButton>
        </div>
      </InputGroupAddon>
    </InputGroup>
  </div>
</template>
