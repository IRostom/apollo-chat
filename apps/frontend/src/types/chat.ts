/**
 * Chat-related type definitions
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

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  id?: number
  thinking?: string
  toolName?: string
  codeLanguage?: string
  codeContent?: string
  images?: number[] | string[]
  isError?: boolean
}

export interface Conversation {
  id: string
  title: string
  messages?: ChatMessage[]
  createdAt?: string
  updatedAt?: string
}

export interface Model {
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

export interface ModelsByFamily {
  [key: string]: Model[]
}

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

export interface SendMessageOptions {
  model: string
  message: ChatMessage
  conversationId?: string
  think?: boolean
  webTools?: boolean
  images?: ChatFile[]
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

export interface ChatFile {
  file: File
  isUploaded: boolean
  id?: number
  path?: string
  isError: boolean
}
