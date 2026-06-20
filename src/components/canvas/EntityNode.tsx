import { useEffect, useState } from 'react'
import { Handle, Position, useReactFlow, useUpdateNodeInternals, type NodeProps } from '@xyflow/react'
import type { Attribute } from '../../types/diagram'
import { useDiagramStore } from '../../store/diagramStore'
import { getBestSides } from './edgeGeometry'

// ── Constants ─────────────────────────────────────────────────────────────────

const KIND_PREFIX: Record<Attribute['kind'], string> = {
  identifier: '#',
  required:   '*',
  optional:   'o',
}

const KIND_CYCLE: Record<Attribute['kind'], Attribute['kind']> = {
  identifier: 'required',
  required:   'optional',
  optional:   'identifier',
}

const DATA_TYPES = [undefined, 'INT', 'VARCHAR(255)', 'TEXT', 'DATE', 'BOOLEAN', 'DECIMAL(10,2)', 'FLOAT']

const SIDES: Position[] = [Position.Top, Position.Right, Position.Bottom, Position.Left]

export type EntityNodeData = { entityId: string; tooClose?: boolean }

// ── Handle styles — center each dot precisely on its border edge ──────────────

const BASE_HANDLE: React.CSSProperties = {
  width:        10,
  height:       10,
  borderRadius: '50%',
  background:   '#60a5fa',
  border:       '2px solid white',
  opacity:      0,
  transition:   'opacity 150ms ease',
}

