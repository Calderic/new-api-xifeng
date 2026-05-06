import { api } from '@/lib/api'
import type {
  CreateTicketPayload,
  Ticket,
  TicketDetail,
  TicketListResponse,
  TicketStatus,
} from './types'

type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
}

export type TicketListParams = {
  page: number
  pageSize: number
  status?: TicketStatus | ''
  type?: string
  admin?: boolean
}

function buildQuery(params: TicketListParams): string {
  const search = new URLSearchParams()
  search.set('p', String(params.page))
  search.set('page_size', String(params.pageSize))
  if (params.status !== undefined && params.status !== '') {
    search.set('status', String(params.status))
  }
  if (params.type) search.set('type', params.type)
  return search.toString()
}

export async function fetchTickets(
  params: TicketListParams
): Promise<TicketListResponse> {
  const base = params.admin ? '/api/ticket/admin' : '/api/ticket/self'
  const res = await api.get<ApiResponse<TicketListResponse>>(
    `${base}?${buildQuery(params)}`
  )
  if (!res.data.success) {
    throw new Error(res.data.message || 'Failed to load tickets')
  }
  return res.data.data
}

export async function fetchTicketDetail(
  ticketId: number,
  admin: boolean
): Promise<TicketDetail> {
  const path = admin
    ? `/api/ticket/admin/${ticketId}`
    : `/api/ticket/self/${ticketId}`
  const res = await api.get<ApiResponse<TicketDetail>>(path)
  if (!res.data.success) {
    throw new Error(res.data.message || 'Failed to load ticket')
  }
  return res.data.data
}

export async function postTicketReply(
  ticketId: number,
  content: string,
  admin: boolean
): Promise<boolean> {
  const path = admin
    ? `/api/ticket/admin/${ticketId}/message`
    : `/api/ticket/self/${ticketId}/message`
  const res = await api.post<ApiResponse<unknown>>(path, {
    content,
    attachment_ids: [],
  })
  if (!res.data.success) {
    throw new Error(res.data.message || 'Failed to send reply')
  }
  return true
}

export async function closeTicket(
  ticketId: number,
  admin: boolean
): Promise<boolean> {
  const path = admin
    ? `/api/ticket/admin/${ticketId}/status`
    : `/api/ticket/self/${ticketId}/close`
  const res = admin
    ? await api.put<ApiResponse<unknown>>(path, { status: 4 })
    : await api.put<ApiResponse<unknown>>(path)
  if (!res.data.success) {
    throw new Error(res.data.message || 'Failed to close ticket')
  }
  return true
}

export async function adminUpdateTicketStatus(
  ticketId: number,
  status: TicketStatus
): Promise<boolean> {
  const res = await api.put<ApiResponse<unknown>>(
    `/api/ticket/admin/${ticketId}/status`,
    { status }
  )
  if (!res.data.success) {
    throw new Error(res.data.message || 'Failed to update ticket status')
  }
  return true
}

export async function createTicket(
  payload: CreateTicketPayload
): Promise<Ticket | null> {
  const res = await api.post<ApiResponse<Ticket>>('/api/ticket/', payload)
  if (!res.data.success) {
    throw new Error(res.data.message || 'Failed to create ticket')
  }
  return res.data.data ?? null
}
