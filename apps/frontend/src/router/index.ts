import ChatView from '@/components/ChatView.vue'
import SettingsView from '@/components/SettingsView.vue'
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'new-chat', component: ChatView },
  { path: '/settings', name: 'settings', component: SettingsView },
  { path: '/:id', name: 'chat', component: ChatView },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
