import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { fetchTickets } from '../api'
import {
  TICKET_STATUS_META,
} from '../lib/ticket-utils'
import { TICKET_STATUS, type Ticket, type TicketStatus } from '../types'
import { CreateTicketDialog } from './create-ticket-dialog'
import { TicketsTable } from './tickets-table'

const PAGE_SIZES = [10, 20, 50, 100]

const TYPE_OPTIONS = [
  { value: 'all', labelKey: 'All types' },
  { value: 'general', labelKey: 'General' },
  { value: 'refund', labelKey: 'Refund' },
  { value: 'invoice', labelKey: 'Invoice' },
]

type Props = {
  admin: boolean
  /** Where to navigate when a row is clicked. */
  detailPathPrefix: string
  title: string
  description: string
  /** Whether to show "New ticket" button. Customer support page hides it. */
  showCreate?: boolean
}

export function TicketListPage({
  admin,
  detailPathPrefix,
  title,
  description,
  showCreate = true,
}: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [statusFilter, setStatusFilter] = useState<'all' | TicketStatus>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)

  const params = useMemo(
    () => ({
      page,
      pageSize,
      status: statusFilter === 'all' ? undefined : statusFilter,
      type: typeFilter === 'all' ? undefined : typeFilter,
      admin,
    }),
    [page, pageSize, statusFilter, typeFilter, admin]
  )

  const refresh = async () => {
    setLoading(true)
    try {
      const data = await fetchTickets(params)
      setTickets(data.items || [])
      setTotal(data.total || 0)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Failed to load tickets'))
      setTickets([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, typeFilter, pageSize])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className='px-4 py-6 sm:px-8'>
      <div className='mx-auto w-full max-w-[1440px] space-y-5'>
        <div className='flex flex-col gap-1'>
          <h1 className='text-xl font-semibold tracking-tight'>{title}</h1>
          <p className='text-muted-foreground text-sm'>{description}</p>
        </div>

        <div className='bg-card flex flex-wrap items-center gap-2 rounded-xl border p-3'>
          {showCreate && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className='mr-1.5 h-3.5 w-3.5' />
              {t('New ticket')}
            </Button>
          )}
          <Button variant='outline' onClick={refresh}>
            <RefreshCw
              className={cn('mr-1.5 h-3.5 w-3.5', loading && 'animate-spin')}
            />
            {t('Refresh')}
          </Button>
          <Select
            value={String(statusFilter)}
            onValueChange={(v) =>
              setStatusFilter(v === 'all' ? 'all' : (Number(v) as TicketStatus))
            }
          >
            <SelectTrigger className='w-[160px]'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>{t('All statuses')}</SelectItem>
              {(
                [
                  TICKET_STATUS.PENDING,
                  TICKET_STATUS.IN_PROGRESS,
                  TICKET_STATUS.RESOLVED,
                  TICKET_STATUS.CLOSED,
                ] as const
              ).map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {t(TICKET_STATUS_META[s].labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className='w-[160px]'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TicketsTable
          tickets={tickets}
          loading={loading}
          showAssignee={admin}
          onRowClick={(ticket) =>
            navigate({ to: `${detailPathPrefix}/${ticket.id}` })
          }
        />

        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='text-muted-foreground text-xs'>
            {t('Total {{n}} records', { n: total })}
          </div>
          <div className='flex items-center gap-2'>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => setPageSize(Number(v))}
            >
              <SelectTrigger className='w-[100px]'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {t('{{n}} / page', { n: size })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('Previous')}
            </Button>
            <span className='text-muted-foreground text-xs'>
              {t('Page {{p}} / {{total}}', { p: page, total: totalPages })}
            </span>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              {t('Next')}
            </Button>
          </div>
        </div>
      </div>

      <CreateTicketDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={refresh}
      />
    </div>
  )
}
