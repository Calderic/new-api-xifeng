import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export const RISK_METRIC_DEFINITIONS: Array<{
  label: string
  value: string
  scopes: Array<'token' | 'user' | 'ip'>
}> = [
  { label: 'Distinct IPs (10m)', value: 'distinct_ip_10m', scopes: ['token', 'user'] },
  { label: 'Distinct IPs (1h)', value: 'distinct_ip_1h', scopes: ['token', 'user'] },
  { label: 'Distinct UAs (10m)', value: 'distinct_ua_10m', scopes: ['token'] },
  { label: 'Tokens per IP (10m)', value: 'tokens_per_ip_10m', scopes: ['token'] },
  { label: 'Requests (1m)', value: 'request_count_1m', scopes: ['token', 'user'] },
  { label: 'Requests (10m)', value: 'request_count_10m', scopes: ['token', 'user'] },
  { label: 'In-flight (now)', value: 'inflight_now', scopes: ['token', 'user'] },
  { label: 'Rule hits (24h)', value: 'rule_hit_count_24h', scopes: ['token', 'user'] },
  { label: 'Risk score', value: 'risk_score', scopes: ['token', 'user'] },
]

export const RISK_OP_OPTIONS = ['>=', '>', '<=', '<', '==', '!='] as const

export function metricOptionsForScope(scope: 'token' | 'user' | 'ip') {
  return RISK_METRIC_DEFINITIONS.filter((m) => m.scopes.includes(scope))
}

export function metricLabel(value: string): string {
  return RISK_METRIC_DEFINITIONS.find((m) => m.value === value)?.label || value
}

export function formatRiskTime(unixSec: number | undefined): string {
  if (!unixSec) return '—'
  return new Date(unixSec * 1000).toLocaleString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function StatusBadge({
  status,
}: {
  status: 'normal' | 'observe' | 'blocked' | string
}) {
  const { t } = useTranslation()
  switch (status) {
    case 'blocked':
      return (
        <Badge
          variant='outline'
          className='border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400'
        >
          {t('Blocked')}
        </Badge>
      )
    case 'observe':
      return (
        <Badge
          variant='outline'
          className='border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
        >
          {t('Observing')}
        </Badge>
      )
    default:
      return (
        <Badge
          variant='outline'
          className='border-muted-foreground/40 bg-muted/40 text-muted-foreground'
        >
          {t('Normal')}
        </Badge>
      )
  }
}

export function DecisionBadge({
  decision,
}: {
  decision: 'allow' | 'observe' | 'block' | string
}) {
  const { t } = useTranslation()
  switch (decision) {
    case 'block':
      return (
        <Badge
          variant='outline'
          className='border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400'
        >
          {t('Block')}
        </Badge>
      )
    case 'observe':
      return (
        <Badge
          variant='outline'
          className='border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
        >
          {t('Observe')}
        </Badge>
      )
    default:
      return (
        <Badge
          variant='outline'
          className='border-muted-foreground/40 bg-muted/40 text-muted-foreground'
        >
          {t('Allow')}
        </Badge>
      )
  }
}

export function OverviewCard({
  title,
  value,
  hint,
  className,
}: {
  title: string
  value: React.ReactNode
  hint?: string
  className?: string
}) {
  return (
    <div className={cn('bg-card rounded-xl border p-4', className)}>
      <div className='text-muted-foreground text-xs'>{title}</div>
      <div className='mt-1 text-2xl font-semibold tracking-tight'>{value}</div>
      {hint && <div className='text-muted-foreground mt-1 text-xs'>{hint}</div>}
    </div>
  )
}
