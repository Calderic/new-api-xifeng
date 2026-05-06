// ----------------------------------------------------------------------------
// Group monitoring types — mirrors backend /api/monitoring response shapes
// ----------------------------------------------------------------------------

export type HistoryPoint = {
  recorded_at: number
  availability_rate?: number | null
  cache_hit_rate?: number | null
}

export type GroupSummary = {
  group_name: string
  is_online?: boolean
  online_channels?: number
  total_channels?: number
  availability_rate?: number | null
  cache_hit_rate?: number | null
  avg_frt?: number | null
  first_response_time?: number | null
  last_test_model?: string
  group_ratio?: number | null
  updated_at?: number
  history?: HistoryPoint[]
  aggregation_interval_minutes?: number
}

export type ChannelStat = {
  channel_id: number
  channel_name?: string
  enabled?: boolean
  availability_rate?: number | null
  cache_hit_rate?: number | null
  first_response_time?: number | null
  test_model?: string
  last_test_time?: number | string | null
}

export type GroupDetail = GroupSummary & {
  channel_stats?: ChannelStat[]
}

export type HistoryResponse = {
  history?: HistoryPoint[]
  aggregation_interval_minutes?: number
}
