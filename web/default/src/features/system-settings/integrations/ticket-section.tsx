import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type TicketAssignStrategy = 'round_robin' | 'least_load' | 'random'

type TicketAssignRule = {
  strategy: TicketAssignStrategy
  users: number[]
}

type TicketAssignConfig = {
  enabled: boolean
  fallback: 'none' | 'round_robin' | 'least_load' | 'random'
  rules: {
    general: TicketAssignRule
    refund: TicketAssignRule
    invoice: TicketAssignRule
  }
}

type TicketTypeKey = keyof TicketAssignConfig['rules']

type StaffUser = {
  id: number
  username: string
  display_name?: string
  role?: number
}

type Props = {
  defaultValues: {
    TicketNotifyEnabled: boolean
    TicketAdminEmail: string
    TicketAttachmentEnabled: boolean
    TicketAttachmentMaxSize: string
    TicketAttachmentMaxCount: string
    TicketAttachmentAllowedExts: string
    TicketAttachmentLocalPath: string
    TicketAttachmentSignedURLTTL: string
    TicketAssignConfig: string
  }
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const DEFAULT_ASSIGN_CONFIG: TicketAssignConfig = {
  enabled: false,
  fallback: 'none',
  rules: {
    general: { strategy: 'round_robin', users: [] },
    refund: { strategy: 'round_robin', users: [] },
    invoice: { strategy: 'round_robin', users: [] },
  },
}

function parseAssignConfig(raw: string): TicketAssignConfig {
  if (!raw) return { ...DEFAULT_ASSIGN_CONFIG }
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_ASSIGN_CONFIG }
    }
    return {
      enabled: Boolean(parsed.enabled),
      fallback:
        (['none', 'round_robin', 'least_load', 'random'] as const).find(
          (v) => v === parsed.fallback
        ) || 'none',
      rules: {
        general: {
          strategy: parsed.rules?.general?.strategy || 'round_robin',
          users: Array.isArray(parsed.rules?.general?.users)
            ? parsed.rules.general.users.map(Number).filter(Number.isFinite)
            : [],
        },
        refund: {
          strategy: parsed.rules?.refund?.strategy || 'round_robin',
          users: Array.isArray(parsed.rules?.refund?.users)
            ? parsed.rules.refund.users.map(Number).filter(Number.isFinite)
            : [],
        },
        invoice: {
          strategy: parsed.rules?.invoice?.strategy || 'round_robin',
          users: Array.isArray(parsed.rules?.invoice?.users)
            ? parsed.rules.invoice.users.map(Number).filter(Number.isFinite)
            : [],
        },
      },
    }
  } catch {
    return { ...DEFAULT_ASSIGN_CONFIG }
  }
}

const TICKET_TYPES: Array<{
  value: TicketTypeKey
  labelKey: string
  descKey: string
}> = [
  {
    value: 'general',
    labelKey: 'General',
    descKey: 'Default type for most questions and bug reports',
  },
  {
    value: 'refund',
    labelKey: 'Refund',
    descKey: 'Involves money flows; assign to staff familiar with billing',
  },
  {
    value: 'invoice',
    labelKey: 'Invoice',
    descKey: 'Invoice issuance; assign to staff familiar with VAT details',
  },
]

const STRATEGY_OPTIONS: Array<{ value: TicketAssignStrategy; labelKey: string; hintKey: string }> = [
  {
    value: 'round_robin',
    labelKey: 'Round robin',
    hintKey: 'Distribute in fixed order. Best for balanced ticket volume.',
  },
  {
    value: 'least_load',
    labelKey: 'Least load',
    hintKey: 'Pick the staff member with the fewest pending tickets.',
  },
  {
    value: 'random',
    labelKey: 'Random',
    hintKey: 'Pick a random staff member from the pool.',
  },
]

