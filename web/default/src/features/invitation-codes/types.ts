export const INVITATION_CODE_STATUS = {
  ENABLED: 1,
  DISABLED: 2,
} as const

export type InvitationCodeStatus =
  (typeof INVITATION_CODE_STATUS)[keyof typeof INVITATION_CODE_STATUS]

export type InvitationCode = {
  id: number
  name: string
  code: string
  status: InvitationCodeStatus
  max_uses: number
  used_count: number
  owner_user_id: number
  created_by: number
  is_admin: boolean
  created_time: number
  expired_time: number
}

export type InvitationCodeUsage = {
  id: number
  user_id: number
  username?: string
  used_time: number
}

export type InvitationCodeListResponse = {
  items: InvitationCode[]
  total: number
  page: number
  page_size?: number
}

export type InvitationCodeSavePayload = {
  id?: number
  name: string
  count?: number
  max_uses: number
  owner_user_id: number
  expired_time: number // unix seconds, 0 = never
  status?: InvitationCodeStatus
}
