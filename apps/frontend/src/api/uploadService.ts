/**
 * Upload API Service
 * Handles all API calls related to upload functionality
 */

import { getApiUrl, API_CONFIG } from '@/config/api'
import type { uploadedFile } from '@/types/file'

/**
 * Get a conversation by ID
 */
export async function uploadFile(file: File): Promise<uploadedFile> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(getApiUrl(API_CONFIG.endpoints.upload.file), {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Upload failed (${response.status} ${response.statusText}): ${text}`)
  }

  const json = response.json()
  return json
}