const HANDLE_STYLES: Record<Position, React.CSSProperties> = {
  [Position.Top]:    { ...BASE_HANDLE, top:    0,   left: '50%', transform: 'translate(-50%, -50%)' },
  [Position.Bottom]: { ...BASE_HANDLE, bottom: 0,   left: '50%', transform: 'translate(-50%,  50%)' },
  [Position.Left]:   { ...BASE_HANDLE, left:   0,   top:  '50%', transform: 'translate(-50%, -50%)' },
  [Position.Right]:  { ...BASE_HANDLE, right:  0,   top:  '50%', transform: 'translate( 50%, -50%)' },
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InlineInput({
  value,
  onChange,
  onCommit,
  onCancel,
  onEnter,
  onDeleteEmpty,
  maxLength,
  size,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  onCommit: () => void
  onCancel: () => void
  onEnter?: () => void
  onDeleteEmpty?: () => void
  maxLength?: number
  size?: number
  className?: string
}) {
  return (
    <input
      autoFocus
      value={value}
      maxLength={maxLength}
      size={size}
      onChange={e => onChange(e.target.value)}
      onFocus={e => e.target.select()}
      onBlur={onCommit}
      onKeyDown={e => {
        if (e.key === 'Enter')  { e.preventDefault(); (onEnter ?? onCommit)() }
        if (e.key === 'Escape') { e.preventDefault(); onCancel() }
        if ((e.key === 'Backspace' || e.key === 'Delete') && value === '' && onDeleteEmpty) {
          e.preventDefault(); onDeleteEmpty()
        }
        e.stopPropagation()
      }}
      className={`bg-transparent outline-none ${className}`}
    />
  )
}

// ── Main component ────────────────────────────────────────────────────────────

// Separator Y for the super-entity divider line (same formula used in addSubEntity)
function separatorY(attrCount: number): number {
  const NAME_H   = 42
  const ATTR_ROW = 22
  const ATTR_PAD = 8
  const attrH    = Math.max(40, attrCount * ATTR_ROW + ATTR_PAD)
  return Math.max(120, NAME_H + attrH + 8)
}

export default function EntityNode({ id, data, selected }: NodeProps) {
  const entityId = (data as EntityNodeData).entityId
  const isWarned = !!(data as EntityNodeData).tooClose

  const updateNodeInternals = useUpdateNodeInternals()
  const { fitView, getNode } = useReactFlow()
  const entity         = useDiagramStore(s => s.diagram.entities.find(e => e.id === entityId))
  const hasSubEntities = useDiagramStore(s => s.diagram.entities.some(e => e.parentEntityId === entityId))
  const updateEntity     = useDiagramStore(s => s.updateEntity)
  const updateAttr       = useDiagramStore(s => s.updateAttribute)
  const addAttr          = useDiagramStore(s => s.addAttribute)
  const deleteAttr       = useDiagramStore(s => s.deleteAttribute)
  const reorderAttributes = useDiagramStore(s => s.reorderAttributes)
  const selection         = useDiagramStore(s => s.selection)
  const diagram           = useDiagramStore(s => s.diagram)
  const updateRelationshipEnd = useDiagramStore(s => s.updateRelationshipEnd)

  // Compute the active side for this entity when a relationship is selected
  let activeSide: Position | null = null
  let edgeEndKey: 'source' | 'target' | null = null
  let selectedRelId: string | null = null

  do {
    const selRelId = selection.relationshipIds[0]
    if (!selRelId) break
    const rel = diagram.relationships.find(r => r.id === selRelId)
    if (!rel) break
    const isSrc = rel.sourceEntityId === entityId
    const isTgt = rel.targetEntityId === entityId
    if (!isSrc && !isTgt) break
    const otherId = isSrc ? rel.targetEntityId : rel.sourceEntityId
    const thisNode = getNode(id)
    const otherNode = getNode(otherId)
    if (!thisNode || !otherNode) break

    const strToPos = (s?: string): Position | undefined => {
      if (s === 'top') return Position.Top
      if (s === 'right') return Position.Right
      if (s === 'bottom') return Position.Bottom
      if (s === 'left') return Position.Left
      return undefined
    }
    const relSrcNode = isSrc ? thisNode : otherNode
    const relTgtNode = isSrc ? otherNode : thisNode
    const srcPref = strToPos(rel.sourceEnd.preferredSide)
    const tgtPref = strToPos(rel.targetEnd.preferredSide)
    const { srcPos, tgtPos } = getBestSides(relSrcNode, relTgtNode, srcPref, tgtPref)
    activeSide = isSrc ? srcPos : tgtPos
    edgeEndKey = isSrc ? 'source' : 'target'
    selectedRelId = selRelId
  } while (false)

  const [editingName,   setEditingName]   = useState(false)
  const [nameVal,       setNameVal]       = useState('')
  const [editingAttrId, setEditingAttrId] = useState<string | null>(null)
  const [attrVal,       setAttrVal]       = useState('')

  // Re-sync edge routing after any entity content change so edges re-attach correctly.
  useEffect(() => {
    const timer = setTimeout(() => updateNodeInternals(id), 0)
    return () => clearTimeout(timer)
  }, [entity?.name, entity?.attributes, entity?.size, id, updateNodeInternals])

  if (!entity) return null

  const sorted = [...entity.attributes].sort((a, b) => a.order - b.order)

  // ── Name editing ───────────────────────────────────────────────

  const startEditName = (e: React.MouseEvent) => {
    e.stopPropagation()
    setNameVal(entity.name)
    setEditingName(true)
    useDiagramStore.temporal.getState().pause()
  }

  const commitName = () => {
    const v = nameVal.trim().replace(/ /g, '_').toUpperCase()
    if (v) updateEntity(entityId, { name: v })
    useDiagramStore.temporal.getState().resume()
    setEditingName(false)
    updateNodeInternals(id)
    setTimeout(() => fitView({ padding: 0.15, duration: 200 }), 50)
  }

  const cancelName = () => {
    useDiagramStore.temporal.getState().resume()
    setEditingName(false)
  }

  // ── Attribute kind cycling ─────────────────────────────────────

  const cycleKind = (e: React.MouseEvent, attr: Attribute) => {
    e.stopPropagation()
    updateAttr(entityId, attr.id, { kind: KIND_CYCLE[attr.kind] })
    updateNodeInternals(id)
  }

  const cycleDataType = (e: React.MouseEvent, attr: Attribute) => {
    e.stopPropagation()
    const idx = DATA_TYPES.indexOf(attr.dataTypeHint)
    const next = DATA_TYPES[(idx + 1) % DATA_TYPES.length]
    updateAttr(entityId, attr.id, { dataTypeHint: next })
    updateNodeInternals(id)
  }

  // ── Attribute name editing ─────────────────────────────────────

  const startEditAttr = (e: React.MouseEvent, attr: Attribute) => {
    e.stopPropagation()
    setEditingAttrId(attr.id)
    setAttrVal(attr.name)
    useDiagramStore.temporal.getState().pause()
  }

  const commitAttr = (attr: Attribute) => {
    const v = attrVal.trim().replace(/ /g, '_').slice(0, 64).toLowerCase()
    if (v) updateAttr(entityId, attr.id, { name: v })
    useDiagramStore.temporal.getState().resume()
    setEditingAttrId(null)
    updateNodeInternals(id)
    setTimeout(() => fitView({ padding: 0.15, duration: 200 }), 50)
  }

  const commitAttrAndContinue = (attr: Attribute) => {
    const v = attrVal.trim().replace(/ /g, '_').slice(0, 64).toLowerCase()
    if (v) updateAttr(entityId, attr.id, { name: v })
    useDiagramStore.temporal.getState().resume()
    // Add next attribute (always 'required' since at least one already exists) and edit it.
    const newId = addAttr(entityId, { name: 'attribute', kind: 'required' })
    useDiagramStore.temporal.getState().pause()
    setAttrVal('attribute')
    setEditingAttrId(newId)
    updateNodeInternals(id)
  }

  const cancelAttr = () => {
    useDiagramStore.temporal.getState().resume()
    setEditingAttrId(null)
  }

  const deleteEditingAttr = (attr: Attribute) => {
    useDiagramStore.temporal.getState().resume()
    deleteAttr(entityId, attr.id)
    setEditingAttrId(null)
    updateNodeInternals(id)
  }

  // ── Attribute reorder ─────────────────────────────────────────

  const moveAttr = (attrId: string, dir: -1 | 1) => {
    const allIds = sorted.map(a => a.id)
    const idx = allIds.indexOf(attrId)
    if (idx === -1) return
    const tgt = idx + dir
    if (tgt < 0 || tgt >= allIds.length) return
    allIds.splice(idx, 1)
    allIds.splice(tgt, 0, attrId)
    reorderAttributes(entityId, allIds)
    updateNodeInternals(id)
  }

  // ── Render ─────────────────────────────────────────────────────

  const isSuperEntity = hasSubEntities
  const isSubEntity   = !!entity.parentEntityId

  return (
    <div
      className={`relative rounded-lg border-2 bg-white shadow-sm select-none ${
        isWarned
          ? 'border-orange-400 ring-2 ring-orange-400'
          : selected
          ? 'border-blue-400 ring-[0.5px] ring-blue-400'
          : isSubEntity
            ? 'border-gray-500'
            : 'border-gray-800'
      }`}
      style={entity.size
        ? { width: entity.size.width, height: entity.size.height }
        : { minWidth: 160 }
      }
    >
      {SIDES.map(pos => (
        <span key={pos}>
          <Handle type="source" position={pos} id={`${pos}-source`} style={HANDLE_STYLES[pos]} />
          <Handle type="target" position={pos} id={`${pos}-target`} style={HANDLE_STYLES[pos]} />
        </span>
      ))}

      {/* Side indicators — visible when a relationship connecting this entity is selected */}
      {activeSide !== null && SIDES.map(pos => {
        const isActive = pos === activeSide
        const sideValue = pos === Position.Top ? 'top' : pos === Position.Right ? 'right' : pos === Position.Bottom ? 'bottom' : 'left'
        const posClass =
          pos === Position.Top    ? 'absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2' :
          pos === Position.Bottom ? 'absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2' :
          pos === Position.Left   ? 'absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2' :
                                    'absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2'
        const tip = isActive ? 'Connected side' : `Switch to ${sideValue}`
        return (
          <div
            key={`ind-${pos}`}
            className={posClass}
            style={{
              width: 10, height: 10,
              borderRadius: '50%',
              background: isActive ? '#60a5fa' : '#d1d5db',
              border: '2px solid white',
              cursor: isActive ? 'default' : 'pointer',
              zIndex: 10,
              transition: 'background 150ms',
            }}
            title={tip}
            onClick={isActive ? undefined : (e) => {
              e.stopPropagation()
              updateRelationshipEnd(selectedRelId!, edgeEndKey!, { preferredSide: sideValue })
            }}
          />
        )
      })}

      {/* Entity name */}
      <div
        className="px-3 pt-3 pb-2 flex items-center justify-center cursor-text w-full"
        onDoubleClick={startEditName}
        title="Double-click to rename"
      >
        {editingName ? (
          <InlineInput
            value={nameVal}
            onChange={setNameVal}
            onCommit={commitName}
            onCancel={cancelName}
            maxLength={64}
            className="w-full text-center font-bold tracking-wide text-lg uppercase min-w-0"
            size={1}
          />
        ) : (
          <span className="font-bold tracking-wide text-gray-900 text-lg uppercase">
            {entity.name}
          </span>
        )}
      </div>

      {/* Attribute list */}
      <div className="px-3 pb-3 flex flex-col">
        {sorted.map((attr, i) => (
          <div key={attr.id}
            className="relative flex items-baseline gap-1.5 text-sm font-mono py-0.5"
          >
            {/* ── Reorder arrows (left, outside box) – only when entity selected ── */}
            {selected && !editingAttrId && (
              <span
                className="absolute flex flex-col text-[7px] leading-none select-none bg-white rounded-sm px-0.5 py-px shadow-sm"
                style={{ left: -32, top: '50%', transform: 'translateY(-50%)' }}
              >
                <button
                  className="text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-default"
                  disabled={i === 0}
                  onClick={e => { e.stopPropagation(); moveAttr(attr.id, -1) }}
                >▲</button>
                <button
                  className="text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-default"
                  disabled={i === sorted.length - 1}
                  onClick={e => { e.stopPropagation(); moveAttr(attr.id, 1) }}
                >▼</button>
              </span>
            )}

            <span
              className={[
                'w-3 shrink-0 cursor-pointer',
                attr.kind === 'identifier' ? 'text-gray-900 font-semibold' : 'text-gray-500',
              ].join(' ')}
              onClick={e => cycleKind(e, attr)}
              title={`${attr.kind === 'identifier' ? 'Identifier' : attr.kind === 'required' ? 'Required' : 'Optional'} — click to cycle`}
            >
              {KIND_PREFIX[attr.kind]}
            </span>

            {editingAttrId === attr.id ? (
              <InlineInput
                value={attrVal}
                onChange={setAttrVal}
                onCommit={() => commitAttr(attr)}
                onEnter={() => commitAttrAndContinue(attr)}
                onCancel={cancelAttr}
                onDeleteEmpty={() => deleteEditingAttr(attr)}
                maxLength={64}
                className="flex-1 text-gray-700"
              />
            ) : (
              <span
                className={[
                  'cursor-text',
                  attr.kind === 'identifier' ? 'text-gray-900' : 'text-gray-700',
                ].join(' ')}
                onClick={e => startEditAttr(e, attr)}
                title="Click to edit — Enter to confirm and add next row"
              >
                {attr.name}
              </span>
            )}

            {/* ── Data type (right, outside box) – only when entity selected ── */}
            {selected && !editingAttrId && (
              <span
                onClick={e => cycleDataType(e, attr)}
                className={[
                  'absolute text-[9px] font-mono cursor-pointer select-none whitespace-nowrap bg-white rounded-sm px-0.5 py-px shadow-sm',
                  attr.dataTypeHint ? 'text-blue-600 font-medium' : 'text-gray-400 hover:text-gray-600',
                ].join(' ')}
                style={{ left: 'calc(100% + 24px)', top: '50%', transform: 'translateY(-50%)' }}
              >
                {attr.dataTypeHint ?? 'auto'}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Super-entity separator — horizontal divider below the attribute zone */}
      {isSuperEntity && (
        <div
          className="absolute left-0 right-0 border-t-2 border-gray-800 pointer-events-none"
          style={{ top: separatorY(sorted.length) }}
        >
          <span className="absolute left-3 top-0.5 text-[9px] font-medium text-gray-400 uppercase tracking-widest select-none">
            sub-entities
          </span>
        </div>
      )}
    </div>
  )
}
