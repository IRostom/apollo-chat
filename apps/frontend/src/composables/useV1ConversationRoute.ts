/**
 * V1 Conversation Route Composable
 * Handles conversation ID from route and navigation for /v1 routes
 */

import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/**
 * Handle conversation ID from route and navigation for v1 chat
 */
export function useV1ConversationRoute() {
  const route = useRoute()
  const router = useRouter()

  const conversationId = computed(() => {
    return route.params.id ? (route.params.id as string) : undefined
  })

  /**
   * Navigate to a v1 conversation
   */
  function navigateToConversation(id: string) {
    router.replace(`/v1/${id}`)
  }

  return {
    conversationId,
    navigateToConversation,
  }
}
