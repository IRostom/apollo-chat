<script setup lang="ts">
import { Folder, MoreHorizontal, Trash2 } from 'lucide-vue-next'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ref } from 'vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import ConfirmDeleteChatDialog from '@/components/ConfirmDeleteChatDialog.vue'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useDeleteConversation } from '@/queries/useDeleteConversation'
import { toast } from 'vue-sonner'

const props = withDefaults(
  defineProps<{
    chats: {
      title: string
      id: string | number
    }[]
    routePrefix?: string
  }>(),
  {
    routePrefix: '/',
  },
)

const { isMobile } = useSidebar()
const route = useRoute()
const router = useRouter()
const confirmDeleteChatId = ref<string | null>(null)

const {
  mutate: deleteConversationMutation,
  isPending: isDeletingConversation,
} = useDeleteConversation()

function handleDeleteClick(chatId: string) {
  confirmDeleteChatId.value = chatId
}

function handleDeleteSuccess(conversationId: string) {
  if (route.params.id?.toString() === conversationId) {
    // Navigate to the base route
    router.push('/')
  }
  if (confirmDeleteChatId.value === conversationId) {
    confirmDeleteChatId.value = null
  }
}

function handleDeleteError(error: Error) {
  toast.error('Failed to delete chat', {
    description: error.message,
  })
}
</script>

<template>
  <SidebarGroup class="group-data-[collapsible=icon]:hidden">
    <SidebarGroupLabel>Your Chats</SidebarGroupLabel>
    <SidebarMenu>
      <SidebarMenuItem v-for="chat in chats" :key="chat.id">
        <SidebarMenuButton as-child :is-active="chat.id.toString() === route.params.id">
          <RouterLink :to="props.routePrefix + chat.id">
            <span>{{ chat.title }}</span>
          </RouterLink>
        </SidebarMenuButton>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <SidebarMenuAction show-on-hover>
              <MoreHorizontal />
              <span class="sr-only">More</span>
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent class="w-48 rounded-lg" :side="isMobile ? 'bottom' : 'right'"
            :align="isMobile ? 'end' : 'start'">
            <DropdownMenuItem>
              <Folder class="text-muted-foreground" />
              <span>View Chat</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem @select.prevent="handleDeleteClick(chat.id.toString())">
              <Trash2 class="text-muted-foreground" />
              <span>Delete Chat</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ConfirmDeleteChatDialog :open="confirmDeleteChatId === chat.id.toString()"
          :is-deleting="isDeletingConversation"
          @update:open="(isOpen) => (confirmDeleteChatId = isOpen ? chat.id.toString() : null)" @confirm="
            deleteConversationMutation(chat.id.toString(), {
              onSuccess: (_data: any, conversationId: string) => handleDeleteSuccess(conversationId),
              onError: handleDeleteError,
            })
            " />
      </SidebarMenuItem>
      <!-- <SidebarMenuItem>
        <SidebarMenuButton class="text-sidebar-foreground/70">
          <MoreHorizontal class="text-sidebar-foreground/70" />
          <span>More</span>
        </SidebarMenuButton>
      </SidebarMenuItem> -->
    </SidebarMenu>
  </SidebarGroup>
</template>
