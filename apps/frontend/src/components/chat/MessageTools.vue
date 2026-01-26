<script setup lang="ts">
import { Copy, Pencil, RotateCcw, GitBranch } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface Props {
  role: 'user' | 'assistant'
}

defineProps<Props>()

const emit = defineEmits<{
  copy: []
  edit: []
  retry: []
  branch: []
}>()
</script>

<template>
  <div class="flex items-center gap-1">
    <TooltipProvider>
      <!-- Copy - available for both user and assistant -->
      <Tooltip>
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon-sm" @click="emit('copy')">
            <Copy class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy</TooltipContent>
      </Tooltip>

      <!-- User-specific tools -->
      <template v-if="role === 'user'">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon-sm" @click="emit('edit')">
              <Pencil class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>
      </template>

      <!-- Assistant-specific tools -->
      <template v-if="role === 'assistant'">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon-sm" @click="emit('retry')">
              <RotateCcw class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Retry</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon-sm" @click="emit('branch')">
              <GitBranch class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Branch to new chat</TooltipContent>
        </Tooltip>
      </template>
    </TooltipProvider>
  </div>
</template>
