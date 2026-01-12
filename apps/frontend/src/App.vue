<script setup lang="ts">
import { ScrollArea } from '@/components/ui/scroll-area'
import AppSidebar from '@/components/AppSidebar.vue'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { RouterView } from 'vue-router'
import { useColorMode } from '@vueuse/core'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
// import { Icon } from '@iconify/vue'
import { Moon, Sun } from 'lucide-vue-next'
import { useCopyCode } from 'markdown-it-copy-code'
import { onMounted } from 'vue'
import { Toaster } from '@/components/ui/sonner'
import 'vue-sonner/style.css'

const mode = useColorMode({
  initialValue: 'auto',
  disableTransition: false,
})

// Initialize copy code button
onMounted(() => {
  useCopyCode()
})
</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <ScrollArea class="h-svh relative">
        <header
          class="sticky top-0 flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 bg-background"
        >
          <div class="flex items-center px-4 w-full">
            <!-- <SidebarTrigger class="-ml-1" /> -->
            <!-- <Separator orientation="vertical" class="mr-2 data-[orientation=vertical]:h-4" /> -->
            <div class="flex flex-1"></div>
            <DropdownMenu class="">
              <DropdownMenuTrigger as-child>
                <Button variant="outline">
                  <Moon
                    class="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
                  />
                  <Sun
                    class="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
                  />
                  <span class="sr-only">Toggle theme</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem @click="mode = 'light'"> Light </DropdownMenuItem>
                <DropdownMenuItem @click="mode = 'dark'"> Dark </DropdownMenuItem>
                <DropdownMenuItem @click="mode = 'auto'"> System </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <div class="flex flex-1 flex-col gap-4 p-4 pt-0">
          <RouterView />
        </div>
      </ScrollArea>
    </SidebarInset>
  </SidebarProvider>
  <Toaster position="top-center" :duration="2000" />
</template>

<style scoped></style>
