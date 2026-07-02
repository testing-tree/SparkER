import { Position, type Edge, type Node } from '@xyflow/react'

export const ARM_LENGTH = 30

export function getBestSides(
  srcNode: Node,
  tgtNode: Node,
  srcPreferred?: Position,
  tgtPreferred?: Position,
): { srcPos: Position; tgtPos: Position } {
  const sw = srcNode.measured?.width  ?? 150
  const sh = srcNode.measured?.height ?? 100
  const tw = tgtNode.measured?.width  ?? 150
  const th = tgtNode.measured?.height ?? 100

  const sx = srcNode.position.x
  const sy = srcNode.position.y
  const tx = tgtNode.position.x
  const ty = tgtNode.position.y

  // ARM endpoint for a given side (center of side as proxy for handle position).
  function arm(pos: Position, x: number, y: number, w: number, h: number): [number, number] {
    switch (pos) {
      case Position.Right:  return [x + w + ARM_LENGTH, y + h / 2]
      case Position.Left:   return [x - ARM_LENGTH,     y + h / 2]
      case Position.Bottom: return [x + w / 2,          y + h + ARM_LENGTH]
      case Position.Top:    return [x + w / 2,          y - ARM_LENGTH]
    }
  }

  // Compute orthogonal path distance for a side pair: |taX - saX| + |taY - saY|
  // Returns Infinity for pairs that would cause a target-side U-turn.
  function dist(srcPos: Position, tgtPos: Position): number {
    const [saX, saY] = arm(srcPos, sx, sy, sw, sh)
    const [taX, taY] = arm(tgtPos, tx, ty, tw, th)
    // Check for U-turn: source-perpendicular routing — first leg perpendicular to source ARM,
    // second leg approaches target ARM.  U-turn when the approach comes from behind the ARM.
    const srcH = srcPos === Position.Left || srcPos === Position.Right
    if (srcH) {
      // V-H: horizontal approach leg. U-turn if target-facing direction conflicts
      if ((tgtPos === Position.Left  && saX > taX) ||
          (tgtPos === Position.Right && saX < taX)) return Infinity
    } else {
      // H-V: vertical approach leg. U-turn if target-facing direction conflicts
      if ((tgtPos === Position.Top    && saY > taY) ||
          (tgtPos === Position.Bottom && saY < taY)) return Infinity
    }
    return Math.abs(taX - saX) + Math.abs(taY - saY)
  }

  const sides: Position[] = [Position.Right, Position.Left, Position.Top, Position.Bottom]
  const srcCandidates = srcPreferred ? [srcPreferred] : sides
  const tgtCandidates = tgtPreferred ? [tgtPreferred] : sides

  let best: { srcPos: Position; tgtPos: Position } | null = null
  let bestDist = Infinity

  for (const srcPos of srcCandidates) {
    for (const tgtPos of tgtCandidates) {
      const d = dist(srcPos, tgtPos)
      if (d < bestDist) {
        bestDist = d
        best = { srcPos, tgtPos }
      }
    }
  }

  // Fallback: if all pairs cause U-turns, pick the shortest any pair
  if (!best) {
    for (const srcPos of srcCandidates) {
      for (const tgtPos of tgtCandidates) {
        const [saX, saY] = arm(srcPos, sx, sy, sw, sh)
        const [taX, taY] = arm(tgtPos, tx, ty, tw, th)
        const d = Math.abs(taX - saX) + Math.abs(taY - saY)
        if (d < bestDist) { bestDist = d; best = { srcPos, tgtPos } }
      }
    }
  }

  return best!
}

export function getHandleXYDistributed(node: Node, pos: Position, fraction: number): [number, number] {
  const x = node.position.x
  const y = node.position.y
  const w = node.measured?.width  ?? 150
  const h = node.measured?.height ?? 100
  switch (pos) {
    case Position.Top:    return [x + w * fraction, y]
    case Position.Bottom: return [x + w * fraction, y + h]
    case Position.Left:   return [x,                y + h * fraction]
    case Position.Right:  return [x + w,            y + h * fraction]
  }
}

export function armEnd(x: number, y: number, pos: Position): [number, number] {
  if (pos === Position.Top)    return [x, y - ARM_LENGTH]
  if (pos === Position.Bottom) return [x, y + ARM_LENGTH]
  if (pos === Position.Left)   return [x - ARM_LENGTH, y]
  return                              [x + ARM_LENGTH, y]
}

function strToPos(s?: string): Position | undefined {
  if (s === 'top') return Position.Top
  if (s === 'right') return Position.Right
  if (s === 'bottom') return Position.Bottom
  if (s === 'left') return Position.Left
  return undefined
}

export function getDistributedFraction(
  entityId: string,
  side: Position,
  thisEdgeId: string,
  _isSourceEnd: boolean,
  allEdges: Edge[],
  getNode: (id: string) => Node | undefined,
  getPrefSides?: (edgeId: string) => { src?: string; tgt?: string } | null,
): number {
  const coEdges = allEdges.filter(e => {
    if (e.source === e.target) return false
    const eSrc = getNode(e.source)
    const eTgt = getNode(e.target)
    if (!eSrc || !eTgt) return false
    const pref = getPrefSides?.(e.id)
    const { srcPos, tgtPos } = getBestSides(eSrc, eTgt,
      strToPos(pref?.src), strToPos(pref?.tgt))
    // Count edges touching this entity on the given side — both as source and target
    if (e.source === entityId && srcPos === side) return true
    if (e.target === entityId && tgtPos === side) return true
    return false
  })
  if (coEdges.length <= 1) return 0.5
  coEdges.sort((a, b) => {
    const aOther = getNode(a.source === entityId ? a.target : a.source)
    const bOther = getNode(b.source === entityId ? b.target : b.source)
    if (!aOther || !bOther) return 0
    const aW = aOther.measured?.width  ?? 150
    const aH = aOther.measured?.height ?? 100
    const bW = bOther.measured?.width  ?? 150
    const bH = bOther.measured?.height ?? 100
    if (side === Position.Top || side === Position.Bottom) {
      return (aOther.position.x + aW / 2) - (bOther.position.x + bW / 2)
    } else {
      return (aOther.position.y + aH / 2) - (bOther.position.y + bH / 2)
    }
  })
  const idx = coEdges.findIndex(e => e.id === thisEdgeId)
  if (idx === -1) return 0.5
  return (idx + 1) / (coEdges.length + 1)
}

// Returns ARM endpoint in flow-space for a relationship at its source entity side.
export function getSourceArmEndpoint(
  rel: { id: string; sourceEntityId: string; targetEntityId: string; preferredSrc?: string; preferredTgt?: string },
  allEdges: Edge[],
  getNode: (id: string) => Node | undefined,
): { ax: number; ay: number; pos: Position } | null {
  const srcNode = getNode(rel.sourceEntityId)
  const tgtNode = getNode(rel.targetEntityId)
  if (!srcNode || !tgtNode) return null
  const { srcPos } = getBestSides(srcNode, tgtNode,
    strToPos(rel.preferredSrc), strToPos(rel.preferredTgt))
  const fraction = getDistributedFraction(rel.sourceEntityId, srcPos, rel.id, true, allEdges, getNode)
  const [sx, sy] = getHandleXYDistributed(srcNode, srcPos, fraction)
  const [ax, ay] = armEnd(sx, sy, srcPos)
  return { ax, ay, pos: srcPos }
}
