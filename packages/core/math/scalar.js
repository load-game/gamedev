export function clamp(n, low, high) {
  return Math.max(Math.min(n, high), low)
}

export function num(min, max, dp = 0) {
  const value = Math.random() * (max - min) + min
  return parseFloat(value.toFixed(dp))
}
