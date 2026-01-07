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
    if (!navigator.mediaDevices?.enumerateDevices) {
      canRecord.value = false
      return
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const hasAudioInput = devices.some((device) => device.kind === 'audioinput')
      canRecord.value = hasAudioInput
    } catch (error) {
      console.log('Failed to enumerate devices:', (error as Error).message)
      canRecord.value = false
    }
  })

  async function startRecording() {
    if (!canRecord.value) return

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

        // Release the microphone
        mediaStream.value?.getTracks().forEach((track) => track.stop())
        mediaStream.value = null
      }

      audioBlob.value = null
      audioUrl.value = null
      audioChunks.value = []
      isRecording.value = true
      mediaRecorder.value.start()
    } catch (error) {
      console.log('Failed to start recording:', (error as Error).message)
      canRecord.value = false
    }
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
