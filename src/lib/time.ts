const SRI_LANKA_TIME_ZONE = 'Asia/Colombo'
type DateValue = Date | string | number | null | undefined
type DateTimeParts = { year: string; month: string; day: string; hour: string; minute: string }

export function getSriLankaNow(): Date {
  return new Date()
}

function getDateTimeParts(value: Date = getSriLankaNow()): DateTimeParts {
  const formattedParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SRI_LANKA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value)
  const get = (type: keyof DateTimeParts) => formattedParts.find((part) => part.type === type)?.value || ''
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') }
}

export function getSriLankaDateInputValue(value: Date = getSriLankaNow()): string {
  const parts = getDateTimeParts(value)
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function getGreeting(value: Date = getSriLankaNow()): string {
  const hour = Number(getDateTimeParts(value).hour)
  if (hour >= 5 && hour < 12) return 'Good Morning'
  if (hour >= 12 && hour < 17) return 'Good Afternoon'
  if (hour >= 17 && hour < 21) return 'Good Evening'
  return 'Good Night'
}

export function formatSriLankaDate(
  value: DateValue,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
): string {
  if (value === null || value === undefined || value === '') return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en', { ...options, timeZone: SRI_LANKA_TIME_ZONE }).format(date)
}

export function formatSriLankaDateTime(
  value: DateValue,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string {
  if (value === null || value === undefined || value === '') return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en', { ...options, timeZone: SRI_LANKA_TIME_ZONE }).format(date)
}

export function formatSriLankaTime(
  value: DateValue,
  options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' },
): string {
  if (value === null || value === undefined || value === '') return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en', { ...options, timeZone: SRI_LANKA_TIME_ZONE }).format(date)
}

export function formatSriLankaDateTimeLocal(value: Date | string | null | undefined): string {
  if (!value) return ''
  const parts = getDateTimeParts(value instanceof Date ? value : new Date(value))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function sriLankaDateTimeLocalToISOString(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || '')
  if (!match) return ''
  const [, year, month, day, hour, minute] = match
  const wallTimeAsUtc = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  ))
  if (Number.isNaN(wallTimeAsUtc.getTime())
    || wallTimeAsUtc.getUTCFullYear() !== Number(year)
    || wallTimeAsUtc.getUTCMonth() !== Number(month) - 1
    || wallTimeAsUtc.getUTCDate() !== Number(day)
    || wallTimeAsUtc.getUTCHours() !== Number(hour)
    || wallTimeAsUtc.getUTCMinutes() !== Number(minute)) return ''

  const localParts = getDateTimeParts(wallTimeAsUtc)
  const offset = Date.UTC(
    Number(localParts.year),
    Number(localParts.month) - 1,
    Number(localParts.day),
    Number(localParts.hour),
    Number(localParts.minute),
  ) - wallTimeAsUtc.getTime()
  return new Date(wallTimeAsUtc.getTime() - offset).toISOString()
}
