/**
 * Conversation composable
 * Handles conversation ID from route and navigation logic
 */

import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/**
 * Handle conversation ID from route and navigation
 */
export function useConversationRoute() {
  const route = useRoute()
  const router = useRouter()

  const conversationId = computed(() => {
    return route.params.id ? (route.params.id as string) : undefined
  })

  /**
   * Navigate to a conversation
   */
  function navigateToConversation(id: string) {
    router.replace(`/${id}`)
  }

  return {
    conversationId,
    navigateToConversation,
  }
}
