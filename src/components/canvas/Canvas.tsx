import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  ControlButton,
  ConnectionMode,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type OnNodeDrag,
  type OnNodesDelete,
  type OnEdgesDelete,
  type OnSelectionChangeParams,
  type OnConnectStartParams,
} from '@xyflow/react'

import { useDiagramStore } from '../../store/diagramStore'
import EntityNode, { type EntityNodeData } from './EntityNode'
import BarkerEdge from './BarkerEdge'
import Toolbar from '../Toolbar'
import UndoRedo from '../UndoRedo'
import SnapGuides from './SnapGuides'
import ArcOverlay from './ArcOverlay'
import ClipboardHandler, { pasteEntities } from './ClipboardHandler'
import WelcomeModal from '../WelcomeModal'
import type { Entity, Relationship } from '../../types/diagram'
import { getBestSides, getDistributedFraction } from './edgeGeometry'

const nodeTypes = { entityNode: EntityNode }
const edgeTypes = { barkerEdge: BarkerEdge }

const SNAP_THRESHOLD = 8

type LoopCorner = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'

function getLoopCornerFromHandles(src: string, tgt: string): LoopCorner {
  const sides = new Set([src.split('-')[0], tgt.split('-')[0]])
  if (sides.has('right') && sides.has('top'))    return 'top-right'
  if (sides.has('right') && sides.has('bottom')) return 'bottom-right'
  if (sides.has('left')  && sides.has('top'))    return 'top-left'
  if (sides.has('left')  && sides.has('bottom')) return 'bottom-left'
  if (sides.has('right'))  return 'top-right'
  if (sides.has('left'))   return 'top-left'
  if (sides.has('bottom')) return 'bottom-right'
  return 'top-right'
}

function entityToNode(entity: Entity): Node<EntityNodeData> {
  return {
    id:       entity.id,
    type:     'entityNode',
    position: entity.position,
    data:     { entityId: entity.id },
    ...(entity.parentEntityId ? {
      parentId: entity.parentEntityId,
      extent:   'parent' as const,
    } : {}),
  }
}

function relationshipToEdge(rel: Relationship): Edge {
  return {
    id:     rel.id,
    type:   'barkerEdge',
    source: rel.sourceEntityId,
    target: rel.targetEntityId,
    data:   {},
  }
}

