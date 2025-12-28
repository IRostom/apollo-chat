/**
 * Conversation composable
 * Handles conversation ID from route and navigation logic
 */

import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/**
 * Handle conversation ID from route and navigation
 */
export function useConversation() {
  const route = useRoute()
  const router = useRouter()

  const conversationId = computed(() => {
    return route.params.id ? (route.params.id as string) : undefined
  })

  // Track the conversationId we're programmatically navigating to (to skip refetch)
  const skipRefetchForId = ref<string | undefined>(undefined)

  // Watch conversationId to clear skipRefetch flag when navigating to a different conversation
  watch(conversationId, (newId) => {
    // Clear the skip flag when conversationId changes to a different value
    // This allows normal refetching for user-initiated navigation to other conversations
    if (skipRefetchForId.value && newId !== skipRefetchForId.value) {
      skipRefetchForId.value = undefined
    }
  })

  /**
   * Navigate to a conversation
   */
  function navigateToConversation(id: string) {
    skipRefetchForId.value = id
    router.replace(`/${id}`)
  }

  return {
    conversationId,
    skipRefetchForId,
    navigateToConversation,
  }
}
