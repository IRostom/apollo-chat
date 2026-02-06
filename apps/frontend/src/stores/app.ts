import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Model } from '@/types/chat'

export const useAppStore = defineStore(
  'app',
  () => {
    const userSelectedModel = ref<Model | undefined>(undefined)
    const userSelectedProvider = ref<string | undefined>(undefined)
    const userSelectedModelFamily = ref<string | undefined>(undefined)
    const userSelectedModelName = computed(() => userSelectedModel.value?.name)
    const canThink = computed(() => userSelectedModel.value?.thinking ?? false)
    const shouldThink = ref(false)
    const canUseWebTools = computed(() => userSelectedModel.value?.tools ?? false)
    const useWebTools = ref(false)
    const supportsVision = computed(() => userSelectedModel.value?.vision ?? false)

    function updateUserSelectedModel(v: Model | undefined) {
      userSelectedModel.value = v
      if (v?.providerId) {
        userSelectedProvider.value = v.providerId
      }
    }
    function updateUserSelectedProvider(v: string | undefined) {
      userSelectedProvider.value = v
    }
    function updateUserSelectedModelFamily(v: string | undefined) {
      userSelectedModelFamily.value = v
    }
    function updateShouldThink(v: boolean) {
      shouldThink.value = v
    }
    function updateUseWebTools(v: boolean) {
      useWebTools.value = v
    }

    return {
      userSelectedModel,
      userSelectedProvider,
      userSelectedModelFamily,
      userSelectedModelName,
      canThink,
      canUseWebTools,
      shouldThink,
      useWebTools,
      supportsVision,
      updateUserSelectedModel,
      updateUserSelectedProvider,
      updateUserSelectedModelFamily,
      updateShouldThink,
      updateUseWebTools,
    }
  },
  {
    persist: true,
  },
)
