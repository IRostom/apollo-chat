/**
 * Chat-related type definitions
 * Uses AI SDK types where applicable
 */

import type { UIMessage } from 'ai'

// Re-export AI SDK types
export type { UIMessage }

/**
 * Provider names supported by the application
 */
export type ProviderName = 'ollama' | 'openai' | 'google' | 'anthropic'

/**
 * Server-side message format (from database)
 */
export interface ChatMessageServer {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  id?: number
  thinking?: string
  tool_name?: string
  tool_calls?: string
  images?: string[]
  metadata?: string
}

/**
 * Message metadata (from AI SDK providerMetadata)
 */
export interface ChatMessageMetadata {
  // Standard AI SDK usage
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  // Ollama-specific metrics
  eval_count?: number
  eval_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  tokensPerSecond?: number
  // Common
  done?: boolean
  done_reason?: string
  model?: string
}

/**
 * Legacy chat message format (for backward compatibility)
 * @deprecated Use UIMessage from AI SDK instead
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  id?: number | string
  thinking?: string
  toolName?: string
  codeLanguage?: string
  codeContent?: string
  images?: number[] | string[]
  isError?: boolean
  metadata?: ChatMessageMetadata
}

/**
 * Conversation
 */
export interface Conversation {
  id: string
  title: string
  provider?: ProviderName
  messages?: ChatMessage[]
  createdAt?: string
  updatedAt?: string
}

/**
 * Model definition
 */
export interface Model {
  id: string
  name: string
  provider: ProviderName
  capabilities: {
    vision: boolean
    tools: boolean
    streaming: boolean
  }
}

/**
 * Models grouped by provider
 */
export interface ModelsByProvider {
  [provider: string]: Model[]
}

/**
 * Legacy model format (for backward compatibility with Ollama)
 * @deprecated Use Model interface instead
 */
export interface LegacyModel {
  name: string
  family: string
  families: string[]
  parameter_size: string
  quantization_level: string
  vision: boolean
  thinking: boolean
  tools: boolean
  completion: boolean
  context_length: number
}

/**
 * Legacy models by family
 * @deprecated Use ModelsByProvider instead
 */
export interface ModelsByFamily {
  [key: string]: LegacyModel[]
}

/**
 * Chat file attachment
 */
export interface ChatFile {
  file: File
  isUploaded: boolean
  id?: number
  path?: string
  isError: boolean
}

/**
 * Chat trigger types for AI SDK
 */
export type ChatTrigger = 'send' | 'retry' | 'edit'

/**
 * Options for sending a message
 */
export interface SendMessageOptions {
  text: string
  files?: FileList | File[]
  data?: {
    trigger?: ChatTrigger
    messageId?: string
    content?: string
    conversationId?: string
  }
}

// Legacy types kept for backward compatibility during migration

export type StreamFrameType =
  | 'start'
  | 'conversationId'
  | 'token'
  | 'end'
  | 'error'
  | 'toolName'
  | 'toolValue'
  | 'codeLanguage'
  | 'codeContent'
  | 'thinking'
  | 'isThinking'
  | 'role'
  | 'invalidate'

export interface StreamFrame {
  type: StreamFrameType
  value?: string | boolean
  message?: string
}

export interface RetryMessageOptions {
  messageId: number
  conversationId: string
  model: string
  think?: boolean
  webTools?: boolean
}

export interface EditMessageOptions {
  messageId: number
  conversationId: string
  content: string
  model: string
  think?: boolean
  webTools?: boolean
}
