import V1ChatView from '@/components/v1/V1ChatView.vue'
import SignInView from '@/views/SignInView.vue'
import { createRouter, createWebHistory } from 'vue-router'
import { watch } from 'vue'
import { useAuth } from '@clerk/vue'

const routes = [
  { path: '/sign-in', name: 'sign-in', component: SignInView, meta: { public: true } },
  { path: '/', name: 'new-chat', component: V1ChatView },
  { path: '/:id', name: 'chat', component: V1ChatView },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async (to) => {
  const { isSignedIn, isLoaded } = useAuth()

  // Wait for Clerk to finish loading before making auth decisions
  if (!isLoaded.value) {
    await new Promise<void>((resolve) => {
      const stop = watch(isLoaded, (loaded) => {
        if (loaded) {
          stop()
          resolve()
        }
      }, { immediate: true })
    })
  }

  if (!to.meta.public && !isSignedIn.value) {
    return { name: 'sign-in' }
  }

  // Redirect signed-in users away from sign-in page
  if (to.name === 'sign-in' && isSignedIn.value) {
    return { name: 'new-chat' }
  }
})

export default router
