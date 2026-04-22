import { useEffect, useState } from 'react'
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react'
import type { Attribute } from '../../types/diagram'
import { useDiagramStore } from '../../store/diagramStore'

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

const SIDES: Position[] = [Position.Top, Position.Right, Position.Bottom, Position.Left]

export type EntityNodeData = { entityId: string }

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
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  onCommit: () => void
  onCancel: () => void
  onEnter?: () => void
  onDeleteEmpty?: () => void
  className?: string
}) {
  return (
    <input
      autoFocus
      value={value}
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

export default function EntityNode({ id, data, selected }: NodeProps) {
  const entityId = (data as EntityNodeData).entityId

  const updateNodeInternals = useUpdateNodeInternals()
  const entity       = useDiagramStore(s => s.diagram.entities.find(e => e.id === entityId))
  const updateEntity = useDiagramStore(s => s.updateEntity)
  const updateAttr   = useDiagramStore(s => s.updateAttribute)
  const addAttr      = useDiagramStore(s => s.addAttribute)
  const deleteAttr   = useDiagramStore(s => s.deleteAttribute)

  const [editingName,   setEditingName]   = useState(false)
  const [nameVal,       setNameVal]       = useState('')
  const [editingAttrId, setEditingAttrId] = useState<string | null>(null)
  const [attrVal,       setAttrVal]       = useState('')

  // Re-sync edge routing after any entity content change (name, attributes) so edges
  // re-attach to the correct handle positions after the DOM has updated.
  useEffect(() => {
    const timer = setTimeout(() => updateNodeInternals(id), 0)
    return () => clearTimeout(timer)
  }, [entity?.name, entity?.attributes, id, updateNodeInternals])

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
    const v = nameVal.trim().toUpperCase()
    if (v) updateEntity(entityId, { name: v })
    useDiagramStore.temporal.getState().resume()
    setEditingName(false)
    updateNodeInternals(id)
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

  // ── Attribute name editing ─────────────────────────────────────

  const startEditAttr = (e: React.MouseEvent, attr: Attribute) => {
    e.stopPropagation()
    setEditingAttrId(attr.id)
    setAttrVal(attr.name)
    useDiagramStore.temporal.getState().pause()
  }

  const commitAttr = (attr: Attribute) => {
    const v = attrVal.trim().toLowerCase()
    if (v) updateAttr(entityId, attr.id, { name: v })
    useDiagramStore.temporal.getState().resume()
    setEditingAttrId(null)
    updateNodeInternals(id)
  }

  const commitAttrAndContinue = (attr: Attribute) => {
    const v = attrVal.trim().toLowerCase()
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

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className={`relative min-w-40 rounded-lg border-2 bg-white shadow-sm select-none ${
      selected ? 'border-blue-400 ring-2 ring-blue-400' : 'border-gray-800'
    }`}>
      {SIDES.map(pos => (
        <span key={pos}>
          <Handle type="source" position={pos} id={`${pos}-source`} style={HANDLE_STYLES[pos]} />
          <Handle type="target" position={pos} id={`${pos}-target`} style={HANDLE_STYLES[pos]} />
        </span>
      ))}

      {/* Entity name — min-h-[40px] so the divider lands at the vertical midpoint */}
      <div
        className="border-b-2 border-gray-800 px-3 min-h-[40px] flex items-center justify-center cursor-text"
        onDoubleClick={startEditName}
      >
        {editingName ? (
          <InlineInput
            value={nameVal}
            onChange={setNameVal}
            onCommit={commitName}
            onCancel={cancelName}
            className="w-full text-center font-bold tracking-wide text-sm uppercase"
          />
        ) : (
          <span className="font-bold tracking-wide text-gray-900 text-sm uppercase">
            {entity.name}
          </span>
        )}
      </div>

      {/* Attribute list — same min-h-[40px] so divider stays centered */}
      <div className="px-3 min-h-[40px] flex flex-col justify-center">
        {sorted.map(attr => (
          <div key={attr.id} className="flex items-baseline gap-2 text-sm font-mono py-0.5">
            <span
              className={[
                'w-3 shrink-0 cursor-pointer',
                attr.kind === 'identifier' ? 'text-gray-900 font-semibold' : 'text-gray-500',
              ].join(' ')}
              onClick={e => cycleKind(e, attr)}
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
                className="flex-1 text-gray-700"
              />
            ) : (
              <span
                className={[
                  'cursor-text',
                  attr.kind === 'identifier' ? 'text-gray-900' : 'text-gray-700',
                ].join(' ')}
                onClick={e => startEditAttr(e, attr)}
              >
                {attr.name}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
