import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, RefreshCw, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsAdmin } from '@/hooks/use-admin'
import { cn } from '@/lib/utils'
import {
  fetchGroupHistory,
  fetchGroups,
  refreshAdminMonitoring,
} from '../api'
import type { GroupSummary } from '../types'
import { GroupDetailPanel } from './group-detail-panel'
import { GroupStatusCard } from './group-status-card'

const POLL_INTERVAL_MS = 60 * 1000
const SORT_KEY = 'monitoring-sort-mode'

type SortMode = 'status' | 'name' | 'availability'

const SORT_OPTIONS: Array<{ value: SortMode; labelKey: string }> = [
  { value: 'status', labelKey: 'By status' },
  { value: 'name', labelKey: 'By name' },
  { value: 'availability', labelKey: 'By availability' },
]

function compareGroups(a: GroupSummary, b: GroupSummary, mode: SortMode): number {
  const aOnline = a.is_online ?? (a.online_channels ?? 0) > 0
  const bOnline = b.is_online ?? (b.online_channels ?? 0) > 0
  switch (mode) {
    case 'name':
      return (a.group_name || '').localeCompare(b.group_name || '')
    case 'availability': {
      const ar = a.availability_rate ?? -1
      const br = b.availability_rate ?? -1
      return ar - br
    }
    case 'status':
    default:
      if (aOnline !== bOnline) return aOnline ? 1 : -1
      return (a.availability_rate ?? 100) - (b.availability_rate ?? 100)
  }
}

function avgAvailability(groups: GroupSummary[]): number | null {
  const valid = groups
    .map((g) => g.availability_rate)
    .filter((r): r is number => r != null && r >= 0)
  if (valid.length === 0) return null
  return valid.reduce((s, v) => s + v, 0) / valid.length
}

function rateAccent(rate: number | null | undefined): string {
  if (rate == null || rate < 0) return 'var(--muted-foreground)'
  if (rate >= 99) return 'rgb(34 197 94)'
  if (rate >= 95) return 'rgb(132 204 22)'
  if (rate >= 80) return 'rgb(245 158 11)'
  return 'rgb(239 68 68)'
}

