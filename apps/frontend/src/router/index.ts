import V1ChatView from '@/components/v1/V1ChatView.vue'
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'new-chat', component: V1ChatView },
  { path: '/:id', name: 'chat', component: V1ChatView },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
