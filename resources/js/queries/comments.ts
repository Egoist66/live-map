import { defineQueryOptions } from '@pinia/colada'
import { commentsApi } from '@/services/comments.api'

export const COMMENT_KEYS = {
  all: () => ['comments'] as const,
  byPin: (pinId: number) => [...COMMENT_KEYS.all(), pinId] as const,
  byPinPage: (pinId: number, page: number) => [...COMMENT_KEYS.all(), pinId, page] as const,
}

export const commentsByPinQuery = (pinId: number, page = 1) =>
  defineQueryOptions({
    key: COMMENT_KEYS.byPinPage(pinId, page),
    query: () => commentsApi.list(pinId, page),
    staleTime: 10_000,
  })
