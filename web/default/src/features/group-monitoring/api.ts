import { api } from '@/lib/api'
import type { GroupDetail, GroupSummary, HistoryResponse } from './types'

type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
  // The history endpoint sometimes returns an extra top-level field.
  aggregation_interval_minutes?: number
}

export async function fetchGroups(admin: boolean): Promise<GroupSummary[]> {
  const prefix = admin ? 'admin' : 'public'
  const res = await api.get<ApiResponse<GroupSummary[]>>(
    `/api/monitoring/${prefix}/groups`
  )
  if (!res.data.success) {
    throw new Error(res.data.message || 'Failed to fetch monitoring groups')
  }
  return res.data.data || []
}

export async function fetchGroupHistory(
  admin: boolean,
  groupName: string
): Promise<{ history: HistoryResponse['history']; intervalMinutes: number }> {
  const prefix = admin ? 'admin' : 'public'
  const res = await api.get<
    ApiResponse<HistoryResponse | HistoryResponse['history']>
  >(`/api/monitoring/${prefix}/groups/${encodeURIComponent(groupName)}/history`)
  if (!res.data.success) {
    return { history: [], intervalMinutes: 5 }
  }
  const raw = res.data.data
  // The backend may return either { history, aggregation_interval_minutes }
  // wrapped in `data`, or just the history array.
  const wrapped = raw && !Array.isArray(raw) ? (raw as HistoryResponse) : null
  const history = wrapped
    ? wrapped.history || []
    : (raw as HistoryResponse['history']) || []
  const intervalMinutes =
    wrapped?.aggregation_interval_minutes ??
    res.data.aggregation_interval_minutes ??
    5
  return { history, intervalMinutes }
}

export async function fetchAdminGroupDetail(
  groupName: string
): Promise<GroupDetail | null> {
  const res = await api.get<ApiResponse<GroupDetail>>(
    `/api/monitoring/admin/groups/${encodeURIComponent(groupName)}`
  )
  if (!res.data.success) {
    throw new Error(res.data.message || 'Failed to fetch group detail')
  }
  return res.data.data
}

export async function refreshAdminMonitoring(): Promise<boolean> {
  const res = await api.post<ApiResponse<unknown>>(
    '/api/monitoring/admin/refresh'
  )
  return Boolean(res.data?.success)
}
