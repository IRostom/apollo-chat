<script setup lang="ts">
import type { SidebarProps } from '@/components/ui/sidebar'

import { Sparkle, SquarePen } from 'lucide-vue-next'
import NavMain from '@/components/NavMain.vue'
import NavChats from '@/components/NavChats.vue'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { useChats } from '@/queries/chats'

import { RouterLink } from 'vue-router'

const props = withDefaults(defineProps<SidebarProps>(), {
  collapsible: 'icon',
})

const { data: chats } = useChats()

// This is sample data.
const data = {
  user: {
    name: 'shadcn',
    email: 'm@example.com',
    avatar: '/avatars/shadcn.jpg',
  },
  navMain: [
    {
      title: 'New Chat',
      url: '/',
      icon: SquarePen,
    },
  ],
}
</script>

<template>
  <Sidebar v-bind="props">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton as-child class="data-[slot=sidebar-menu-button]:p-1.5!">
            <RouterLink to="/">
              <Sparkle class="size-5!" />
              <span class="text-base font-semibold">Apollo</span>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <NavMain :items="data.navMain" />
      <NavChats :chats="chats" />
    </SidebarContent>
    <SidebarFooter> </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>
