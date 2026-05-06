import { createFileRoute, useParams } from '@tanstack/react-router'
import { TicketDetailPage } from '@/features/tickets/components/ticket-detail-page'

function UserTicketDetailRoute() {
  const { id } = useParams({ from: '/_authenticated/tickets/$id' })
  const ticketId = Number(id)
  return (
    <TicketDetailPage
      ticketId={Number.isFinite(ticketId) ? ticketId : 0}
      admin={false}
      backTo='/tickets'
    />
  )
}

export const Route = createFileRoute('/_authenticated/tickets/$id')({
  component: UserTicketDetailRoute,
})
