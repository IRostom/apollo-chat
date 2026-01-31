import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Model, ProviderName } from '@/types/chat'

export const useAppStore = defineStore(
  'app',
  () => {
    // Provider and model selection
    const userSelectedProvider = ref<ProviderName>('ollama')
    const userSelectedModel = ref<Model | undefined>(undefined)

    // Computed values
    const userSelectedModelId = computed(() => userSelectedModel.value?.id)
    const userSelectedModelName = computed(() => userSelectedModel.value?.name)

    // Model capabilities
    const canUseTools = computed(() => userSelectedModel.value?.capabilities?.tools ?? false)
    const supportsVision = computed(() => userSelectedModel.value?.capabilities?.vision ?? false)

    // User preferences
    const useWebTools = ref(false)

    // Actions
    function updateUserSelectedProvider(provider: ProviderName) {
      userSelectedProvider.value = provider
    }

    function updateUserSelectedModel(model: Model | undefined) {
      userSelectedModel.value = model
      // Update provider when model is selected
      if (model) {
        userSelectedProvider.value = model.provider
      }
    }

    function updateUseWebTools(value: boolean) {
      useWebTools.value = value
    }

    return {
      // State
      userSelectedProvider,
      userSelectedModel,

      // Computed
      userSelectedModelId,
      userSelectedModelName,
      canUseTools,
      supportsVision,

      // Preferences
      useWebTools,

      // Actions
      updateUserSelectedProvider,
      updateUserSelectedModel,
      updateUseWebTools,
    }
  },
  {
    persist: true,
  },
)