export function GroupMonitoringDashboard() {
  const { t } = useTranslation()
  const admin = useIsAdmin()

  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<GroupSummary | null>(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    try {
      const stored = localStorage.getItem(SORT_KEY) as SortMode | null
      return stored && ['status', 'name', 'availability'].includes(stored)
        ? stored
        : 'status'
    } catch {
      return 'status'
    }
  })
  const [countdown, setCountdown] = useState(POLL_INTERVAL_MS)
  const initialLoad = useRef(true)

  const loadGroups = useCallback(
    async (includeHistory: boolean) => {
      try {
        const summaries = await fetchGroups(admin)

        let withHistory = summaries
        if (includeHistory && summaries.length > 0) {
          withHistory = await Promise.all(
            summaries.map(async (g) => {
              try {
                const { history, intervalMinutes } = await fetchGroupHistory(
                  admin,
                  g.group_name
                )
                return {
                  ...g,
                  history,
                  aggregation_interval_minutes: intervalMinutes,
                }
              } catch {
                return g
              }
            })
          )
        }

        setGroups((prev) => {
          if (!includeHistory && prev.length > 0) {
            return withHistory.map((g) => {
              const old = prev.find((p) => p.group_name === g.group_name)
              if (old) {
                return {
                  ...g,
                  history: old.history,
                  aggregation_interval_minutes: old.aggregation_interval_minutes,
                }
              }
              return g
            })
          }
          return withHistory
        })
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : t('Failed to load monitoring data')
        )
      }
    },
    [admin, t]
  )

  // Initial load
  useEffect(() => {
    let active = true
    const init = async () => {
      setLoading(true)
      await loadGroups(true)
      if (!active) return
      setLoading(false)
      initialLoad.current = false
      setCountdown(POLL_INTERVAL_MS)
    }
    init()
    return () => {
      active = false
    }
  }, [loadGroups])

  // Background polling
  useEffect(() => {
    const id = setInterval(() => {
      if (!initialLoad.current) {
        loadGroups(false)
        setCountdown(POLL_INTERVAL_MS)
      }
    }, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [loadGroups])

  // Countdown tick
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      if (admin) {
        const ok = await refreshAdminMonitoring()
        if (ok) toast.success(t('Refreshed'))
      }
      await loadGroups(true)
      setCountdown(POLL_INTERVAL_MS)
    } catch {
      toast.error(t('Refresh failed'))
    } finally {
      setRefreshing(false)
    }
  }

  const handleSort = (val: SortMode) => {
    setSortMode(val)
    try {
      localStorage.setItem(SORT_KEY, val)
    } catch {
      /* ignore */
    }
  }

  const handleCardClick = (group: GroupSummary) => {
    if (!admin) return
    setSelectedGroup(group)
    setDetailVisible(true)
  }

  const visible = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    const filtered = kw
      ? groups.filter((g) => (g.group_name || '').toLowerCase().includes(kw))
      : groups
    return [...filtered].sort((a, b) => compareGroups(a, b, sortMode))
  }, [groups, keyword, sortMode])

  const onlineCount = groups.filter(
    (g) => g.is_online ?? (g.online_channels ?? 0) > 0
  ).length
  const offlineCount = groups.length - onlineCount
  const avgAvail = avgAvailability(groups)

  const countdownLabel = `${Math.floor(countdown / 60000)}:${String(
    Math.floor((countdown % 60000) / 1000)
  ).padStart(2, '0')}`

  return (
    <div className='px-4 pb-12 sm:px-8 lg:px-10'>
      <div className='mx-auto w-full max-w-[1440px]'>
        {/* Title bar */}
        <div className='flex flex-wrap items-center justify-between gap-4 py-6 sm:py-8'>
          <div className='flex flex-wrap items-baseline gap-x-4 gap-y-2'>
            <h1 className='m-0 text-xl font-semibold tracking-tight'>
              {t('Group Monitoring')}
            </h1>
            {!loading && groups.length > 0 && (
              <div className='text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs'>
                <span className='inline-flex items-center gap-1.5'>
                  <span className='inline-block h-1.5 w-1.5 rounded-full bg-emerald-500' />
                  <span className='text-foreground/80 font-mono'>
                    {onlineCount}
                  </span>
                  <span>{t('Online')}</span>
                </span>
                <span className='inline-flex items-center gap-1.5'>
                  <span
                    className='inline-block h-1.5 w-1.5 rounded-full'
                    style={{
                      background:
                        offlineCount > 0
                          ? 'rgb(239 68 68)'
                          : 'var(--muted)',
                    }}
                  />
                  <span className='text-foreground/80 font-mono'>
                    {offlineCount}
                  </span>
                  <span>{t('Offline')}</span>
                </span>
                {avgAvail != null && (
                  <span className='inline-flex items-baseline gap-1.5'>
                    <span>{t('Avg availability')}</span>
                    <span
                      className='font-mono'
                      style={{ color: rateAccent(avgAvail) }}
                    >
                      {avgAvail.toFixed(1)}%
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <div className='relative w-[200px]'>
              <Search className='text-muted-foreground absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2' />
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder={t('Search groups')}
                className='pl-8'
              />
            </div>
            <Select
              value={sortMode}
              onValueChange={(v) => handleSort(v as SortMode)}
            >
              <SelectTrigger className='w-[140px]'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type='button'
              variant='ghost'
              onClick={admin ? handleRefresh : undefined}
              disabled={!admin || refreshing}
              title={
                admin
                  ? t('Refresh now · next auto refresh in {{c}}', {
                      c: countdownLabel,
                    })
                  : t('Next auto refresh in {{c}}', { c: countdownLabel })
              }
            >
              <RefreshCw
                className={cn(
                  'mr-1.5 h-3.5 w-3.5',
                  refreshing && 'animate-spin'
                )}
              />
              <span className='text-muted-foreground/80 font-mono text-[11px]'>
                {countdownLabel}
              </span>
            </Button>
          </div>
        </div>

        {/* Cards grid */}
        {loading ? (
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 2xl:grid-cols-4'>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className='bg-card rounded-2xl border p-5'>
                <Skeleton className='mb-4 h-5 w-1/2' />
                <Skeleton className='mb-2 h-3 w-3/4' />
                <Skeleton className='mb-4 h-3 w-2/3' />
                <Skeleton className='h-6 w-full' />
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<Activity className='h-8 w-8 opacity-40' />}
            title={t('No monitored groups')}
            desc={t('Configure under System Settings → Group Monitoring')}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<X className='h-8 w-8 opacity-40' />}
            title={t('No groups match "{{kw}}"', { kw: keyword })}
          />
        ) : (
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 2xl:grid-cols-4'>
            {visible.map((g) => (
              <GroupStatusCard
                key={g.group_name}
                group={g}
                onClick={admin ? handleCardClick : undefined}
              />
            ))}
          </div>
        )}

        <GroupDetailPanel
          open={detailVisible}
          group={selectedGroup}
          onClose={() => {
            setDetailVisible(false)
            setSelectedGroup(null)
          }}
        />
      </div>
    </div>
  )
}

function EmptyState({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode
  title: string
  desc?: string
}) {
  return (
    <div className='border-muted-foreground/30 flex flex-col items-center justify-center rounded-2xl border border-dashed py-24 text-center'>
      <div className='text-muted-foreground mb-4'>{icon}</div>
      <div className='text-foreground/80 text-base font-medium'>{title}</div>
      {desc && (
        <div className='text-muted-foreground mt-1.5 text-sm'>{desc}</div>
      )}
    </div>
  )
}
