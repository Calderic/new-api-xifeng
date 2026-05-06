import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  displayAmountToQuota,
  formatQuotaWithCurrency,
} from '@/lib/currency'
import { api } from '@/lib/api'
import { createRefundTicket, createTicket } from '../api'
import { useTicketAttachments } from '../hooks/use-ticket-attachments'
import {
  TICKET_PRIORITY,
  type RefundPayeeType,
  type TicketPriority,
  type TicketType,
} from '../types'
import { AttachmentPicker } from './attachment-picker'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

const PRIORITY_OPTIONS: Array<{ value: TicketPriority; labelKey: string }> = [
  { value: TICKET_PRIORITY.HIGH, labelKey: 'High priority' },
  { value: TICKET_PRIORITY.NORMAL, labelKey: 'Normal priority' },
  { value: TICKET_PRIORITY.LOW, labelKey: 'Low priority' },
]

const PAYEE_TYPE_OPTIONS: Array<{ value: RefundPayeeType; labelKey: string }> = [
  { value: 'alipay', labelKey: 'Alipay' },
  { value: 'wechat', labelKey: 'WeChat' },
  { value: 'bank', labelKey: 'Bank card' },
  { value: 'other', labelKey: 'Other' },
]

type TabValue = Exclude<TicketType, 'invoice'>

// ============================================================================
// General ticket form
// ============================================================================

