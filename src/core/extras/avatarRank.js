export const AVATAR_RANK_SPECS = [
  {
    rank: 5,
    // Perfect
    fileSize: 5 * 1048576, // 5 MB
    triangles: 4000,
    draws: 1,
    bones: 70,
    bounds: [3, 3, 3],
  },
  {
    rank: 4,
    // Great
    fileSize: 10 * 1048576, // 10 MB
    triangles: 16000,
    draws: 2,
    bones: 100,
    bounds: [3, 3, 3],
  },
  {
    rank: 3,
    // Good
    fileSize: 15 * 1048576, // 15 MB
    triangles: 32000,
    draws: 4,
    bones: 130,
    bounds: [4, 4, 4],
  },
  {
    rank: 2,
    // Heavy
    fileSize: 25 * 1048576, // 25 MB
    triangles: 64000,
    draws: 32,
    bones: 160,
    bounds: [7, 6, 4],
  },
]

const AVATAR_RANK_LABELS = {
  5: 'Perfect',
  4: 'Great',
  3: 'Good',
  2: 'Heavy',
  1: 'Very Poor',
}

function toFiniteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback
}

function normalizeBounds(value) {
  if (!Array.isArray(value) || value.length !== 3) {
    return [Infinity, Infinity, Infinity]
  }
  return value.map(axis => toFiniteNumber(axis, Infinity))
}

export function normalizeAvatarRank(value, fallback = 1) {
  if (!Number.isFinite(value)) return fallback
  const rounded = Math.round(value)
  return Math.max(1, Math.min(5, rounded))
}

export function getAvatarRankLabel(rank) {
  return AVATAR_RANK_LABELS[normalizeAvatarRank(rank)] || AVATAR_RANK_LABELS[1]
}

export function getAvatarRankSpec(rank) {
  const normalized = normalizeAvatarRank(rank)
  for (const spec of AVATAR_RANK_SPECS) {
    if (spec.rank === normalized) return spec
  }
  return null
}

export function determineAvatarRank(metrics = {}) {
  const fileSize = toFiniteNumber(metrics.fileSize, Infinity)
  const triangles = toFiniteNumber(metrics.triangles, Infinity)
  const draws = toFiniteNumber(metrics.draws, Infinity)
  const bones = toFiniteNumber(metrics.bones, Infinity)
  const bounds = normalizeBounds(metrics.bounds)
  for (const spec of AVATAR_RANK_SPECS) {
    if (fileSize > spec.fileSize) continue
    if (triangles > spec.triangles) continue
    if (draws > spec.draws) continue
    if (bones > spec.bones) continue
    if (bounds[0] > spec.bounds[0] || bounds[1] > spec.bounds[1] || bounds[2] > spec.bounds[2]) continue
    return spec.rank
  }
  return 1
}
