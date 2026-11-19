// Formatting helpers for the admin screens.

export const ROLES = ['PROSPECTIVE_CORPER', 'SERVING_CORPER', 'EX_CORPER', 'BUSINESS', 'RECRUITER', 'ADMIN']

export function dateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function shortDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function words(value) {
  if (!value) return ''
  return String(value).toLowerCase().replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
}
