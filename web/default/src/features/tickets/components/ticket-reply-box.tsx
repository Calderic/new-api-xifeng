import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  disabled?: boolean
  loading?: boolean
  onSubmit: (content: string) => Promise<boolean | void>
  placeholder?: string
  submitLabel?: string
}

/**
 * Simplified reply box: text-only.
 * Attachment upload (clipboard paste, file picker) is intentionally omitted in
 * the default-frontend port; users requiring attachments should use the
 * classic frontend until that path is migrated in a follow-up.
 */
export function TicketReplyBox({
  disabled = false,
  loading = false,
  onSubmit,
  placeholder,
  submitLabel,
}: Props) {
  const { t } = useTranslation()
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canReply = !disabled && content.trim().length > 0

  const handleSubmit = async () => {
    if (!canReply || loading || submitting) return
    setSubmitting(true)
    try {
      const ok = await onSubmit(content.trim())
      if (ok) setContent('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='bg-card rounded-2xl border p-4 sm:p-5'>
      <div className='mb-3 space-y-1'>
        <h4 className='text-base font-semibold'>{t('Reply')}</h4>
        {disabled && (
          <p className='text-muted-foreground text-xs'>
            {t(
              'Ticket is closed. To continue, ask an admin to reopen it.'
            )}
          </p>
        )}
      </div>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={5}
        maxLength={5000}
        disabled={disabled || loading}
        placeholder={
          placeholder ?? t('Type your reply (attachments unsupported on this frontend)')
        }
      />
      <div className='mt-3 flex justify-end'>
        <Button
          onClick={handleSubmit}
          disabled={disabled || !canReply || submitting || loading}
        >
          <Send className='mr-1.5 h-3.5 w-3.5' />
          {submitLabel ?? t('Send reply')}
        </Button>
      </div>
    </div>
  )
}
