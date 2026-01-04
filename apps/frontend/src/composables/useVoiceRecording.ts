import { ref, onMounted } from 'vue'

export function useVoiceRecording(onRecordSuccess?: (blob: Blob) => void) {
  const isRecording = ref(false)
  const canRecord = ref(false)
  const audioChunks = ref<BlobPart[]>([])
  const audioBlob = ref<Blob | null>(null)
  const audioUrl = ref<string | null>(null)
  const mediaRecorder = ref<MediaRecorder | null>(null)
  const mediaStream = ref<MediaStream | null>(null)

  onMounted(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      console.log('MediaDevices.getUserMedia() not supported on your browser!')
      canRecord.value = false
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStream.value = stream
      mediaRecorder.value = new MediaRecorder(stream)

      mediaRecorder.value.ondataavailable = (e) => {
        audioChunks.value.push(e.data)
      }

      mediaRecorder.value.onstop = () => {
        const wavBlob = new Blob(audioChunks.value, { type: 'audio/wav' })
        audioBlob.value = wavBlob
        audioChunks.value = []
        audioUrl.value = URL.createObjectURL(wavBlob)
        isRecording.value = false
        onRecordSuccess?.(wavBlob)
      }

      canRecord.value = true
    } catch (error) {
      console.log('Failed to get audio input:', (error as Error).message)
      canRecord.value = false
    }
  })

  function startRecording() {
    if (!canRecord.value || !mediaRecorder.value) return
    audioBlob.value = null
    audioUrl.value = null
    audioChunks.value = []
    isRecording.value = true
    mediaRecorder.value.start()
  }

  function stopRecording() {
    if (!isRecording.value || !mediaRecorder.value) return
    mediaRecorder.value.stop()
  }

  return {
    isRecording,
    canRecord,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
  }
}
