// \u2705 = ✅
// \u2713 = ✓
// \u2714 = ✔
// \u2611 = ☑
// \u23B7 = ⎷
const CHECK_MARKS_RE = /[\u2705\u2713\u2714\u2611\u23b7]/gu

export function sanitizeDisplayName(str: string): string {
  if (typeof str === 'string') {
    return str.replace(CHECK_MARKS_RE, '').trim()
  }
  return ''
}

export function combinedDisplayName({
  handle,
  displayName,
}: {
  handle?: string
  displayName?: string
}): string {
  if (!handle) {
    return ''
  }
  return displayName
    ? `${sanitizeDisplayName(displayName)} (@${handle})`
    : `@${handle}`
}
