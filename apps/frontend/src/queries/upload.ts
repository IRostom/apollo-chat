import { ref } from 'vue'
import { uploadFile } from '@/api/uploadService'
import type { ChatFile } from '@/types/chat'

export function useUploadFile() {
  const files = ref<Array<ChatFile>>([])

  async function upload(file: File) {
    const newFile = {
      file,
      isUploaded: false,
      id: undefined,
      path: undefined,
      isError: false,
    }
    files.value.push(newFile)
    const index = files.value.length - 1

    try {
      const res = await uploadFile(file)
      console.log('res', res)
      if (res.id) {
        files.value[index] = {
          ...newFile,
          id: res.id,
          path: res.path,
          isUploaded: true,
          isError: false,
        }
      }
    } catch (err) {
      files.value[index] = {
        ...newFile,
        isError: true,
      }
    }
  }

  function reset() {
    files.value = []
  }

  return { files, uploadFile: upload, reset }
}