export default function Canvas() {
  const diagram              = useDiagramStore(s => s.diagram)
  const selection            = useDiagramStore(s => s.selection)
  const updateEntity         = useDiagramStore(s => s.updateEntity)
  const addRelationship      = useDiagramStore(s => s.addRelationship)
  const deleteEntityAction   = useDiagramStore(s => s.deleteEntity)
  const deleteRelAction      = useDiagramStore(s => s.deleteRelationship)
  const deleteArcAction      = useDiagramStore(s => s.deleteExclusiveArc)
  const setSelection         = useDiagramStore(s => s.setSelection)

  const [nodes, setNodes, onNodesChange] = useNodesState(
    diagram.entities.map(entityToNode)
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    diagram.relationships.map(relationshipToEdge)
  )

  const [guides, setGuides] = useState<{ x?: number; y?: number }>({})
  const [showHelp, setShowHelp] = useState(false)
  const [showAbout, setShowAbout] = useState(() => !localStorage.getItem('sparker_about_seen'))
  const guidesRef = useRef<{ x?: number; y?: number }>({})
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const clipboardRef = useRef<Entity[]>([])
  const connectStartNodeId = useRef<string | null>(null)

  // Sync store entities → RF nodes: add new ones AND update positions / parentId (enables undo sync).
  useEffect(() => {
    setNodes(prev => {
      const entityMap = new Map(diagram.entities.map(e => [e.id, e]))
      const updated = prev.map(n => {
        const e = entityMap.get(n.id)
        if (!e) return n
        const posChanged    = n.position.x !== e.position.x || n.position.y !== e.position.y
        const parentChanged = n.parentId !== e.parentEntityId
        if (!posChanged && !parentChanged) return n
        return {
          ...n,
          position: e.position,
          ...(e.parentEntityId ? { parentId: e.parentEntityId, extent: 'parent' as const } : { parentId: undefined, extent: undefined }),
        }
      })
      const prevIds = new Set(prev.map(n => n.id))
      const toAdd = diagram.entities
        .filter(e => !prevIds.has(e.id))
        .map(entityToNode)
      return toAdd.length > 0 ? [...updated, ...toAdd] : updated
    })
  }, [diagram.entities, setNodes])

  // Append-only sync: new store relationships → RF edges.
  useEffect(() => {
    setEdges(prev => {
      const prevIds = new Set(prev.map(e => e.id))
      const toAdd = diagram.relationships
        .filter(r => !prevIds.has(r.id))
        .map(relationshipToEdge)
      return toAdd.length > 0 ? [...prev, ...toAdd] : prev
    })
  }, [diagram.relationships, setEdges])

  // Clamp position to maintain protection zone against all other entities.
  // Iterates until stable — a push away from one entity must not enter another's zone.
  const clampPosition = useCallback((nodeId: string, pos: { x: number; y: number }): { x: number; y: number } => {
    const cur = nodesRef.current
    const node = cur.find(n => n.id === nodeId)
    if (!node || node.parentId) return pos
    const dw = node.measured?.width ?? 150
    const dh = node.measured?.height ?? 100
    let { x, y } = pos
    let moved = true
    let iter = 0
    while (moved && iter < 10) {
      moved = false
      iter++
      for (const other of cur) {
        if (other.id === nodeId || other.parentId) continue
        const ow = other.measured?.width ?? 150
        const oh = other.measured?.height ?? 100
        const hGap = Math.max(other.position.x - (x + dw), x - (other.position.x + ow))
        const vGap = Math.max(other.position.y - (y + dh), y - (other.position.y + oh))
        if (hGap < PROTECTION && vGap < PROTECTION) {
          const hNeed = PROTECTION - hGap
          const vNeed = PROTECTION - vGap
          if (hNeed <= vNeed) {
            x += x + dw / 2 > other.position.x + ow / 2 ? hNeed : -hNeed
          } else {
            y += y + dh / 2 > other.position.y + oh / 2 ? vNeed : -vNeed
          }
          moved = true
        }
      }
    }
    return { x, y }
  }, [])

  // Wrap onNodesChange to write position to store at drag end (creates undo entry).
  // Skip if snap is active — onNodeDragStop will write the snapped position instead.
  const handleNodesChange = useCallback((changes: NodeChange<Node<EntityNodeData>>[]) => {
    onNodesChange(changes)
    // Collect all position changes with dragging===false
    const writes: { id: string; x: number; y: number }[] = []
    const g = guidesRef.current
    if (g.x === undefined && g.y === undefined) {
      for (const c of changes) {
        if (c.type === 'position' && c.position && c.dragging === false) {
          const multiDrag = changes.filter(
            d => d.type === 'position' && d.dragging === false
          ).length > 1
          const pos = multiDrag ? c.position : clampPosition(c.id, c.position)
          writes.push({ id: c.id, x: pos.x, y: pos.y })
        }
      }
    }

    if (writes.length === 0) return

    // Batch-write all positions atomically to avoid sync useEffect firing
    // between individual writes and snapping other nodes back.
    const entities = writes.length > 1
      ? useDiagramStore.getState().diagram.entities.map(e => {
          const w = writes.find(wr => wr.id === e.id)
          return w ? { ...e, position: { x: w.x, y: w.y } } : e
        })
      : undefined

    if (entities) {
      useDiagramStore.setState(s => ({ diagram: { ...s.diagram, entities } }))
    } else {
      const w = writes[0]
      updateEntity(w.id, { position: { x: w.x, y: w.y } })
    }
  }, [onNodesChange, updateEntity, setNodes, clampPosition])

  // Record the drag-start node so onConnect can normalize source/target.
  // When a user grabs a "target"-type handle, ReactFlow inverts connection.source/target.
  const onConnectStart = useCallback((_: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
    connectStartNodeId.current = params.nodeId ?? null
  }, [])

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return

    // If ReactFlow swapped source/target (user grabbed a target-type handle to start
    // dragging), the actual drag-start node ends up in connection.target. Normalize.
    const dragStart = connectStartNodeId.current
    const swapped = dragStart !== null && dragStart === connection.target
    const src = swapped ? connection.target : connection.source
    const tgt = swapped ? connection.source : connection.target

    const rels = useDiagramStore.getState().diagram.relationships
    const isDupe = rels.some(
      r =>
        (r.sourceEntityId === src && r.targetEntityId === tgt) ||
        (r.sourceEntityId === tgt && r.targetEntityId === src)
    )
    if (isDupe) return

    const isSelf = src === tgt
    addRelationship({
      sourceEntityId: src,
      targetEntityId: tgt,
      sourceEnd: { cardinality: 'one',  optionality: 'optional',                        label: '', uidBar: false },
      targetEnd: { cardinality: 'many', optionality: isSelf ? 'optional' : 'mandatory', label: '', uidBar: false },
      ...(isSelf && {
        loopCorner: getLoopCornerFromHandles(
          connection.sourceHandle ?? '',
          connection.targetHandle ?? '',
        ),
      }),
    })
  }, [addRelationship])

  // Protection zone: minimum border-to-border distance between entities
  const PROTECTION = 2 * 30 // 2 × ARM_LENGTH

  // Detect center and handle-level alignment during drag.
  const onNodeDrag: OnNodeDrag = useCallback((_evt, draggedNode) => {
    if (draggedNode.parentId) return
    const dCx = draggedNode.position.x + (draggedNode.measured?.width  ?? 150) / 2
    const dCy = draggedNode.position.y + (draggedNode.measured?.height ?? 100) / 2
    const newGuides: { x?: number; y?: number } = {}

    nodesRef.current.forEach(node => {
      if (node.id === draggedNode.id || node.parentId) return
      const cx = node.position.x + (node.measured?.width  ?? 150) / 2
      const cy = node.position.y + (node.measured?.height ?? 100) / 2
      if (Math.abs(dCx - cx) < SNAP_THRESHOLD) newGuides.x = cx
      if (Math.abs(dCy - cy) < SNAP_THRESHOLD) newGuides.y = cy
    })

    // Handle-level alignment for connected entities
    function strToPos(s?: string): Position | undefined {
      if (s === 'top') return Position.Top
      if (s === 'right') return Position.Right
      if (s === 'bottom') return Position.Bottom
      if (s === 'left') return Position.Left
      return undefined
    }
    const dw = draggedNode.measured?.width ?? 150, dh = draggedNode.measured?.height ?? 100
    const eId = (draggedNode.data as EntityNodeData)?.entityId
    if (eId) {
      const state = useDiagramStore.getState()
      for (const rel of state.diagram.relationships) {
        const isSrc = rel.sourceEntityId === eId, isTgt = rel.targetEntityId === eId
        if (!isSrc && !isTgt) continue
        const otherId = isSrc ? rel.targetEntityId : rel.sourceEntityId
        const other = nodesRef.current.find(n => n.id === otherId)
        if (!other) continue
        const ow = other.measured?.width ?? 150, oh = other.measured?.height ?? 100
        const drNode = isSrc ? draggedNode : other
        const otNode = isSrc ? other : draggedNode
        const { srcPos, tgtPos } = getBestSides(drNode as Node, otNode as Node,
          strToPos(rel.sourceEnd.preferredSide), strToPos(rel.targetEnd.preferredSide))
        const dSide = isSrc ? srcPos : tgtPos
        const oSide = isSrc ? tgtPos : srcPos
        const dFrac = getDistributedFraction(eId, dSide, rel.id, isSrc, edges,
          (id: string) => nodesRef.current.find(n => n.id === id) as Node | undefined)
        const oFrac = getDistributedFraction(otherId, oSide, rel.id, !isSrc, edges,
          (id: string) => nodesRef.current.find(n => n.id === id) as Node | undefined)
        if (dSide === Position.Left || dSide === Position.Right) {
          const dHy = draggedNode.position.y + dh * dFrac
          const oHy = other.position.y + oh * oFrac
          if (Math.abs(dHy - oHy) < 12) newGuides.y = oHy
        } else {
          const dHx = draggedNode.position.x + dw * dFrac
          const oHx = other.position.x + ow * oFrac
          if (Math.abs(dHx - oHx) < 12) newGuides.x = oHx
        }
        if (newGuides.x !== undefined || newGuides.y !== undefined) break
      }
    }

    // Enforce protection zone (skip during multi-select drag — positions of other
    // dragged nodes aren't reflected in nodesRef yet, causing desync)
    let blocked = false
    let clamped = draggedNode.position
    const selCount = useDiagramStore.getState().selection.entityIds.length
    if (selCount <= 1) {
      clamped = clampPosition(draggedNode.id, draggedNode.position)
      blocked = clamped.x !== draggedNode.position.x || clamped.y !== draggedNode.position.y
    }

    if (blocked) {
      guidesRef.current = newGuides
      setGuides(newGuides)
      setNodes(prev => prev.map(n => {
        if (n.id === draggedNode.id) return { ...n, position: clamped, data: { ...n.data, tooClose: true } }
        if (n.data?.tooClose) return { ...n, data: { ...n.data, tooClose: false } }
        return n
      }))
    } else {
      guidesRef.current = newGuides
      setGuides(newGuides)
      setNodes(prev => {
        const hasClose = prev.some(n => n.data?.tooClose)
        if (!hasClose) return prev
        return prev.map(n => n.data?.tooClose ? { ...n, data: { ...n.data, tooClose: false } } : n)
      })
    }
  }, [setNodes, clampPosition, edges])

  // Apply snap and write final position to store (creates undo entry when snap occurs).
  const onNodeDragStop: OnNodeDrag = useCallback((_evt, node) => {
    setNodes(prev => {
      const hasClose = prev.some(n => n.data?.tooClose)
      if (!hasClose) return prev
      return prev.map(n => n.data?.tooClose ? { ...n, data: { ...n.data, tooClose: false } } : n)
    })
    if (!node.parentId) {
      const g = guidesRef.current
      if (g.x !== undefined || g.y !== undefined) {
        const w = node.measured?.width  ?? 150
        const h = node.measured?.height ?? 100
        let { x, y } = node.position
        if (g.x !== undefined) x = g.x - w / 2
        if (g.y !== undefined) y = g.y - h / 2
        const clamped = clampPosition(node.id, { x, y })
        setNodes(prev => prev.map(n => n.id === node.id ? { ...n, position: clamped } : n))
        updateEntity(node.id, { position: clamped })
      }
    }
    guidesRef.current = {}
    setGuides({})
  }, [updateEntity, setNodes, clampPosition])

  const onNodesDelete: OnNodesDelete = useCallback(deleted => {
    deleted.forEach(n => deleteEntityAction(n.id))
  }, [deleteEntityAction])

  const onEdgesDelete: OnEdgesDelete = useCallback(deleted => {
    deleted.forEach(e => deleteRelAction(e.id))
  }, [deleteRelAction])

  const onSelectionChange = useCallback(({ nodes, edges }: OnSelectionChangeParams) => {
    setSelection({
      entityIds:       nodes.map(n => n.id),
      relationshipIds: edges.map(e => e.id),
      arcIds:          [],   // clicking an RF element clears any arc selection
    })
  }, [setSelection])

  // Global keyboard shortcuts — skip when focus is inside an input/textarea.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const mod = e.ctrlKey || e.metaKey
      if (e.key === 'Escape') {
        e.preventDefault()
        setNodes(prev => prev.map(n => ({ ...n, selected: false })))
        setEdges(prev => prev.map(ed => ({ ...ed, selected: false })))
        setSelection({ entityIds: [], relationshipIds: [], arcIds: [] })
      } else if (mod && e.key === 'a') {
        e.preventDefault()
        setNodes(prev => {
          setSelection({ entityIds: prev.map(n => n.id), relationshipIds: [], arcIds: [] })
          return prev.map(n => ({ ...n, selected: true }))
        })
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selection.arcIds?.length) {
        // Arc selected: delete it (RF deleteKeyCode handles nodes/edges separately)
        e.preventDefault()
        selection.arcIds.forEach(id => deleteArcAction(id))
        setSelection({ arcIds: [] })
      } else if (mod && e.key === 'c' && useDiagramStore.getState().selection.entityIds.length >= 1) {
        e.preventDefault()
        const state = useDiagramStore.getState()
        clipboardRef.current = state.diagram.entities.filter(en => state.selection.entityIds.includes(en.id))
      } else if (mod && e.key === 'v' && clipboardRef.current.length > 0) {
        e.preventDefault()
        pasteEntities(clipboardRef.current)
      }
      // Delete/Backspace for RF nodes/edges: handled by ReactFlow deleteKeyCode prop
      // Ctrl+Z / Ctrl+Shift+Z: handled by UndoRedo.tsx
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [setNodes, setEdges, setSelection, selection.arcIds, deleteArcAction])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={handleNodesChange}
      onEdgesChange={onEdgesChange}
      onConnectStart={onConnectStart}
      onConnect={onConnect}
      onNodeDrag={onNodeDrag}
      onNodeDragStop={onNodeDragStop}
      onNodesDelete={onNodesDelete}
      onEdgesDelete={onEdgesDelete}
      onSelectionChange={onSelectionChange}
      connectionMode={ConnectionMode.Loose}
      deleteKeyCode={['Delete', 'Backspace']}
      fitView
      fitViewOptions={{ padding: 0.3 }}
    >
      <Background />
      <Controls>
        <ControlButton onClick={() => setShowHelp(true)} title="Help">
          <span style={{ fontSize: 14, fontWeight: 'bold', lineHeight: 1 }}>?</span>
        </ControlButton>
      </Controls>
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowHelp(false) }}>
          <div className="bg-white rounded-lg shadow-xl p-6" style={{ width: 520, maxHeight: '80vh', overflow: 'auto' }}>
            <div className="flex items-start justify-between mb-4">
              <p className="text-sm font-semibold text-gray-800">Help &amp; Tips</p>
              <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none cursor-pointer">&times;</button>
            </div>
            <div className="text-xs text-gray-600 space-y-3 leading-relaxed">
              <p className="text-[13px] font-semibold text-blue-700">
                Hover over any control for a brief explanation.
              </p>
              <div>
                <p className="font-semibold text-gray-800 mb-1">Entities</p>
                <p>Click <b>Add Entity</b> (top-left toolbar) or the canvas to create. <b>Double-click</b> the name to rename. <b>Select</b> an entity to reveal <b>up/down arrows</b> (left) to reorder attributes, and <b>data type tags</b> (right) — click a tag to cycle through INT, VARCHAR(255), DATE, etc.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-1">Attributes</p>
                <p>Select an entity and click <b>Add Attribute</b> (top-left). Click the <b>#/*/o</b> prefix to cycle identifier (primary key) / required (NOT NULL) / optional (nullable). Click the name to edit; press <b>Enter</b> to confirm and jump to a new row.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-1">Relationships</p>
                <p>Hover over an entity to reveal four blue <b>handles</b>. <b>Drag</b> from any handle to another entity. Click the line to configure cardinality and optionality in the right-side <b>Properties</b> panel. Click any <b>verb label</b> to flip it to the opposite side of the line.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-1">Custom routing</p>
                <p>Select a relationship to show side dots on each entity and a draggable handle on the line. <b>Click a dot</b> to change the connection side. <b>Drag the handle</b> to reposition the bend freely. Custom elements turn <span style="color:#059669"><b>green</b></span>. <b>Double-click</b> a green dot or handle to reset it.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-1">Canvas</p>
                <p><b>Pan</b> by dragging empty space. <b>Zoom</b> with scroll wheel or bottom-left controls. Entity boxes maintain a 60px clearance from each other (an orange ring warns when too close).</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-1">Keyboard shortcuts</p>
                <p><b>Ctrl/Cmd+Z</b> undo · <b>Ctrl/Cmd+Shift+Z</b> redo · <b>Ctrl/Cmd+A</b> select all · <b>Ctrl/Cmd+C</b> copy selected entity · <b>Ctrl/Cmd+V</b> paste · <b>Delete/Backspace</b> remove selection · <b>Escape</b> deselect all</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-1">Export</p>
                <p>Top-right toolbar: <b>Save JSON</b> to preserve your work, <b>Load JSON</b> to restore, <b>Export PNG/SVG</b> for images, and <b>Export SQL</b> for DDL statements.</p>
              </div>
            </div>
            <hr className="my-3 border-gray-200" />
            <p className="text-xs text-gray-400">
              For complete documentation, see the{' '}
              <a href="https://github.com/testing-tree/SparkER#readme" target="_blank" rel="noopener noreferrer"
                className="underline hover:text-gray-600">README on GitHub</a>.
            </p>
          </div>
        </div>
      )}
      {showAbout && <WelcomeModal onClose={() => setShowAbout(false)} />}
      <Toolbar />
      <UndoRedo />
      <SnapGuides guides={guides} />
      <ArcOverlay />
          <ClipboardHandler />
    </ReactFlow>
  )
}
