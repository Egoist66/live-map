export interface PaginationMeta {
  current_page: number
  from: number | null
  last_page: number
  path: string
  per_page: number
  to: number | null
  total: number
}

export interface PaginatedResponse<T> {
  data: T[]
  current_page: number
  last_page: number
  per_page: number
  total: number
  links?: unknown
  meta?: PaginationMeta
}

export interface ApiError {
  message: string
  errors?: Record<string, string[]>
}
