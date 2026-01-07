import { getApiUrl, API_CONFIG } from '@/config/api'

export interface TranscriptionResult {
  text: string
  language: string
}

export async function transcribe(audio: Blob, model?: string): Promise<TranscriptionResult> {
  const formData = new FormData()
  formData.append('audio', audio)
  if (model) {
    formData.append('model', model)
  }
  const response = await fetch(getApiUrl(API_CONFIG.endpoints.transcribe), {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) {
    const res = await response.json()
    throw new Error(res.error || 'Transcribe failed')
  }
  return response.json()
}
