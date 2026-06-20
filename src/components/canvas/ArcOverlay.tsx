import { Panel, useReactFlow, useNodes, useEdges, useViewport } from '@xyflow/react'
import { useDiagramStore } from '../../store/diagramStore'
import { getSourceArmEndpoint } from './edgeGeometry'

export default function ArcOverlay() {
  const { getNode }  = useReactFlow()
  const nodes        = useNodes()   // subscribe so overlay re-renders when nodes move
  const allEdges     = useEdges()
  const { x: vpX, y: vpY, zoom } = useViewport()
  const diagram      = useDiagramStore(s => s.diagram)
  const selection    = useDiagramStore(s => s.selection)
  const setSelection = useDiagramStore(s => s.setSelection)

  if (diagram.exclusiveArcs.length === 0) return null

  // Build a node-lookup from the useNodes() subscription so position changes trigger re-render.
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const resolveNode = (id: string) => nodeMap.get(id) ?? getNode(id)

  const toScreen = (fx: number, fy: number): [number, number] => [fx * zoom + vpX, fy * zoom + vpY]

  return (
    <Panel
      position="top-left"
      style={{ inset: 0, margin: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9 }}
    >
      <svg width="100%" height="100%" style={{ overflow: 'visible', pointerEvents: 'none' }}>
        {diagram.exclusiveArcs.map(arc => {
          const isSelected = selection.arcIds?.includes(arc.id) ?? false
          const stroke     = isSelected ? '#3b82f6' : '#1f2937'
          const sw         = isSelected ? 2 : 1.5

          // Resolve ARM endpoints in flow-space
          const endpoints: Array<{ ax: number; ay: number }> = []
          for (const relId of arc.relationshipIds) {
            const rel = diagram.relationships.find(r => r.id === relId)
            if (!rel) continue
            const ep = getSourceArmEndpoint(rel, allEdges, resolveNode)
            if (ep) endpoints.push(ep)
          }
          if (endpoints.length < 2) return null

          // Sort by angle around entity centre so the arc sweeps in order
          const entityNode = resolveNode(arc.sourceEntityId)
          if (!entityNode) return null
          const cx = entityNode.position.x + (entityNode.measured?.width  ?? 150) / 2
          const cy = entityNode.position.y + (entityNode.measured?.height ?? 100) / 2

          const sorted = [...endpoints].sort(
            (a, b) => Math.atan2(a.ay - cy, a.ax - cx) - Math.atan2(b.ay - cy, b.ax - cx)
          )

          // Quadratic Bezier: first → last sorted point, control point pushed outward
          const p0 = sorted[0]
          const pN = sorted[sorted.length - 1]

          const midFx = (p0.ax + pN.ax) / 2
          const midFy = (p0.ay + pN.ay) / 2
          const odx   = midFx - cx
          const ody   = midFy - cy
          const olen  = Math.sqrt(odx * odx + ody * ody) || 1
          // Push the control point 56px outward from entity centre (in flow-space)
          const cpFx  = midFx + (odx / olen) * 56
          const cpFy  = midFy + (ody / olen) * 56

          const [px0, py0] = toScreen(p0.ax, p0.ay)
          const [pxN, pyN] = toScreen(pN.ax, pN.ay)
          const [cpx, cpy] = toScreen(cpFx, cpFy)

          const arcPath = `M ${px0} ${py0} Q ${cpx} ${cpy} ${pxN} ${pyN}`

          return (
            <g key={arc.id} strokeLinecap="round">
              {/* Invisible wide hit-area — pointer-events only on stroke */}
              <path
                d={arcPath}
                stroke="transparent"
                strokeWidth={18}
                fill="none"
                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                onClick={e => {
                  e.stopPropagation()
                  setSelection({ arcIds: [arc.id], entityIds: [], relationshipIds: [] })
                }}
              />

              {/* Visible arc */}
              <path
                d={arcPath}
                stroke={stroke}
                strokeWidth={sw}
                fill="none"
                style={{ pointerEvents: 'none' }}
              />

              {/* Dot at every ARM endpoint */}
              {sorted.map((ep, i) => {
                const [sx, sy] = toScreen(ep.ax, ep.ay)
                return (
                  <circle
                    key={i}
                    cx={sx}
                    cy={sy}
                    r={4}
                    fill={stroke}
                    style={{ pointerEvents: 'none' }}
                  />
                )
              })}
            </g>
          )
        })}
      </svg>
    </Panel>
  )
}
