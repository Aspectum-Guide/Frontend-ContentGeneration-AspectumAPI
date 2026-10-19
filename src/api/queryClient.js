import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (error?.response?.status === 404) return false
        return failureCount < 2
      },
    },
  },
})

// Cache key of the sidebar sessions list; session mutations invalidate it so the
// panel reflects creates/closes/deletes/publishes without polling on every route change.
export const SESSIONS_SIDEBAR_KEY = ['sessions-sidebar']