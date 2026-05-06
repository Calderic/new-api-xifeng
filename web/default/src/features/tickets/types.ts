// ----------------------------------------------------------------------------
// Ticket types — mirror backend dto.Ticket / dto.TicketMessage shapes.
// ----------------------------------------------------------------------------

export const TICKET_STATUS = {
  PENDING: 1,
  IN_PROGRESS: 2,
  RESOLVED: 3,
  CLOSED: 4,
} as const

export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS]

export const TICKET_PRIORITY = {
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
} as const

export type TicketPriority = (typeof TICKET_PRIORITY)[keyof typeof TICKET_PRIORITY]

export type TicketType = 'general' | 'refund' | 'invoice'

export type TicketAttachment = {
  id: number
  file_name: string
  mime_type: string
  size: number
}

export type TicketMessage = {
  id: number
  ticket_id: number
  user_id: number
  username?: string
  role?: number
  content: string
  created_time: number
  attachments?: TicketAttachment[]
}

export type Ticket = {
  id: number
  subject: string
  type: TicketType
  status: TicketStatus
  priority: TicketPriority
  user_id: number
  username?: string
  assignee_id?: number
  assignee_username?: string
  created_time: number
  updated_time: number
}

export const REFUND_STATUS = {
  PENDING: 1,
  REFUNDED: 2,
  REJECTED: 3,
} as const

export type RefundStatus = (typeof REFUND_STATUS)[keyof typeof REFUND_STATUS]

export type RefundPayeeType = 'alipay' | 'wechat' | 'bank' | 'other'

export type TicketRefund = {
  id: number
  ticket_id: number
  user_id: number
  refund_quota: number
  frozen_quota: number
  user_quota_snapshot: number
  payee_type: RefundPayeeType
  payee_name: string
  payee_account: string
  payee_bank: string
  contact: string
  reason: string
  refund_status: RefundStatus
  processed_time: number
  created_time: number
}

export type CreateRefundTicketPayload = {
  subject: string
  priority: TicketPriority
  refund_quota: number
  payee_type: RefundPayeeType
  payee_name: string
  payee_account: string
  payee_bank?: string
  contact: string
  reason: string
}

export type RefundQuotaMode = 'write_off' | 'subtract' | 'override'

export type UpdateRefundStatusPayload = {
  refund_status: RefundStatus
  quota_mode?: RefundQuotaMode
  actual_refund_quota?: number
}

export type TicketDetail = {
  ticket: Ticket
  messages: TicketMessage[]
  invoice?: unknown
  invoice_orders?: unknown[]
  refund?: TicketRefund | null
}

export type TicketListResponse = {
  items: Ticket[]
  total: number
}

export type CreateTicketPayload = {
  subject: string
  type: TicketType
  priority: TicketPriority
  content: string
  attachment_ids?: number[]
}
