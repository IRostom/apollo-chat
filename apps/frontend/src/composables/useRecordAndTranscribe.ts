import { transcribe } from '@/queries/transcribe'
import { useMutation } from '@tanstack/vue-query'
import { useVoiceRecording } from './useVoiceRecording'
import { watch } from 'vue'

export function useRecordAndTranscribe(onTranscriptionSuccess?: (result: string) => void) {
  const {
    startRecording: startRecordingFn,
    stopRecording: stopRecordingFn,
    isRecording,
    audioBlob,
    canRecord,
  } = useVoiceRecording()

  const { mutate, isPending: isTranscribing } = useMutation({
    mutationFn: ({ audio, model }: { audio: Blob; model?: string }) => {
      return transcribe(audio, model)
    },
    onSuccess: (data) => {
      console.log('transcribe success: ', data)
      onTranscriptionSuccess?.(data.text)
    },
    onError: (error) => {
      console.error('transcribe error: ', error)
    },
  })

  function startRecording() {
    if (!canRecord.value) return
    startRecordingFn()
  }
  function stopRecordingAndTranscribe() {
    if (!canRecord.value) return
    stopRecordingFn()
  }

  watch([isRecording, audioBlob], ([isRecording, audioBlob]) => {
    if (!isRecording && audioBlob) {
      mutate({ audio: audioBlob, model: undefined })
    }
  })

  return { isRecording, isTranscribing, canRecord, startRecording, stopRecordingAndTranscribe }
}
