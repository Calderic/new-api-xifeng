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
import { createTicket } from '../api'
import { useTicketAttachments } from '../hooks/use-ticket-attachments'
import { TICKET_PRIORITY, type TicketPriority } from '../types'
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

export function CreateTicketDialog({ open, onOpenChange, onCreated }: Props) {
  const { t } = useTranslation()
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [priority, setPriority] = useState<TicketPriority>(
    TICKET_PRIORITY.NORMAL
  )
  const [submitting, setSubmitting] = useState(false)
  const attachmentState = useTicketAttachments()

  useEffect(() => {
    if (!open) {
      setSubject('')
      setContent('')
      setPriority(TICKET_PRIORITY.NORMAL)
      // Drop any uploaded-but-unsubmitted attachments to free server storage.
      attachmentState.discardAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const canSubmit = subject.trim().length > 0 && content.trim().length > 0

  const handleSubmit = async () => {
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
      onOpenChange(false)
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t('Failed to create ticket')
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('New ticket')}</DialogTitle>
          <DialogDescription>
            {t(
              'Submit a question or request. Refund and invoice flows are still on the classic frontend for now.'
            )}
          </DialogDescription>
        </DialogHeader>
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
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t('Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {t('Submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
