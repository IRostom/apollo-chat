/**
 * Chat-related type definitions
 */

export interface Conversation {
  id: string
  title: string
  createdAt?: string
  updatedAt?: string
}

export interface Model {
  name: string
  label?: string
  providerId: string
  family?: string
  families?: string[]
  parameter_size?: string
  quantization_level?: string
  vision: boolean
  thinking: boolean
  tools: boolean
  pdf: boolean
  completion?: boolean
  context_length?: number
}

export interface ProviderInfo {
  id: string
  label: string
  isAvailable: boolean
  models: Model[]
}

export interface ProvidersResponse {
  providers: ProviderInfo[]
}

export interface ChatFile {
  file: File
  isUploaded: boolean
  id?: string
  key?: string
  url?: string
  isError: boolean
}