const FALLBACK_OPTIONS = [
  { value: 'none', labelKey: 'None (leave unassigned)' },
  { value: 'round_robin', labelKey: 'Round robin (all staff)' },
  { value: 'least_load', labelKey: 'Least load (all staff)' },
  { value: 'random', labelKey: 'Random (all staff)' },
] as const

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function TicketSettingsSection({ defaultValues }: Props) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const [notifyEnabled, setNotifyEnabled] = useState(
    defaultValues.TicketNotifyEnabled
  )
  const [adminEmail, setAdminEmail] = useState(defaultValues.TicketAdminEmail)
  const [attachmentEnabled, setAttachmentEnabled] = useState(
    defaultValues.TicketAttachmentEnabled
  )
  const [maxSize, setMaxSize] = useState(defaultValues.TicketAttachmentMaxSize)
  const [maxCount, setMaxCount] = useState(
    defaultValues.TicketAttachmentMaxCount
  )
  const [allowedExts, setAllowedExts] = useState(
    defaultValues.TicketAttachmentAllowedExts
  )
  const [localPath, setLocalPath] = useState(
    defaultValues.TicketAttachmentLocalPath
  )
  const [signedTTL, setSignedTTL] = useState(
    defaultValues.TicketAttachmentSignedURLTTL
  )

  const baseline = useRef(defaultValues)
  useEffect(() => {
    baseline.current = defaultValues
    setNotifyEnabled(defaultValues.TicketNotifyEnabled)
    setAdminEmail(defaultValues.TicketAdminEmail)
    setAttachmentEnabled(defaultValues.TicketAttachmentEnabled)
    setMaxSize(defaultValues.TicketAttachmentMaxSize)
    setMaxCount(defaultValues.TicketAttachmentMaxCount)
    setAllowedExts(defaultValues.TicketAttachmentAllowedExts)
    setLocalPath(defaultValues.TicketAttachmentLocalPath)
    setSignedTTL(defaultValues.TicketAttachmentSignedURLTTL)
  }, [defaultValues])

  const [assignConfig, setAssignConfig] = useState<TicketAssignConfig>(() =>
    parseAssignConfig(defaultValues.TicketAssignConfig)
  )
  useEffect(() => {
    setAssignConfig(parseAssignConfig(defaultValues.TicketAssignConfig))
  }, [defaultValues.TicketAssignConfig])

  const [staffList, setStaffList] = useState<StaffUser[]>([])
  const [staffLoaded, setStaffLoaded] = useState(false)

  useEffect(() => {
    let active = true
    api
      .get('/api/ticket/admin/staff')
      .then((res) => {
        if (!active) return
        if (res.data?.success) {
          setStaffList(res.data.data || [])
        }
      })
      .catch(() => {
        /* ignore: unauthorized for non-admins */
      })
      .finally(() => {
        if (active) setStaffLoaded(true)
      })
    return () => {
      active = false
    }
  }, [])

  const staffIndex = useMemo(() => {
    const map = new Map<number, StaffUser>()
    for (const u of staffList) map.set(u.id, u)
    return map
  }, [staffList])

  // ----- Save handlers ---------------------------------------------------
  const saveBasic = async () => {
    const updates: Array<{ key: string; value: string | boolean | number }> = []
    if (notifyEnabled !== baseline.current.TicketNotifyEnabled) {
      updates.push({ key: 'TicketNotifyEnabled', value: notifyEnabled })
    }
    if (adminEmail !== baseline.current.TicketAdminEmail) {
      updates.push({ key: 'TicketAdminEmail', value: adminEmail })
    }
    if (attachmentEnabled !== baseline.current.TicketAttachmentEnabled) {
      updates.push({
        key: 'TicketAttachmentEnabled',
        value: attachmentEnabled,
      })
    }
    if (maxSize !== baseline.current.TicketAttachmentMaxSize) {
      updates.push({ key: 'TicketAttachmentMaxSize', value: maxSize })
    }
    if (maxCount !== baseline.current.TicketAttachmentMaxCount) {
      updates.push({ key: 'TicketAttachmentMaxCount', value: maxCount })
    }
    if (allowedExts !== baseline.current.TicketAttachmentAllowedExts) {
      updates.push({
        key: 'TicketAttachmentAllowedExts',
        value: allowedExts,
      })
    }
    if (localPath !== baseline.current.TicketAttachmentLocalPath) {
      updates.push({ key: 'TicketAttachmentLocalPath', value: localPath })
    }
    if (signedTTL !== baseline.current.TicketAttachmentSignedURLTTL) {
      updates.push({ key: 'TicketAttachmentSignedURLTTL', value: signedTTL })
    }
    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }
    for (const u of updates) {
      await updateOption.mutateAsync(u)
    }
  }

  const saveAssign = async () => {
    await updateOption.mutateAsync({
      key: 'TicketAssignConfig',
      value: JSON.stringify(assignConfig),
    })
  }

  // ----- Staff picker dialog ---------------------------------------------
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerType, setPickerType] = useState<TicketTypeKey | null>(null)
  const [pickerSelected, setPickerSelected] = useState<Set<number>>(new Set())

  const openPicker = (type: TicketTypeKey) => {
    setPickerType(type)
    setPickerSelected(new Set(assignConfig.rules[type].users))
    setPickerOpen(true)
  }

  const confirmPicker = () => {
    if (!pickerType) return
    setAssignConfig((prev) => ({
      ...prev,
      rules: {
        ...prev.rules,
        [pickerType]: {
          ...prev.rules[pickerType],
          users: Array.from(pickerSelected).sort((a, b) => a - b),
        },
      },
    }))
    setPickerOpen(false)
  }

  return (
    <SettingsSection
      title={t('Ticket System')}
      description={t(
        'Notification, attachments and ticket assignment settings'
      )}
    >
      <div className='space-y-6'>
        {/* Notification */}
        <section className='bg-card space-y-4 rounded-xl border p-4'>
          <h4 className='text-sm font-semibold'>{t('Notification')}</h4>
          <div className='flex items-start justify-between gap-3 rounded-lg border p-3'>
            <div className='space-y-0.5'>
              <div className='text-sm font-medium'>
                {t('Email notification on new tickets')}
              </div>
              <div className='text-muted-foreground text-xs'>
                {t('Send admin email when a ticket is created or updated')}
              </div>
            </div>
            <Switch
              checked={notifyEnabled}
              onCheckedChange={setNotifyEnabled}
            />
          </div>
          <div className='space-y-1.5'>
            <Label>{t('Admin notification email')}</Label>
            <Input
              type='email'
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder='ops@example.com'
            />
            <p className='text-muted-foreground text-xs'>
              {t('Leave empty to use the SMTP "From" address')}
            </p>
          </div>
        </section>

        {/* Attachment */}
        <section className='bg-card space-y-4 rounded-xl border p-4'>
          <h4 className='text-sm font-semibold'>{t('Attachments')}</h4>
          <div className='flex items-start justify-between gap-3 rounded-lg border p-3'>
            <div className='space-y-0.5'>
              <div className='text-sm font-medium'>
                {t('Enable ticket attachments')}
              </div>
              <div className='text-muted-foreground text-xs'>
                {t('Allow users to upload files to tickets')}
              </div>
            </div>
            <Switch
              checked={attachmentEnabled}
              onCheckedChange={setAttachmentEnabled}
            />
          </div>
          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='space-y-1.5'>
              <Label>{t('Max size per file (bytes)')}</Label>
              <Input
                value={maxSize}
                onChange={(e) => setMaxSize(e.target.value)}
                placeholder='52428800'
              />
              <p className='text-muted-foreground text-xs'>
                {t('Default 52428800 = 50 MB')}
              </p>
            </div>
            <div className='space-y-1.5'>
              <Label>{t('Max files per message')}</Label>
              <Input
                value={maxCount}
                onChange={(e) => setMaxCount(e.target.value)}
                placeholder='5'
              />
            </div>
            <div className='space-y-1.5 sm:col-span-2'>
              <Label>{t('Allowed extensions (comma separated)')}</Label>
              <Input
                value={allowedExts}
                onChange={(e) => setAllowedExts(e.target.value)}
                placeholder='jpg,jpeg,png,gif,webp,pdf,txt,md,csv'
              />
              <p className='text-muted-foreground text-xs'>
                {t('SVG is always disabled for safety')}
              </p>
            </div>
            <div className='space-y-1.5'>
              <Label>{t('Local storage path')}</Label>
              <Input
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                placeholder='data/ticket_attachments'
              />
            </div>
            <div className='space-y-1.5'>
              <Label>{t('Signed URL TTL (seconds)')}</Label>
              <Input
                value={signedTTL}
                onChange={(e) => setSignedTTL(e.target.value)}
                placeholder='900'
              />
              <p className='text-muted-foreground text-xs'>
                {t('Used for OSS/S3/COS signed download URLs')}
              </p>
            </div>
          </div>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Object-storage credentials (OSS / S3 / COS) are still managed in the classic frontend. The default frontend currently exposes the most-used fields.'
            )}
          </p>
        </section>

        <div className='flex justify-end'>
          <Button onClick={saveBasic} disabled={updateOption.isPending}>
            {t('Save ticket settings')}
          </Button>
        </div>

        {/* Assignment */}
        <section className='bg-card space-y-4 rounded-xl border p-4'>
          <div className='flex items-start justify-between gap-3'>
            <div>
              <h4 className='text-sm font-semibold'>{t('Auto-assign rules')}</h4>
              <p className='text-muted-foreground text-xs'>
                {t(
                  'When enabled, new tickets are assigned to support staff according to the per-type rules'
                )}
              </p>
            </div>
            <Switch
              checked={assignConfig.enabled}
              onCheckedChange={(v) =>
                setAssignConfig((prev) => ({ ...prev, enabled: v }))
              }
            />
          </div>
          <div className='space-y-1.5'>
            <Label>{t('Fallback when no staff configured')}</Label>
            <Select
              value={assignConfig.fallback}
              onValueChange={(v) =>
                setAssignConfig((prev) => ({
                  ...prev,
                  fallback: v as TicketAssignConfig['fallback'],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FALLBACK_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {TICKET_TYPES.map((type) => {
            const rule = assignConfig.rules[type.value]
            return (
              <div
                key={type.value}
                className='space-y-3 rounded-lg border p-3'
              >
                <div>
                  <div className='text-sm font-medium'>{t(type.labelKey)}</div>
                  <div className='text-muted-foreground text-xs'>
                    {t(type.descKey)}
                  </div>
                </div>
                <div className='space-y-1.5'>
                  <Label>{t('Strategy')}</Label>
                  <Select
                    value={rule.strategy}
                    onValueChange={(v) =>
                      setAssignConfig((prev) => ({
                        ...prev,
                        rules: {
                          ...prev.rules,
                          [type.value]: {
                            ...prev.rules[type.value],
                            strategy: v as TicketAssignStrategy,
                          },
                        },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STRATEGY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className='flex flex-col text-left'>
                            <span>{t(opt.labelKey)}</span>
                            <span className='text-muted-foreground text-xs'>
                              {t(opt.hintKey)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-1.5'>
                  <div className='flex items-center justify-between'>
                    <Label>{t('Assignees')}</Label>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() => openPicker(type.value)}
                    >
                      <Plus className='mr-1.5 h-3.5 w-3.5' />
                      {t('Pick staff')}
                    </Button>
                  </div>
                  {rule.users.length === 0 ? (
                    <div className='text-muted-foreground bg-muted/40 rounded-md border border-dashed px-3 py-2 text-xs'>
                      {t('No staff assigned')}
                    </div>
                  ) : (
                    <div className='flex flex-wrap gap-1.5'>
                      {rule.users.map((uid) => {
                        const u = staffIndex.get(uid)
                        const label = u
                          ? u.display_name || u.username
                          : `UID ${uid}`
                        return (
                          <Badge
                            key={uid}
                            variant='outline'
                            className='font-normal'
                          >
                            {label}
                            <button
                              type='button'
                              onClick={() =>
                                setAssignConfig((prev) => ({
                                  ...prev,
                                  rules: {
                                    ...prev.rules,
                                    [type.value]: {
                                      ...prev.rules[type.value],
                                      users: prev.rules[type.value].users.filter(
                                        (x) => x !== uid
                                      ),
                                    },
                                  },
                                }))
                              }
                              className='text-muted-foreground hover:text-destructive ml-1'
                              aria-label={t('Remove')}
                            >
                              <Trash2 className='h-3 w-3' />
                            </button>
                          </Badge>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <div className='flex justify-end'>
            <Button onClick={saveAssign} disabled={updateOption.isPending}>
              {t('Save assign rules')}
            </Button>
          </div>
        </section>
      </div>

      {/* Staff picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>{t('Pick assignees')}</DialogTitle>
            <DialogDescription>
              {pickerType
                ? t('Choose support staff for {{type}} tickets', {
                    type: t(
                      TICKET_TYPES.find((tp) => tp.value === pickerType)
                        ?.labelKey || ''
                    ),
                  })
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className='max-h-[55vh] space-y-1 overflow-y-auto'>
            {!staffLoaded ? (
              <div className='text-muted-foreground py-6 text-center text-sm'>
                {t('Loading…')}
              </div>
            ) : staffList.length === 0 ? (
              <div className='text-muted-foreground py-6 text-center text-sm'>
                {t('No support staff available')}
              </div>
            ) : (
              staffList.map((u) => {
                const checked = pickerSelected.has(u.id)
                return (
                  <button
                    type='button'
                    key={u.id}
                    onClick={() =>
                      setPickerSelected((prev) => {
                        const next = new Set(prev)
                        if (next.has(u.id)) next.delete(u.id)
                        else next.add(u.id)
                        return next
                      })
                    }
                    className={cn(
                      'hover:bg-accent/40 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left',
                      checked && 'bg-primary/5'
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() =>
                        setPickerSelected((prev) => {
                          const next = new Set(prev)
                          if (next.has(u.id)) next.delete(u.id)
                          else next.add(u.id)
                          return next
                        })
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div>
                      <div className='text-sm font-medium'>
                        {u.display_name || u.username}
                      </div>
                      <div className='text-muted-foreground text-xs'>
                        UID {u.id} · {u.username}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setPickerOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={confirmPicker}>{t('Confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  )
}