function GeneralTicketForm({
  open,
  submitting,
  onCreated,
  onClose,
  setSubmitting,
}: {
  open: boolean
  submitting: boolean
  onCreated: () => void
  onClose: () => void
  setSubmitting: (v: boolean) => void
}) {
  const { t } = useTranslation()
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [priority, setPriority] = useState<TicketPriority>(
    TICKET_PRIORITY.NORMAL
  )
  const attachmentState = useTicketAttachments()

  useEffect(() => {
    if (!open) {
      setSubject('')
      setContent('')
      setPriority(TICKET_PRIORITY.NORMAL)
      attachmentState.discardAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const canSubmit = subject.trim().length > 0 && content.trim().length > 0

  const submit = async () => {
    if (!canSubmit || submitting || attachmentState.uploading) return
    setSubmitting(true)
    try {
      await createTicket({
        type: 'general',
        subject: subject.trim(),
        priority,
        content: content.trim(),
        attachment_ids: attachmentState.attachments.map((a) => a.id),
      })
      toast.success(t('Ticket created'))
      attachmentState.reset()
      onCreated()
      onClose()
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t('Failed to create ticket')
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className='space-y-4'>
        <div className='space-y-1.5'>
          <Label>{t('Subject')}</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t('A short summary')}
            maxLength={200}
          />
        </div>
        <div className='space-y-1.5'>
          <Label>{t('Priority')}</Label>
          <Select
            value={String(priority)}
            onValueChange={(v) => setPriority(Number(v) as TicketPriority)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {t(opt.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div
          className='space-y-1.5'
          onPasteCapture={(e) => attachmentState.handlePaste(e)}
        >
          <Label>{t('Description')}</Label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            maxLength={5000}
            placeholder={t('Describe the issue in detail')}
          />
          <AttachmentPicker state={attachmentState} disabled={submitting} />
        </div>
      </div>
      <DialogFooter>
        <Button variant='outline' onClick={onClose} disabled={submitting}>
          {t('Cancel')}
        </Button>
        <Button onClick={submit} disabled={!canSubmit || submitting}>
          {t('Submit')}
        </Button>
      </DialogFooter>
    </>
  )
}

// ============================================================================
// Refund ticket form
// ============================================================================

function RefundTicketForm({
  open,
  submitting,
  setSubmitting,
  onCreated,
  onClose,
}: {
  open: boolean
  submitting: boolean
  setSubmitting: (v: boolean) => void
  onCreated: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [subject, setSubject] = useState('')
  const [priority, setPriority] = useState<TicketPriority>(
    TICKET_PRIORITY.NORMAL
  )
  const [refundAmountStr, setRefundAmountStr] = useState('')
  const [payeeType, setPayeeType] = useState<RefundPayeeType>('alipay')
  const [payeeName, setPayeeName] = useState('')
  const [payeeAccount, setPayeeAccount] = useState('')
  const [payeeBank, setPayeeBank] = useState('')
  const [contact, setContact] = useState('')
  const [reason, setReason] = useState('')
  const [userQuota, setUserQuota] = useState<number | null>(null)

  useEffect(() => {
    if (!open) {
      setSubject('')
      setPriority(TICKET_PRIORITY.NORMAL)
      setRefundAmountStr('')
      setPayeeType('alipay')
      setPayeeName('')
      setPayeeAccount('')
      setPayeeBank('')
      setContact('')
      setReason('')
      setUserQuota(null)
      return
    }
    // Load user's available quota for preview only.
    api
      .get('/api/user/self')
      .then((res) => {
        if (res.data?.success) {
          setUserQuota(Number(res.data?.data?.quota || 0))
        }
      })
      .catch(() => {
        /* informational only */
      })
  }, [open])

  const refundAmountNum = Number(refundAmountStr)
  const refundQuota = Number.isFinite(refundAmountNum)
    ? displayAmountToQuota(refundAmountNum)
    : 0
  const exceedsQuota = userQuota != null && refundQuota > userQuota
  const amountValid =
    Number.isFinite(refundAmountNum) && refundAmountNum > 0 && !exceedsQuota
  const requireBank = payeeType === 'bank'

  const canSubmit =
    subject.trim().length > 0 &&
    payeeName.trim().length > 0 &&
    payeeAccount.trim().length > 0 &&
    contact.trim().length > 0 &&
    (!requireBank || payeeBank.trim().length > 0) &&
    amountValid

  const submit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    try {
      await createRefundTicket({
        subject: subject.trim(),
        priority,
        refund_quota: refundQuota,
        payee_type: payeeType,
        payee_name: payeeName.trim(),
        payee_account: payeeAccount.trim(),
        payee_bank: payeeBank.trim() || undefined,
        contact: contact.trim(),
        reason: reason.trim() || subject.trim(),
      })
      toast.success(t('Refund ticket created; quota frozen'))
      try {
        window.dispatchEvent(new CustomEvent('user-quota-changed'))
      } catch {
        /* noop */
      }
      onCreated()
      onClose()
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t('Failed to create ticket')
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className='space-y-4'>
        <div className='space-y-1.5'>
          <Label>{t('Subject')}</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t('A short summary')}
            maxLength={200}
          />
        </div>
        <div className='grid gap-3 sm:grid-cols-2'>
          <div className='space-y-1.5'>
            <Label>{t('Priority')}</Label>
            <Select
              value={String(priority)}
              onValueChange={(v) => setPriority(Number(v) as TicketPriority)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {t(opt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1.5'>
            <Label>{t('Refund amount')}</Label>
            <Input
              type='number'
              min={0}
              step='0.01'
              value={refundAmountStr}
              onChange={(e) => setRefundAmountStr(e.target.value)}
              placeholder={t('Amount in displayed currency')}
            />
            <p className='text-muted-foreground text-xs'>
              {userQuota != null
                ? t('Available: {{amount}}', {
                    amount: formatQuotaWithCurrency(userQuota),
                  })
                : t('Loading available quota…')}
              {amountValid && refundQuota > 0 && (
                <>
                  {' '}
                  ·{' '}
                  {t('Will freeze: {{amount}}', {
                    amount: formatQuotaWithCurrency(refundQuota),
                  })}
                </>
              )}
            </p>
            {exceedsQuota && (
              <p className='text-destructive text-xs'>
                {t('Refund amount exceeds available quota')}
              </p>
            )}
          </div>
        </div>
        <div className='grid gap-3 sm:grid-cols-2'>
          <div className='space-y-1.5'>
            <Label>{t('Payee type')}</Label>
            <Select
              value={payeeType}
              onValueChange={(v) => setPayeeType(v as RefundPayeeType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYEE_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1.5'>
            <Label>{t('Payee name')}</Label>
            <Input
              value={payeeName}
              onChange={(e) => setPayeeName(e.target.value)}
              placeholder={t('Name on the receiving account')}
              maxLength={128}
            />
          </div>
        </div>
        <div className='grid gap-3 sm:grid-cols-2'>
          <div className='space-y-1.5'>
            <Label>{t('Payee account')}</Label>
            <Input
              value={payeeAccount}
              onChange={(e) => setPayeeAccount(e.target.value)}
              placeholder={t('Account / phone / card number')}
              maxLength={128}
            />
          </div>
          <div className='space-y-1.5'>
            <Label>
              {t('Bank name')}
              {requireBank && <span className='text-destructive'> *</span>}
            </Label>
            <Input
              value={payeeBank}
              onChange={(e) => setPayeeBank(e.target.value)}
              placeholder={t('Required for bank transfer')}
              maxLength={255}
            />
          </div>
        </div>
        <div className='space-y-1.5'>
          <Label>{t('Contact')}</Label>
          <Input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder={t('Phone or email for follow-up')}
            maxLength={128}
          />
        </div>
        <div className='space-y-1.5'>
          <Label>{t('Refund reason')}</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder={t('Optional: explain why a refund is needed')}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant='outline' onClick={onClose} disabled={submitting}>
          {t('Cancel')}
        </Button>
        <Button onClick={submit} disabled={!canSubmit || submitting}>
          {t('Submit refund request')}
        </Button>
      </DialogFooter>
    </>
  )
}

// ============================================================================
// Wrapper dialog with tabs
// ============================================================================

export function CreateTicketDialog({ open, onOpenChange, onCreated }: Props) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<TabValue>('general')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) setTab('general')
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{t('New ticket')}</DialogTitle>
          <DialogDescription>
            {t('Submit a question, request, or refund. Invoice requests live on the topup history page.')}
          </DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
          <TabsList className='grid w-full grid-cols-2'>
            <TabsTrigger value='general'>{t('General')}</TabsTrigger>
            <TabsTrigger value='refund'>{t('Refund')}</TabsTrigger>
          </TabsList>
          <TabsContent value='general' className='space-y-4'>
            <GeneralTicketForm
              open={open && tab === 'general'}
              submitting={submitting}
              setSubmitting={setSubmitting}
              onCreated={onCreated}
              onClose={() => onOpenChange(false)}
            />
          </TabsContent>
          <TabsContent value='refund' className='space-y-4'>
            <RefundTicketForm
              open={open && tab === 'refund'}
              submitting={submitting}
              setSubmitting={setSubmitting}
              onCreated={onCreated}
              onClose={() => onOpenChange(false)}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
