const warned = new Set()
export function warn(str) {
  if (warned.has(str)) return
  // eslint-disable-next-line no-console
  console.warn(str)
  warned.add(str)
}
