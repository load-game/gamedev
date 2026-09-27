// Only presentation tokens are accepted; worlds cannot inject CSS or change controls.
const colors = [
  'panel',
  'card',
  'border',
  'text',
  'muted',
  'outline',
  'headerTop',
  'headerBottom',
  'primaryTop',
  'primaryBottom',
  'primaryShadow',
  'secondaryTop',
  'secondaryBottom',
  'secondaryShadow',
  'closeTop',
  'closeBottom',
  'closeShadow',
]
const colorPattern = /^#(?:[a-f\d]{3}|[a-f\d]{6}|[a-f\d]{8})$/i

export function validateMenuTheme(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const result = {}
  for (const key of colors) {
    if (typeof input[key] === 'string' && colorPattern.test(input[key])) result[key] = input[key]
  }
  for (const [key, max] of [
    ['radius', 24],
    ['borderWidth', 4],
    ['textOutline', 3],
    ['buttonDepth', 8],
  ]) {
    if (Number.isFinite(input[key])) result[key] = Math.max(0, Math.min(max, input[key]))
  }
  if (typeof input.uppercase === 'boolean') result.uppercase = input.uppercase
  if (
    typeof input.fontUrl === 'string' &&
    input.fontUrl.length <= 2048 &&
    /^(?:asset:\/\/|https?:\/\/|\/(?!\/))[a-z\d/_.:%?=&+#~-]+$/i.test(input.fontUrl)
  ) {
    result.fontUrl = input.fontUrl
  }
  return result
}
