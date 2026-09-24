// Bounded local route search. The caller supplies collision/ground tests.
export function findAgentPath(start, goal, step, { cell = 1.25, limit = 800, radius = 35 } = {}) {
  if (Math.hypot(goal[0] - start[0], goal[2] - start[2]) > radius) return null
  const key = p => `${Math.round((p[0] - start[0]) / cell)},${Math.round((p[2] - start[2]) / cell)}`
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2])
  const first = { p: start, cost: 0, score: distance(start, goal), parent: null }
  const open = [first],
    costs = new Map([[key(start), 0]])
  for (let visited = 0; open.length && visited < limit; visited++) {
    open.sort((a, b) => a.score - b.score)
    const node = open.shift()
    if (distance(node.p, goal) <= cell * 1.5) {
      const end = step(node.p, goal)
      if (end && Math.abs(end[1] - goal[1]) <= 0.6) {
        const path = [end]
        for (let at = node; at.parent; at = at.parent) path.unshift(at.p)
        return path
      }
    }
    for (const [x, z] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const candidate = [node.p[0] + x * cell, node.p[1], node.p[2] + z * cell]
      if (distance(start, candidate) > radius) continue
      const cost = node.cost + Math.hypot(x, z) * cell,
        id = key(candidate)
      if ((costs.get(id) ?? Infinity) <= cost) continue
      const p = step(node.p, candidate)
      if (!p) continue
      costs.set(id, cost)
      open.push({ p, cost, score: cost + distance(p, goal), parent: node })
    }
  }
  return null
}
