import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useAppStore = defineStore(
  'app',
  () => {
    const userSelectedModel = ref<string | undefined>(undefined)
    const shouldThink = ref(false)
    const useWebTools = ref(false)

    function updateUserSelectedModel(v: string | undefined) {
      userSelectedModel.value = v
    }
    function updateShouldThink(v: boolean) {
      shouldThink.value = v
    }
    function updateUseWebTools(v: boolean) {
      useWebTools.value = v
    }

    return {
      userSelectedModel,
      shouldThink,
      useWebTools,
      updateUserSelectedModel,
      updateShouldThink,
      updateUseWebTools,
    }
  },
  {
    persist: true,
  },
)
