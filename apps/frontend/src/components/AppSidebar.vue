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
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { useChats } from '@/queries/chats'

import { RouterLink } from 'vue-router'
import { toast } from 'vue-sonner'
import { watch } from 'vue'

const props = withDefaults(defineProps<SidebarProps>(), {
  collapsible: 'icon',
})

const { data: chats, isError, error } = useChats()

const { open, setOpen } = useSidebar()

const data = {
  navMain: [
    {
      title: 'New Chat',
      url: '/',
      icon: SquarePen,
    },
  ],
}

watch(isError, (isError) => {
  if (isError) {
    toast.error(
      'Failed to fetch chats: ' +
        (error.value instanceof Error ? error.value.message : 'Unknown error'),
    )
  }
})
</script>

<template>
  <Sidebar v-bind="props">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem class="flex items-center justify-between">
          <SidebarMenuButton as-child class="data-[slot=sidebar-menu-button]:p-1.5!">
            <RouterLink to="/" v-if="open">
              <Sparkle class="size-5!" />
              <span class="text-base font-semibold">Apollo</span>
            </RouterLink>
            <Sparkle v-else class="size-5!" @click="setOpen(true)" />
          </SidebarMenuButton>
          <SidebarTrigger v-if="open" />
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <NavMain :items="data.navMain" class="sticky top-0 z-10 bg-sidebar" />
      <NavChats :chats="chats" />
    </SidebarContent>
    <SidebarFooter> </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>
