import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  ConnectionMode,
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
import type { Entity, Relationship } from '../../types/diagram'

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
  const guidesRef = useRef<{ x?: number; y?: number }>({})
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
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
  const clampPosition = useCallback((nodeId: string, pos: { x: number; y: number }): { x: number; y: number } => {
    const cur = nodesRef.current
    const node = cur.find(n => n.id === nodeId)
    if (!node || node.parentId) return pos
    const dw = node.measured?.width ?? 150
    const dh = node.measured?.height ?? 100
    let { x, y } = pos
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
      }
    }
    return { x, y }
  }, [])

  // Wrap onNodesChange to write position to store at drag end (creates undo entry).
  // Skip if snap is active — onNodeDragStop will write the snapped position instead.
  const handleNodesChange = useCallback((changes: NodeChange<Node<EntityNodeData>>[]) => {
    onNodesChange(changes)
    changes.forEach(change => {
      if (change.type === 'position' && change.position && change.dragging === false) {
        const g = guidesRef.current
        if (g.x === undefined && g.y === undefined) {
          const clamped = clampPosition(change.id, change.position)
          updateEntity(change.id, { position: clamped })
          if (clamped.x !== change.position.x || clamped.y !== change.position.y) {
            setNodes(prev => prev.map(n => n.id === change.id ? { ...n, position: clamped } : n))
          }
        }
      }
    })
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

  // Detect center alignment and enforce minimum entity spacing during drag.
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

    // Enforce protection zone
    const clamped = clampPosition(draggedNode.id, draggedNode.position)
    const blocked = clamped.x !== draggedNode.position.x || clamped.y !== draggedNode.position.y

    if (blocked) {
      guidesRef.current = {}
      setGuides({})
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
  }, [setNodes, clampPosition])

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
    >
      <Background />
      <Controls />
      <Toolbar />
      <UndoRedo />
      <SnapGuides guides={guides} />
      <ArcOverlay />
    </ReactFlow>
  )
}
