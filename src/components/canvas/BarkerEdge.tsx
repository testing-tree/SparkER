import { useState, useEffect } from 'react'
import { useReactFlow, useEdges, useInternalNode, Position, type EdgeProps, type Node } from '@xyflow/react'
import { useDiagramStore } from '../../store/diagramStore'
import { getBestSides, getHandleXYDistributed, armEnd, getDistributedFraction } from './edgeGeometry'

// ── Constants ─────────────────────────────────────────────────────────────────

const FORK_DIST   = 12
const HALF_SPREAD = 5
const UID_DIST    = 15
const UID_HALF    = 7

// Self-loop geometry
const LOOP_ARM    = 16   // straight ARM length on each end
const LOOP_RADIUS = 28   // arc radius
const LOOP_OFFSET = 20   // exit/entry distance from top-right corner

// ── Helpers ───────────────────────────────────────────────────────────────────

function posToInward(pos: Position): [number, number] {
  if (pos === Position.Left)   return [ 1,  0]
  if (pos === Position.Right)  return [-1,  0]
  if (pos === Position.Top)    return [ 0,  1]
  return                              [ 0, -1]
}

function uidBarPath(ex: number, ey: number, pos: Position): string {
  const [cx, cy] =
    pos === Position.Top    ? [ex,           ey - UID_DIST] :
    pos === Position.Bottom ? [ex,           ey + UID_DIST] :
    pos === Position.Left   ? [ex - UID_DIST, ey]           :
                              [ex + UID_DIST, ey]
  const [dx, dy] =
    pos === Position.Top || pos === Position.Bottom ? [UID_HALF, 0] : [0, UID_HALF]
  return `M ${cx - dx} ${cy - dy} L ${cx + dx} ${cy + dy}`
}

function labelPos(ex: number, ey: number, pos: Position, flipped = false): [number, number, string] {
  if (pos === Position.Right)  return [ex + 6, flipped ? ey + 14 : ey - 10, 'start']
  if (pos === Position.Left)   return [ex - 6, flipped ? ey + 14 : ey - 10, 'end']
  if (pos === Position.Top)    return [flipped ? ex - 8 : ex + 8, ey - 10, flipped ? 'end' : 'start']
  return                              [flipped ? ex - 8 : ex + 8, ey + 10, flipped ? 'end' : 'start']
}

// Same layout logic, reused for self-loop exits/entries
const loopLabelPos = labelPos

// Compute the midpoint of an SVG circular arc (large-arc=1 split into two halves).
function arcMidpoint(
  x1: number, y1: number,
  x2: number, y2: number,
  r: number,
  largeArc: 0 | 1,
  sweep: 0 | 1,
): [number, number] {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  const ddx = x2 - x1, ddy = y2 - y1
  const d = Math.sqrt(ddx * ddx + ddy * ddy)
  if (d < 1e-6) return [x1, y1]
  const h = Math.sqrt(Math.max(0, r * r - (d / 2) * (d / 2)))
  const sign = largeArc !== sweep ? 1 : -1
  const cx = mx + sign * h * (-ddy) / d
  const cy = my + sign * h * ddx / d
  const θ1 = Math.atan2(y1 - cy, x1 - cx)
  const θ2 = Math.atan2(y2 - cy, x2 - cx)
  let θm: number
  if (sweep === 0) {
    let span = θ1 - θ2
    if (span < 0) span += 2 * Math.PI
    if (largeArc === 1 && span < Math.PI) span = 2 * Math.PI - span
    θm = θ1 - span / 2
  } else {
    let span = θ2 - θ1
    if (span < 0) span += 2 * Math.PI
    if (largeArc === 1 && span < Math.PI) span = 2 * Math.PI - span
    θm = θ1 + span / 2
  }
  return [cx + r * Math.cos(θm), cy + r * Math.sin(θm)]
}

function CrowsFoot({ ex, ey, pos, optional }: {
  ex: number; ey: number; pos: Position; optional: boolean
}) {
  const [inDx, inDy] = posToInward(pos)
  const fx = ex - FORK_DIST * inDx
  const fy = ey - FORK_DIST * inDy
  const px = -inDy
  const py =  inDx
  const dash = optional ? { strokeDasharray: '2 3' } : {}
  return (
    <>
      <line x1={fx} y1={fy} x2={ex + HALF_SPREAD * px} y2={ey + HALF_SPREAD * py} {...dash} />
      <line x1={fx} y1={fy} x2={ex - HALF_SPREAD * px} y2={ey - HALF_SPREAD * py} {...dash} />
    </>
  )
}

