<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, X, Key, Cloud, Server } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import {
  getProviderStatus,
  updateSetting,
  deleteSetting,
  type ProviderStatus,
} from '@/api/settings'
import type { ProviderName } from '@/types/chat'

// Provider configuration
const providers = ref<ProviderStatus[]>([])
const isLoading = ref(true)

// API key inputs for each provider
const apiKeys = ref<Record<string, string>>({
  OPENAI_API_KEY: '',
  GOOGLE_GENERATIVE_AI_API_KEY: '',
  ANTHROPIC_API_KEY: '',
})

// Track which fields are being edited
const isEditing = ref<Record<string, boolean>>({})

// Provider display info
const providerInfo: Record<
  ProviderName,
  { name: string; keyName: string; description: string; icon: typeof Cloud }
> = {
  ollama: {
    name: 'Ollama',
    keyName: '',
    description: 'Local LLM server - no API key required',
    icon: Server,
  },
  openai: {
    name: 'OpenAI',
    keyName: 'OPENAI_API_KEY',
    description: 'GPT-4, GPT-3.5, and other OpenAI models',
    icon: Cloud,
  },
  google: {
    name: 'Google AI',
    keyName: 'GOOGLE_GENERATIVE_AI_API_KEY',
    description: 'Gemini Pro and other Google AI models',
    icon: Cloud,
  },
  anthropic: {
    name: 'Anthropic',
    keyName: 'ANTHROPIC_API_KEY',
    description: 'Claude 3, Claude 2, and other Anthropic models',
    icon: Cloud,
  },
}

async function loadProviderStatus() {
  try {
    isLoading.value = true
    const response = await getProviderStatus()
    providers.value = response.providers
  } catch (error) {
    toast.error('Failed to load provider status')
    console.error(error)
  } finally {
    isLoading.value = false
  }
}

async function saveApiKey(keyName: string) {
  const value = apiKeys.value[keyName]
  if (!value?.trim()) {
    toast.error('API key cannot be empty')
    return
  }

  try {
    await updateSetting(keyName, value.trim())
    toast.success('API key saved')
    apiKeys.value[keyName] = ''
    isEditing.value[keyName] = false
    await loadProviderStatus()
  } catch (error) {
    toast.error('Failed to save API key')
    console.error(error)
  }
}

async function removeApiKey(keyName: string) {
  try {
    await deleteSetting(keyName)
    toast.success('API key removed')
    await loadProviderStatus()
  } catch (error) {
    toast.error('Failed to remove API key')
    console.error(error)
  }
}

function startEditing(keyName: string) {
  isEditing.value[keyName] = true
}

function cancelEditing(keyName: string) {
  isEditing.value[keyName] = false
  apiKeys.value[keyName] = ''
}

function getProviderInfo(provider: ProviderStatus) {
  return providerInfo[provider.name] || {
    name: provider.name,
    keyName: '',
    description: '',
    icon: Cloud,
  }
}

onMounted(() => {
  loadProviderStatus()
})
</script>

<template>
  <div class="container mx-auto max-w-3xl py-8 px-4">
    <div class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight">Settings</h1>
      <p class="text-muted-foreground mt-2">
        Configure API keys to enable different AI providers.
      </p>
    </div>

    <div class="space-y-4">
      <Card v-for="provider in providers" :key="provider.name">
        <CardHeader class="flex flex-row items-center gap-4">
          <div
            class="flex h-12 w-12 items-center justify-center rounded-lg"
            :class="provider.configured ? 'bg-green-500/10' : 'bg-muted'"
          >
            <component
              :is="getProviderInfo(provider).icon"
              class="h-6 w-6"
              :class="provider.configured ? 'text-green-500' : 'text-muted-foreground'"
            />
          </div>
          <div class="flex-1">
            <CardTitle class="flex items-center gap-2">
              {{ getProviderInfo(provider).name }}
              <span
                v-if="provider.configured"
                class="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500"
              >
                <Check class="h-3 w-3" />
                Configured
              </span>
              <span
                v-else-if="provider.requiresApiKey"
                class="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-500"
              >
                <Key class="h-3 w-3" />
                API Key Required
              </span>
            </CardTitle>
            <CardDescription>
              {{ getProviderInfo(provider).description }}
              <span
                v-if="provider.configured && provider.keySource"
                class="block text-xs mt-1"
              >
                Source: {{ provider.keySource === 'env' ? 'Environment Variable' : 'Database' }}
              </span>
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent v-if="provider.requiresApiKey">
          <!-- Show input when editing or not configured -->
          <div
            v-if="isEditing[getProviderInfo(provider).keyName] || !provider.configured"
            class="flex gap-2"
          >
            <div class="flex-1 relative">
              <Key class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                v-model="apiKeys[getProviderInfo(provider).keyName]"
                type="password"
                :placeholder="`Enter ${getProviderInfo(provider).name} API key`"
                class="pl-10"
                @keyup.enter="saveApiKey(getProviderInfo(provider).keyName)"
              />
            </div>
            <Button @click="saveApiKey(getProviderInfo(provider).keyName)">
              <Check class="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button
              v-if="provider.configured"
              variant="ghost"
              @click="cancelEditing(getProviderInfo(provider).keyName)"
            >
              <X class="h-4 w-4" />
            </Button>
          </div>

          <!-- Show update/remove buttons when configured and not editing -->
          <div v-else class="flex gap-2">
            <Button
              variant="outline"
              @click="startEditing(getProviderInfo(provider).keyName)"
            >
              Update Key
            </Button>
            <Button
              v-if="provider.keySource === 'database'"
              variant="destructive"
              @click="removeApiKey(getProviderInfo(provider).keyName)"
            >
              Remove
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <div class="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  </div>
</template>
