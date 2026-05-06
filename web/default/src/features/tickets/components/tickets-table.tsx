import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  formatTicketTimestamp,
  TICKET_PRIORITY_META,
  TICKET_STATUS_META,
  TICKET_TYPE_LABELS,
} from '../lib/ticket-utils'
import type { Ticket, TicketPriority, TicketStatus } from '../types'

type Props = {
  tickets: Ticket[]
  loading: boolean
  showAssignee?: boolean
  onRowClick: (ticket: Ticket) => void
}

export function TicketsTable({
  tickets,
  loading,
  showAssignee = false,
  onRowClick,
}: Props) {
  const { t } = useTranslation()
  const colCount = showAssignee ? 8 : 7

  return (
    <div className='bg-card overflow-x-auto rounded-xl border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-16'>ID</TableHead>
            <TableHead>{t('Subject')}</TableHead>
            <TableHead className='w-24'>{t('Type')}</TableHead>
            <TableHead className='w-28'>{t('Status')}</TableHead>
            <TableHead className='w-28'>{t('Priority')}</TableHead>
            {showAssignee && (
              <TableHead className='w-32'>{t('User')}</TableHead>
            )}
            <TableHead className='w-40'>{t('Created')}</TableHead>
            <TableHead className='w-40'>{t('Updated')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && tickets.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: colCount }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className='h-4 w-full' />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : tickets.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={colCount}
                className='text-muted-foreground py-12 text-center text-sm'
              >
                {t('No tickets')}
              </TableCell>
            </TableRow>
          ) : (
            tickets.map((ticket) => {
              const statusMeta =
                TICKET_STATUS_META[ticket.status as TicketStatus] ?? null
              const priorityMeta =
                TICKET_PRIORITY_META[
                  ticket.priority as TicketPriority
                ] ?? TICKET_PRIORITY_META[2]
              return (
                <TableRow
                  key={ticket.id}
                  onClick={() => onRowClick(ticket)}
                  className='hover:bg-accent/40 cursor-pointer'
                >
                  <TableCell className='font-mono'>{ticket.id}</TableCell>
                  <TableCell className='max-w-[280px] truncate' title={ticket.subject}>
                    {ticket.subject}
                  </TableCell>
                  <TableCell>
                    <Badge variant='outline' className='font-normal'>
                      {t(TICKET_TYPE_LABELS[ticket.type] || ticket.type)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {statusMeta ? (
                      <Badge
                        variant='outline'
                        className={cn('font-normal', statusMeta.badgeClass)}
                      >
                        {t(statusMeta.labelKey)}
                      </Badge>
                    ) : (
                      <span className='text-muted-foreground text-xs'>—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant='outline'
                      className={cn('font-normal', priorityMeta.className)}
                    >
                      {t(priorityMeta.labelKey)}
                    </Badge>
                  </TableCell>
                  {showAssignee && (
                    <TableCell className='font-mono text-xs'>
                      {ticket.username || `#${ticket.user_id}`}
                    </TableCell>
                  )}
                  <TableCell className='text-muted-foreground text-xs'>
                    {formatTicketTimestamp(ticket.created_time)}
                  </TableCell>
                  <TableCell className='text-muted-foreground text-xs'>
                    {formatTicketTimestamp(ticket.updated_time)}
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
