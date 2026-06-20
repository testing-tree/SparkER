import { useReactFlow } from '@xyflow/react'
import { useEffect, useRef } from 'react'
import { useDiagramStore } from '../../store/diagramStore'
import type { Entity } from '../../types/diagram'

// Renders inside ReactFlow to get access to fitView.
// Exposes pasteEntity via a module-level ref so the keyboard handler can call it.
let _pasteEntities: ((entities: Entity[]) => void) | null = null

export function pasteEntities(entities: Entity[]) {
  _pasteEntities?.(entities)
}

export default function ClipboardHandler() {
  const { fitView } = useReactFlow()
  const addEntity = useDiagramStore(s => s.addEntity)
  const setSelection = useDiagramStore(s => s.setSelection)
  const addEntityRef = useRef(addEntity)
  addEntityRef.current = addEntity
  const setSelectionRef = useRef(setSelection)
  setSelectionRef.current = setSelection
  const fitViewRef = useRef(fitView)
  fitViewRef.current = fitView

  useEffect(() => {
    _pasteEntities = (entities: Entity[]) => {
      const allEntities = useDiagramStore.getState().diagram.entities
      const newIds: string[] = []
      const PROTECTION = 60
      const existing = allEntities.map(e => ({
        x: e.position.x, y: e.position.y,
        w: e.size?.width ?? 150, h: e.size?.height ?? 100,
      }))
      // Track already-placed pasted entities to avoid overlapping them too
      const placed: { x: number; y: number; w: number; h: number }[] = []

      entities.forEach((entity) => {
        const ow = entity.size?.width ?? 150
        const oh = entity.size?.height ?? 100
        // Start to the right of the original, same Y
        let x = entity.position.x + ow + PROTECTION + 20
        let y = entity.position.y

        // Shift right/down until clear of all existing and previously-placed entities
        const all = [...existing, ...placed]
        let tries = 0
        while (tries < 200) {
          let blocked = false
          for (const other of all) {
            const hGap = Math.max(other.x - (x + ow), x - (other.x + other.w))
            const vGap = Math.max(other.y - (y + oh), y - (other.y + other.h))
            if (hGap < PROTECTION && vGap < PROTECTION) {
              blocked = true
              // Try moving right first, then down if many attempts
              if (tries % 10 < 5) {
                x = other.x + other.w + PROTECTION
              } else {
                x = entity.position.x + ow + PROTECTION + 20
                y += oh + PROTECTION
              }
              break
            }
          }
          if (!blocked) break
          tries++
        }

        const newId = addEntityRef.current({
          name: entity.name,
          attributes: entity.attributes.map(a => ({ ...a, id: crypto.randomUUID() })),
          position: { x, y },
        })
        newIds.push(newId)
        placed.push({ x, y, w: ow, h: oh })
        newIds.push(newId)
      })
      requestAnimationFrame(() => {
        setSelectionRef.current({ entityIds: newIds, relationshipIds: [], arcIds: [] })
        fitViewRef.current({ padding: 0.15, duration: 200 })
      })
    }
    return () => { _pasteEntities = null }
  }, [])

  return null
}
