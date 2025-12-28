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
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  id?: number
  thinking?: string
  toolName?: string
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
  size?: number
  digest?: string
  modified_at?: string
}

export type StreamFrameType =
  | 'start'
  | 'conversationId'
  | 'token'
  | 'end'
  | 'error'
  | 'toolName'
  | 'toolValue'
  | 'thinking'
  | 'isThinking'
  | 'role'

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
}
