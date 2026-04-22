import { useReactFlow } from '@xyflow/react'
import { Panel } from '@xyflow/react'

export default function SnapGuides({ guides }: { guides: { x?: number; y?: number } }) {
  const { getViewport } = useReactFlow()

  if (guides.x === undefined && guides.y === undefined) return null

  const { x: vpX, y: vpY, zoom } = getViewport()
  const gx = guides.x !== undefined ? guides.x * zoom + vpX : undefined
  const gy = guides.y !== undefined ? guides.y * zoom + vpY : undefined

  return (
    <Panel
      position="top-left"
      style={{ inset: 0, margin: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}
    >
      <svg width="100%" height="100%" style={{ overflow: 'visible', pointerEvents: 'none' }}>
        {gx !== undefined && (
          <line x1={gx} y1={0} x2={gx} y2={9999}
            stroke="#002FA7" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="6 4" />
        )}
        {gy !== undefined && (
          <line x1={0} y1={gy} x2={9999} y2={gy}
            stroke="#002FA7" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="6 4" />
        )}
      </svg>
    </Panel>
  )
}
