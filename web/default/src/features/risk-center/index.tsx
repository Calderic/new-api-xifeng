import { useTranslation } from 'react-i18next'
import { ExternalLink, ShieldAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

/**
 * Risk Center is intentionally not yet migrated to the default frontend.
 *
 * The classic implementation is a 4500+ line single page covering content
 * moderation rules / queue / events, enforcement (config, counters, incidents,
 * test email), risk subjects, IP detection, groups, and overview dashboards
 * — about 23 distinct backend endpoints. Splitting it into Radix/Tailwind
 * components is a project of its own.
 *
 * In the meantime this stub keeps a stable route in the new frontend and
 * deep-links the user to the classic UI where the full feature set lives.
 */
export function RiskCenter() {
  const { t } = useTranslation()

  return (
    <div className='px-4 py-12 sm:px-8'>
      <div className='mx-auto w-full max-w-3xl space-y-6'>
        <div className='flex items-center gap-3'>
          <span className='bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl'>
            <ShieldAlert className='h-5 w-5' />
          </span>
          <div>
            <h1 className='text-xl font-semibold tracking-tight'>
              {t('Risk Center')}
            </h1>
            <p className='text-muted-foreground text-sm'>
              {t('Moderation, enforcement, and incident review')}
            </p>
          </div>
        </div>

        <Alert>
          <ShieldAlert className='h-4 w-4' />
          <AlertTitle>{t('Available in the classic frontend')}</AlertTitle>
          <AlertDescription className='space-y-3 pt-1'>
            <p>
              {t(
                'The Risk Center is not yet migrated to the new frontend. The classic frontend has the full set of moderation rules, enforcement settings, incident lists, IP detection, and queue stats.'
              )}
            </p>
            <p className='text-muted-foreground text-xs'>
              {t(
                'Switching themes does not log you out — your session is preserved.'
              )}
            </p>
            <div className='flex flex-wrap gap-2 pt-2'>
              <Button asChild>
                <a href='/console/risk' rel='noreferrer'>
                  {t('Open in classic frontend')}
                  <ExternalLink className='ml-1.5 h-3.5 w-3.5' />
                </a>
              </Button>
            </div>
          </AlertDescription>
        </Alert>

        <div className='bg-card text-muted-foreground space-y-2 rounded-2xl border p-5 text-xs'>
          <div className='text-foreground text-sm font-semibold'>
            {t('What lives in the Risk Center?')}
          </div>
          <ul className='ml-4 list-disc space-y-1'>
            <li>{t('Content moderation rules and queue')}</li>
            <li>{t('Moderation incidents (with debug mode)')}</li>
            <li>{t('Enforcement config (auto-disable, alert webhooks)')}</li>
            <li>{t('Enforcement incidents and counters')}</li>
            <li>{t('Risk subjects (users / IPs / tokens under watch)')}</li>
            <li>{t('IP detection and risk overview dashboards')}</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
