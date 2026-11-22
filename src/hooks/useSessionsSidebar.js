import { useInfiniteQuery } from '@tanstack/react-query'
import { sessionsAPI } from '../api/generation'
import { SESSIONS_SIDEBAR_KEY } from '../api/queryClient'
import { getWorkspace } from '../utils/workspace'

export const PAGE_SIZE = 40
const REFRESH_MS = 60_000

/**
 * Paginated sessions for the sidebar. Cached across navigation (no refetch per route),
 * refreshed once a minute while the tab is visible, and invalidated by session
 * mutations in api/generation.js.
 */
export default function useSessionsSidebar({ scope, status, q, enabled = true }) {
  const workspace = getWorkspace()
  return useInfiniteQuery({
    queryKey: [...SESSIONS_SIDEBAR_KEY, { scope, status, q, workspace }],
    enabled,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const params = { scope, limit: PAGE_SIZE, offset: pageParam }
      if (status) params.status = status
      if (q) params.q = q
      const response = await sessionsAPI.sidebar(params)
      return response.data
    },
    getNextPageParam: (lastPage) => (lastPage?.has_more ? lastPage.next_offset : undefined),
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  })
}
