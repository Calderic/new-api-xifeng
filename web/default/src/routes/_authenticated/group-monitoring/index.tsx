import { createFileRoute } from '@tanstack/react-router'
import { GroupMonitoring } from '@/features/group-monitoring'

export const Route = createFileRoute('/_authenticated/group-monitoring/')({
  component: GroupMonitoring,
})