// ── Edge component ────────────────────────────────────────────────────────────

export default function BarkerEdge({ id, source, target, selected }: EdgeProps) {
  const { getNode, screenToFlowPosition } = useReactFlow()
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const allEdges             = useEdges()
  const rel                  = useDiagramStore(s => s.diagram.relationships.find(r => r.id === id))
  const updateRelationship    = useDiagramStore(s => s.updateRelationship)
  const updateRelationshipEnd = useDiagramStore(s => s.updateRelationshipEnd)
  // useInternalNode subscribes to nodeLookup via useStore — re-renders when measured changes.
  const sourceNode  = useInternalNode(source) as Node | undefined
  const targetNode  = useInternalNode(target) as Node | undefined

  if (!rel || !sourceNode || !targetNode) return null

  const srcOptional = rel.sourceEnd.optionality === 'optional'
  const tgtOptional = rel.targetEnd.optionality === 'optional'
  const srcMany     = rel.sourceEnd.cardinality === 'many'
  const tgtMany     = rel.targetEnd.cardinality === 'many'
  const stroke      = selected ? '#3b82f6' : '#1f2937'
  const sw          = selected ? 2 : 1.5

  // ── Self-loop (ARM + arc + ARM, four corners) ──────────────────

  if (source === target) {
    const nx = sourceNode.position.x
    const ny = sourceNode.position.y
    const nw = sourceNode.measured?.width  ?? 150
    const nh = sourceNode.measured?.height ?? 100

    type Corner = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
    const corner: Corner = (rel.loopCorner as Corner | undefined) ?? 'top-right'

    // Per-corner geometry: exit/entry on entity border, ARM endpoint, arc sweep, CrowsFoot positions
    const geo: Record<Corner, {
      exitX: number; exitY: number; exitPos: Position
      eaX:   number; eaY:   number
      entryX: number; entryY: number; entryPos: Position
      taX:   number; taY:   number
      sweep: 0 | 1
    }> = {
      'top-right': {
        exitX:  nx + nw,              exitY:  ny + LOOP_OFFSET,   exitPos:  Position.Right,
        eaX:    nx + nw + LOOP_ARM,   eaY:    ny + LOOP_OFFSET,
        entryX: nx + nw - LOOP_OFFSET, entryY: ny,                entryPos: Position.Top,
        taX:    nx + nw - LOOP_OFFSET, taY:    ny - LOOP_ARM,
        sweep: 0,
      },
      'top-left': {
        exitX:  nx,                   exitY:  ny + LOOP_OFFSET,   exitPos:  Position.Left,
        eaX:    nx - LOOP_ARM,        eaY:    ny + LOOP_OFFSET,
        entryX: nx + LOOP_OFFSET,     entryY: ny,                 entryPos: Position.Top,
        taX:    nx + LOOP_OFFSET,     taY:    ny - LOOP_ARM,
        sweep: 1,
      },
      'bottom-right': {
        exitX:  nx + nw,              exitY:  ny + nh - LOOP_OFFSET, exitPos:  Position.Right,
        eaX:    nx + nw + LOOP_ARM,   eaY:    ny + nh - LOOP_OFFSET,
        entryX: nx + nw - LOOP_OFFSET, entryY: ny + nh,              entryPos: Position.Bottom,
        taX:    nx + nw - LOOP_OFFSET, taY:    ny + nh + LOOP_ARM,
        sweep: 1,
      },
      'bottom-left': {
        exitX:  nx,                   exitY:  ny + nh - LOOP_OFFSET, exitPos:  Position.Left,
        eaX:    nx - LOOP_ARM,        eaY:    ny + nh - LOOP_OFFSET,
        entryX: nx + LOOP_OFFSET,     entryY: ny + nh,               entryPos: Position.Bottom,
        taX:    nx + LOOP_OFFSET,     taY:    ny + nh + LOOP_ARM,
        sweep: 0,
      },
    }

    const g = geo[corner]

    // Only draw the ARM segment when a crow's foot needs to sit on it.
    const arcFromX = srcMany ? g.eaX    : g.exitX
    const arcFromY = srcMany ? g.eaY    : g.exitY
    const arcToX   = tgtMany ? g.taX    : g.entryX
    const arcToY   = tgtMany ? g.taY    : g.entryY

    const loopPath =
      (srcMany ? `M ${g.exitX} ${g.exitY} L ${arcFromX} ${arcFromY}` : `M ${g.exitX} ${g.exitY}`) +
      ` A ${LOOP_RADIUS} ${LOOP_RADIUS} 0 1 ${g.sweep} ${arcToX} ${arcToY}` +
      (tgtMany ? ` L ${g.entryX} ${g.entryY}` : '')

    // Split at arc midpoint for independent half-optional styling (matches regular edge logic).
    const [midX, midY] = arcMidpoint(arcFromX, arcFromY, arcToX, arcToY, LOOP_RADIUS, 1, g.sweep)
    const srcLoopPath =
      (srcMany ? `M ${g.exitX} ${g.exitY} L ${arcFromX} ${arcFromY}` : `M ${arcFromX} ${arcFromY}`) +
      ` A ${LOOP_RADIUS} ${LOOP_RADIUS} 0 0 ${g.sweep} ${midX} ${midY}`
    const tgtLoopPath =
      `M ${midX} ${midY} A ${LOOP_RADIUS} ${LOOP_RADIUS} 0 0 ${g.sweep} ${arcToX} ${arcToY}` +
      (tgtMany ? ` L ${g.entryX} ${g.entryY}` : '')
    const srcDash = srcOptional ? { strokeDasharray: '2 3' } : {}
    const tgtDash = tgtOptional ? { strokeDasharray: '2 3' } : {}

    const CORNERS: Corner[] = ['top-right', 'top-left', 'bottom-right', 'bottom-left']
    const DOT = 14  // diagonal offset for corner picker dots
    const dotPos: Record<Corner, [number, number]> = {
      'top-right':    [nx + nw + DOT, ny - DOT],
      'top-left':     [nx - DOT,      ny - DOT],
      'bottom-right': [nx + nw + DOT, ny + nh + DOT],
      'bottom-left':  [nx - DOT,      ny + nh + DOT],
    }

    return (
      <g fill="none" strokeLinecap="round">
        {/* Hit area */}
        <path d={loopPath} stroke="transparent" strokeWidth={20} />

        {/* Source half */}
        <path d={srcLoopPath} stroke={stroke} strokeWidth={sw} {...srcDash} />

        {/* Target half */}
        <path d={tgtLoopPath} stroke={stroke} strokeWidth={sw} {...tgtDash} />

        {/* Crow's feet */}
        <g stroke={stroke} strokeWidth={sw}>
          {srcMany && <CrowsFoot ex={g.exitX}  ey={g.exitY}  pos={g.exitPos}  optional={srcOptional} />}
          {tgtMany && <CrowsFoot ex={g.entryX} ey={g.entryY} pos={g.entryPos} optional={tgtOptional} />}
        </g>

        {/* UID bars */}
        {rel.sourceEnd.uidBar && (
          <path d={uidBarPath(g.exitX,  g.exitY,  g.exitPos)}  stroke={stroke} strokeWidth={sw} />
        )}
        {rel.targetEnd.uidBar && (
          <path d={uidBarPath(g.entryX, g.entryY, g.entryPos)} stroke={stroke} strokeWidth={sw} />
        )}

        {/* Verb labels */}
        {rel.sourceEnd.label && (() => {
          const [lx, ly, anchor] = loopLabelPos(g.exitX, g.exitY, g.exitPos, rel.sourceEnd.labelFlipped ?? false)
          return (
            <text x={lx} y={ly} textAnchor={anchor as never}
              fontSize={11} fill={stroke} stroke="none" dominantBaseline="middle"
              style={{ cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); updateRelationshipEnd(id, 'source', { labelFlipped: !(rel.sourceEnd.labelFlipped ?? false) }) }}>
              {rel.sourceEnd.label}
            </text>
          )
        })()}
        {rel.targetEnd.label && (() => {
          const [lx, ly, anchor] = loopLabelPos(g.entryX, g.entryY, g.entryPos, rel.targetEnd.labelFlipped ?? false)
          return (
            <text x={lx} y={ly} textAnchor={anchor as never}
              fontSize={11} fill={stroke} stroke="none" dominantBaseline="middle"
              style={{ cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); updateRelationshipEnd(id, 'target', { labelFlipped: !(rel.targetEnd.labelFlipped ?? false) }) }}>
              {rel.targetEnd.label}
            </text>
          )
        })()}

        {/* Corner picker — visible only when edge is selected */}
        {selected && CORNERS.map(c => {
          const [cx, cy] = dotPos[c]
          const isCurrent = c === corner
          return (
            <g key={c}>
              <circle
                cx={cx} cy={cy} r={5}
                fill={isCurrent ? '#3b82f6' : '#93c5fd'}
                fillOpacity={isCurrent ? 1 : 0.7}
                stroke="white" strokeWidth={1.5}
                style={{ pointerEvents: 'none' }}
              />
              <circle
                cx={cx} cy={cy} r={18}
                fill="transparent"
                style={{ cursor: 'pointer', pointerEvents: 'all' }}
                onClick={e => { e.stopPropagation(); updateRelationship(id, { loopCorner: c }) }}
              />
            </g>
          )
        })}
      </g>
    )
  }

  // ── Floating edge (regular) ────────────────────────────────────

  const strToPos = (s?: string): Position | undefined => {
    if (s === 'top') return Position.Top
    if (s === 'right') return Position.Right
    if (s === 'bottom') return Position.Bottom
    if (s === 'left') return Position.Left
    return undefined
  }

  const { srcPos, tgtPos } = getBestSides(
    sourceNode, targetNode,
    strToPos(rel.sourceEnd.preferredSide),
    strToPos(rel.targetEnd.preferredSide),
  )

  const gn = getNode as (id: string) => Node | undefined
  const [sx, sy] = getHandleXYDistributed(sourceNode, srcPos, getDistributedFraction(source, srcPos, id, true,  allEdges, gn))
  const [tx, ty] = getHandleXYDistributed(targetNode, tgtPos, getDistributedFraction(target, tgtPos, id, false, allEdges, gn))

  const [saX, saY] = armEnd(sx, sy, srcPos)
  const [taX, taY] = armEnd(tx, ty, tgtPos)

  // Pick routing that avoids U-turns on BOTH ends.
  // V-H: corner at (saX, taY) — vertical first, then horizontal to target ARM.
  // H-V: corner at (taX, saY) — horizontal first, then vertical to target ARM.
  // U-turn = corner is BEHIND the target ARM so the final leg goes opposite to ARM direction.
  const srcHorizontal = srcPos === Position.Left || srcPos === Position.Right
  const hDist = Math.abs(taX - saX)
  const vDist = Math.abs(taY - saY)

  // V-H: horizontal leg (saX→taX) approaches target ARM.  U-turn if the approach
  // goes WITH the ARM direction (past the tip, then ARMs back) instead of against it.
  const tgtBacktrackVH = (tgtPos === Position.Left  && saX > taX) ||
                          (tgtPos === Position.Right && saX < taX)
  // H-V: vertical leg (saY→taY) approaches target ARM.  Same logic.
  const tgtBacktrackHV = (tgtPos === Position.Top    && saY > taY) ||
                          (tgtPos === Position.Bottom && saY < taY)

  // Prefer source-perpendicular; swap only when it backtracks and the other doesn't.
  let useVH = srcHorizontal
    ? (!tgtBacktrackVH || tgtBacktrackHV)  // V-H default, swap to H-V if V-H backtracks and H-V doesn't
    : (tgtBacktrackHV && !tgtBacktrackVH)  // H-V default, swap to V-H if H-V backtracks and V-H doesn't

  const userSide = !!(rel.sourceEnd.preferredSide || rel.targetEnd.preferredSide)
  const wp0 = rel.waypoints?.[0]

  // Waypoint overrides routing mode (tells us which corner the user chose).
  // Corner always uses current ARM positions so entity movement doesn't break it.
  if (wp0) {
    const dVH = Math.hypot(wp0.x - saX, wp0.y - taY)
    const dHV = Math.hypot(wp0.x - taX, wp0.y - saY)
    // Prefer the corner that avoids a target U-turn
    if (tgtBacktrackVH && !tgtBacktrackHV) {
      useVH = false
    } else if (tgtBacktrackHV && !tgtBacktrackVH) {
      useVH = true
    } else {
      useVH = dVH <= dHV
    }
  }

  const cornerX = dragPos ? dragPos.x : (useVH ? saX : taX)
  const cornerY = dragPos ? dragPos.y : (useVH ? taY : saY)

  // Keep stored waypoint in sync when entities move
  useEffect(() => {
    if (wp0 && !dragPos) {
      if (Math.abs(wp0.x - cornerX) > 1 || Math.abs(wp0.y - cornerY) > 1) {
        updateRelationship(id, { waypoints: [{ x: cornerX, y: cornerY }] })
      }
    }
  }, [cornerX, cornerY, wp0, dragPos, id, updateRelationship])

  const half  = (hDist + vDist) / 2

  let fullPath: string
  let sourcePath: string
  let targetPath: string

  if (wp0 || dragPos) {
    // ── Waypoint/drag: walk segments from source handle to target handle,
    //     split at midpoint of total path length (ARM→ARM distance)
    const armDist = Math.abs(cornerX - saX) + Math.abs(cornerY - saY) + Math.abs(taX - cornerX) + Math.abs(taY - cornerY)
    const mid = armDist / 2

    const srcLeg1 = Math.abs(cornerX - saX) + Math.abs(cornerY - saY)

    fullPath = `M ${sx} ${sy} L ${saX} ${saY} L ${cornerX} ${cornerY} L ${taX} ${taY} L ${tx} ${ty}`

    if (mid <= srcLeg1) {
      // Split inside first orthogonal leg (after ARM)
      const frac = srcLeg1 > 0 ? mid / srcLeg1 : 0
      const mx = saX + (cornerX - saX) * frac
      const my = saY + (cornerY - saY) * frac
      sourcePath = `M ${sx} ${sy} L ${saX} ${saY} L ${mx} ${my}`
      targetPath = `M ${mx} ${my} L ${cornerX} ${cornerY} L ${taX} ${taY} L ${tx} ${ty}`
    } else {
      // Split inside second orthogonal leg (after corner)
      const srcLeg2 = Math.abs(taX - cornerX) + Math.abs(taY - cornerY)
      const frac = srcLeg2 > 0 ? (mid - srcLeg1) / srcLeg2 : 0
      const mx = cornerX + (taX - cornerX) * frac
      const my = cornerY + (taY - cornerY) * frac
      sourcePath = `M ${sx} ${sy} L ${saX} ${saY} L ${cornerX} ${cornerY} L ${mx} ${my}`
      targetPath = `M ${mx} ${my} L ${taX} ${taY} L ${tx} ${ty}`
    }
  } else if (useVH) {
    // ── Auto V-H ──
    fullPath = `M ${sx} ${sy} L ${saX} ${saY} L ${saX} ${taY} L ${taX} ${taY} L ${tx} ${ty}`
    if (vDist >= half) {
      const sy2 = saY + Math.sign(taY - saY) * half
      sourcePath = `M ${sx} ${sy} L ${saX} ${saY} L ${saX} ${sy2}`
      targetPath = `M ${saX} ${sy2} L ${saX} ${taY} L ${taX} ${taY} L ${tx} ${ty}`
    } else {
      const sx2 = saX + Math.sign(taX - saX) * (half - vDist)
      sourcePath = `M ${sx} ${sy} L ${saX} ${saY} L ${saX} ${taY} L ${sx2} ${taY}`
      targetPath = `M ${sx2} ${taY} L ${taX} ${taY} L ${tx} ${ty}`
    }
  } else {
    // ── Auto H-V ──
    fullPath = `M ${sx} ${sy} L ${saX} ${saY} L ${taX} ${saY} L ${taX} ${taY} L ${tx} ${ty}`
    if (hDist >= half) {
      const sx2 = saX + Math.sign(taX - saX) * half
      sourcePath = `M ${sx} ${sy} L ${saX} ${saY} L ${sx2} ${saY}`
      targetPath = `M ${sx2} ${saY} L ${taX} ${saY} L ${taX} ${taY} L ${tx} ${ty}`
    } else {
      const sy2 = saY + Math.sign(taY - saY) * (half - hDist)
      sourcePath = `M ${sx} ${sy} L ${saX} ${saY} L ${taX} ${saY} L ${taX} ${sy2}`
      targetPath = `M ${taX} ${sy2} L ${taX} ${taY} L ${tx} ${ty}`
    }
  }

  const [slX, slY, slAnchor] = labelPos(sx, sy, srcPos, rel.sourceEnd.labelFlipped ?? false)
  const [tlX, tlY, tlAnchor] = labelPos(tx, ty, tgtPos, rel.targetEnd.labelFlipped ?? false)

  return (
    <g fill="none" strokeLinecap="round">
      {/* Hit area */}
      <path d={fullPath} stroke="transparent" strokeWidth={20} />

      {/* Source half */}
      <path d={sourcePath} stroke={stroke} strokeWidth={sw}
        {...(srcOptional ? { strokeDasharray: '2 3' } : {})} />

      {/* Target half */}
      <path d={targetPath} stroke={stroke} strokeWidth={sw}
        {...(tgtOptional ? { strokeDasharray: '2 3' } : {})} />

      {/* Crow's feet */}
      <g stroke={stroke} strokeWidth={sw}>
        {srcMany && <CrowsFoot ex={sx} ey={sy} pos={srcPos} optional={srcOptional} />}
        {tgtMany && <CrowsFoot ex={tx} ey={ty} pos={tgtPos} optional={tgtOptional} />}
      </g>

      {/* UID bars */}
      {rel.sourceEnd.uidBar && (
        <path d={uidBarPath(sx, sy, srcPos)} stroke={stroke} strokeWidth={sw} />
      )}
      {rel.targetEnd.uidBar && (
        <path d={uidBarPath(tx, ty, tgtPos)} stroke={stroke} strokeWidth={sw} />
      )}

      {/* Verb labels */}
      {rel.sourceEnd.label && (
        <text x={slX} y={slY} textAnchor={slAnchor as never}
          fontSize={11} fill={stroke} stroke="none" dominantBaseline="middle"
          style={{ cursor: 'pointer' }}
          onClick={e => { e.stopPropagation(); updateRelationshipEnd(id, 'source', { labelFlipped: !(rel.sourceEnd.labelFlipped ?? false) }) }}>
          {rel.sourceEnd.label}
          <title>Click to flip to other side of the line</title>
        </text>
      )}
      {rel.targetEnd.label && (
        <text x={tlX} y={tlY} textAnchor={tlAnchor as never}
          fontSize={11} fill={stroke} stroke="none" dominantBaseline="middle"
          style={{ cursor: 'pointer' }}
          onClick={e => { e.stopPropagation(); updateRelationshipEnd(id, 'target', { labelFlipped: !(rel.targetEnd.labelFlipped ?? false) }) }}>
          {rel.targetEnd.label}
          <title>Click to flip to other side of the line</title>
        </text>
      )}

      {/* Draggable waypoint — only for edges with manually chosen side(s) */}
      {selected && userSide && (
        <circle
          cx={cornerX} cy={cornerY} r={5}
          fill={dragPos ? '#60a5fa' : (wp0 ? '#60a5fa' : '#d1d5db')}
          stroke="white" strokeWidth={2}
          style={{ cursor: dragPos ? 'grabbing' : 'grab', pointerEvents: 'all' }}
          onMouseDown={e => {
            e.stopPropagation()
            setDragPos({ x: cornerX, y: cornerY })
            const onMove = (ev: MouseEvent) => {
              const pos = screenToFlowPosition({ x: ev.clientX, y: ev.clientY })
              setDragPos(pos)
            }
            const onUp = () => {
              window.removeEventListener('mousemove', onMove)
              window.removeEventListener('mouseup', onUp)
              setDragPos(prev => {
                if (!prev) return null
                const dVH = Math.hypot(prev.x - saX, prev.y - taY)
                const dHV = Math.hypot(prev.x - taX, prev.y - saY)
                // Prefer non-U-turning corner
                let useVHSnap: boolean
                if (tgtBacktrackVH && !tgtBacktrackHV) {
                  useVHSnap = false
                } else if (tgtBacktrackHV && !tgtBacktrackVH) {
                  useVHSnap = true
                } else {
                  useVHSnap = dVH <= dHV
                }
                const snapped = useVHSnap ? { x: saX, y: taY } : { x: taX, y: saY }
                updateRelationship(id, { waypoints: [snapped] })
                return null
              })
            }
            window.addEventListener('mousemove', onMove)
            window.addEventListener('mouseup', onUp)
          }}
          onDoubleClick={e => {
            e.stopPropagation()
            updateRelationship(id, { waypoints: undefined })
          }}
        >
          <title>{wp0 ? 'Double-click to reset' : 'Drag to adjust corner'}</title>
        </circle>
      )}
    </g>
  )
}
