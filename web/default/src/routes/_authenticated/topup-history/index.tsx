import { createFileRoute } from '@tanstack/react-router'
import { TopupHistory } from '@/features/topup-history'

export const Route = createFileRoute('/_authenticated/topup-history/')({
  component: TopupHistory,
})
