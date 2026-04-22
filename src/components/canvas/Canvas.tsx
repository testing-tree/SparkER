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
  const diagram            = useDiagramStore(s => s.diagram)
  const updateEntity       = useDiagramStore(s => s.updateEntity)
  const addRelationship    = useDiagramStore(s => s.addRelationship)
  const deleteEntityAction = useDiagramStore(s => s.deleteEntity)
  const deleteRelAction    = useDiagramStore(s => s.deleteRelationship)
  const setSelection       = useDiagramStore(s => s.setSelection)

  const [nodes, setNodes, onNodesChange] = useNodesState(
    diagram.entities.map(entityToNode)
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    diagram.relationships.map(relationshipToEdge)
  )

  const [guides, setGuides] = useState<{ x?: number; y?: number }>({})
  const guidesRef = useRef<{ x?: number; y?: number }>({})
  const connectStartNodeId = useRef<string | null>(null)

  // Sync store entities → RF nodes: add new ones AND update positions (enables undo sync).
  useEffect(() => {
    setNodes(prev => {
      const entityMap = new Map(diagram.entities.map(e => [e.id, e]))
      const updated = prev.map(n => {
        const e = entityMap.get(n.id)
        if (!e) return n
        if (n.position.x === e.position.x && n.position.y === e.position.y) return n
        return { ...n, position: e.position }
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

  // Wrap onNodesChange to write position to store at drag end (creates undo entry).
  // Skip if snap is active — onNodeDragStop will write the snapped position instead.
  const handleNodesChange = useCallback((changes: NodeChange<Node<EntityNodeData>>[]) => {
    onNodesChange(changes)
    changes.forEach(change => {
      if (change.type === 'position' && change.position && change.dragging === false) {
        const g = guidesRef.current
        if (g.x === undefined && g.y === undefined) {
          updateEntity(change.id, { position: change.position })
        }
      }
    })
  }, [onNodesChange, updateEntity])

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
      sourceEnd: { cardinality: 'one',                    optionality: isSelf ? 'optional' : 'mandatory', label: '', uidBar: false },
      targetEnd: { cardinality: isSelf ? 'many' : 'one', optionality: isSelf ? 'optional' : 'mandatory', label: '', uidBar: false },
      ...(isSelf && {
        loopCorner: getLoopCornerFromHandles(
          connection.sourceHandle ?? '',
          connection.targetHandle ?? '',
        ),
      }),
    })
  }, [addRelationship])

  // Detect center alignment with other nodes during drag.
  const onNodeDrag: OnNodeDrag = useCallback((_evt, draggedNode) => {
    const dCx = draggedNode.position.x + (draggedNode.measured?.width  ?? 150) / 2
    const dCy = draggedNode.position.y + (draggedNode.measured?.height ?? 100) / 2
    const newGuides: { x?: number; y?: number } = {}
    nodes.forEach(node => {
      if (node.id === draggedNode.id) return
      const cx = node.position.x + (node.measured?.width  ?? 150) / 2
      const cy = node.position.y + (node.measured?.height ?? 100) / 2
      if (Math.abs(dCx - cx) < SNAP_THRESHOLD) newGuides.x = cx
      if (Math.abs(dCy - cy) < SNAP_THRESHOLD) newGuides.y = cy
    })
    guidesRef.current = newGuides
    setGuides(newGuides)
  }, [nodes])

  // Apply snap and write final position to store (creates undo entry when snap occurs).
  const onNodeDragStop: OnNodeDrag = useCallback((_evt, node) => {
    const g = guidesRef.current
    if (g.x !== undefined || g.y !== undefined) {
      const w = node.measured?.width  ?? 150
      const h = node.measured?.height ?? 100
      let { x, y } = node.position
      if (g.x !== undefined) x = g.x - w / 2
      if (g.y !== undefined) y = g.y - h / 2
      setNodes(prev => prev.map(n => n.id === node.id ? { ...n, position: { x, y } } : n))
      updateEntity(node.id, { position: { x, y } })
    }
    guidesRef.current = {}
    setGuides({})
  }, [updateEntity, setNodes])

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
        setSelection({ entityIds: [], relationshipIds: [] })
      } else if (mod && e.key === 'a') {
        e.preventDefault()
        setNodes(prev => {
          setSelection({ entityIds: prev.map(n => n.id), relationshipIds: [] })
          return prev.map(n => ({ ...n, selected: true }))
        })
      }
      // Delete/Backspace: handled by ReactFlow deleteKeyCode prop + onNodesDelete/onEdgesDelete
      // Ctrl+Z / Ctrl+Shift+Z: handled by UndoRedo.tsx
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [setNodes, setEdges, setSelection])

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
    </ReactFlow>
  )
}
