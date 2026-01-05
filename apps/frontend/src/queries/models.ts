import { useQuery } from '@tanstack/vue-query'
import { getModels } from '@/api/models'

export function useModels() {
  return useQuery({
    queryKey: ['models'],
    queryFn: getModels,
  })
}
