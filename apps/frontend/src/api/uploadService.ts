/**
 * Upload API Service
 * Handles all API calls related to upload functionality
 */

import { getApiUrl, API_CONFIG } from '@/config/api'
import { authFetch } from '@/lib/auth'
import type { uploadedFile } from '@/types/file'

/**
 * Upload a file
 */
export async function uploadFile(file: File): Promise<uploadedFile> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await authFetch(getApiUrl(API_CONFIG.endpoints.upload.file), {
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
