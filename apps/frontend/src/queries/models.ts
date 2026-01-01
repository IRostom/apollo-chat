import { useQuery } from '@tanstack/vue-query'
import { getModels } from '@/api/chatService'

export function useModels() {
  const { isPending, isFetching, isError, data, error } = useQuery({
    queryKey: ['models'],
    queryFn: async () => {
      return getModels()
    },
    initialData: [],
    refetchInterval: 20000,
  })

  return {
    data,
    isFetching,
  }
}
