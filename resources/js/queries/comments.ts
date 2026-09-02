import { defineQueryOptions } from '@pinia/colada'
import { commentsApi } from '@/services/comments.api'

export const COMMENT_KEYS = {
  all: () => ['comments'] as const,
  byPin: (pinId: number) => [...COMMENT_KEYS.all(), pinId] as const,
}

export const commentsByPinQuery = (pinId: number) =>
  defineQueryOptions({
    key: COMMENT_KEYS.byPin(pinId),
    query: () => commentsApi.list(pinId),
    staleTime: 10_000,
  })
