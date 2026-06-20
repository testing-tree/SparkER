import { useEffect, useState } from 'react'
import { useDiagramStore } from '../../store/diagramStore'
import type { Relationship, RelationshipEnd } from '../../types/diagram'

// ── Button styles ─────────────────────────────────────────────────────────────

const DEL_BTN = 'px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 cursor-pointer w-full text-left'
const ACT_BTN = 'w-full px-2 py-1.5 text-xs font-medium text-left bg-white border border-gray-200 rounded hover:bg-gray-50 active:bg-gray-100 cursor-pointer text-gray-700'

// ── Sub-components ────────────────────────────────────────────────────────────

function Toggle({
  label,
  options,
  value,
  onChange,
  titles,
}: {
  label: string
  options: [string, string]
  value: string
  onChange: (v: string) => void
  titles?: [string, string]
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
      <div className="flex rounded border border-gray-300 overflow-hidden text-xs">
        {options.map((opt, i) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            title={titles?.[i]}
            className={[
              'px-2 py-0.5 cursor-pointer',
              value === opt
                ? 'bg-gray-800 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50',
            ].join(' ')}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function EndSection({
  title,
  entityName,
  end,
  relId,
  endKey,
}: {
  title: string
  entityName?: string
  end: RelationshipEnd
  relId: string
  endKey: 'source' | 'target'
}) {
  const updateRelationshipEnd = useDiagramStore(s => s.updateRelationshipEnd)
  const [labelVal, setLabelVal] = useState(end.label)

  useEffect(() => { setLabelVal(end.label) }, [end.label])

  const commitLabel = () => updateRelationshipEnd(relId, endKey, { label: labelVal })

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
      {entityName && (
        <p className="text-sm font-bold text-gray-900 tracking-wide">{entityName}</p>
      )}
      <Toggle
        label="Cardinality"
        options={['one', 'many']}
        titles={['Single entity', 'Multiple entities (crow\'s foot)']}
        value={end.cardinality}
        onChange={v => updateRelationshipEnd(relId, endKey, { cardinality: v as 'one' | 'many' })}
      />
      <Toggle
        label="Optionality"
        options={['mandatory', 'optional']}
        titles={['Required (solid line)', 'Optional (dashed line)']}
        value={end.optionality}
        onChange={v => updateRelationshipEnd(relId, endKey, { optionality: v as 'mandatory' | 'optional' })}
      />
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-20 shrink-0">Label</span>
        <input
          value={labelVal}
          onChange={e => setLabelVal(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitLabel() } }}
          className="flex-1 min-w-0 text-xs border border-gray-300 rounded px-2 py-0.5 outline-none focus:border-gray-500"
          placeholder="(none)"
          title="Relationship verb label"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-20 shrink-0">UID bar</span>
        <input
          type="checkbox"
          checked={end.uidBar}
          onChange={e => updateRelationshipEnd(relId, endKey, { uidBar: e.target.checked })}
          className="cursor-pointer"
          title="Weak entity identification bar"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-20 shrink-0">Side</span>
        {end.preferredSide ? (
          <button
            onClick={() => updateRelationshipEnd(relId, endKey, { preferredSide: undefined })}
            className="px-2 py-0.5 bg-white text-gray-600 hover:bg-gray-50 cursor-pointer border border-gray-300 rounded text-xs"
            title="Click to restore auto-routing"
          >{end.preferredSide}</button>
        ) : (
          <button
            className="px-2 py-0.5 bg-gray-800 text-white cursor-pointer border border-gray-800 rounded text-xs"
            title="Click a side dot on the entity box"
          >auto</button>
        )}
      </div>
    </div>
  )
}

function LabelInput({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onCommit: () => void
  title?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onCommit() } }}
        className="flex-1 min-w-0 text-xs border border-gray-300 rounded px-2 py-0.5 outline-none focus:border-gray-500"
        placeholder="(none)"
        title={title}
      />
    </div>
  )
}

function SelfRefSection({ rel }: { rel: Relationship }) {
  const updateRelationshipEnd = useDiagramStore(s => s.updateRelationshipEnd)
  const entity = useDiagramStore(s =>
    s.diagram.entities.find(e => e.id === rel.sourceEntityId)
  )

  const [exitLabel,  setExitLabel]  = useState(rel.sourceEnd.label)
  const [entryLabel, setEntryLabel] = useState(rel.targetEnd.label)

  useEffect(() => { setExitLabel(rel.sourceEnd.label)  }, [rel.sourceEnd.label])
  useEffect(() => { setEntryLabel(rel.targetEnd.label) }, [rel.targetEnd.label])

  const commitExit  = () => updateRelationshipEnd(rel.id, 'source', { label: exitLabel })
  const commitEntry = () => updateRelationshipEnd(rel.id, 'target', { label: entryLabel })

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recursive</p>
      {entity && <p className="text-sm font-bold text-gray-900">{entity.name}</p>}
      <Toggle
        label="Cardinality"
        options={['one', 'many']}
        titles={['Single entity', 'Multiple entities (crow\'s foot)']}
        value={rel.targetEnd.cardinality}
        onChange={v => updateRelationshipEnd(rel.id, 'target', { cardinality: v as 'one' | 'many' })}
      />
      <Toggle
        label="Exit opt."
        options={['mandatory', 'optional']}
        titles={['Required exit (solid)', 'Optional exit (dashed)']}
        value={rel.sourceEnd.optionality}
        onChange={v => updateRelationshipEnd(rel.id, 'source', { optionality: v as 'mandatory' | 'optional' })}
      />
      <Toggle
        label="Entry opt."
        options={['mandatory', 'optional']}
        titles={['Required entry (solid)', 'Optional entry (dashed)']}
        value={rel.targetEnd.optionality}
        onChange={v => updateRelationshipEnd(rel.id, 'target', { optionality: v as 'mandatory' | 'optional' })}
      />
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-20 shrink-0">UID bar</span>
        <input
          type="checkbox"
          checked={rel.targetEnd.uidBar}
          onChange={e => updateRelationshipEnd(rel.id, 'target', { uidBar: e.target.checked })}
          className="cursor-pointer"
        />
      </div>
      <LabelInput label="Exit label"  value={exitLabel}  onChange={setExitLabel}  onCommit={commitExit}  title="Verb label on the exit side" />
      <LabelInput label="Entry label" value={entryLabel} onChange={setEntryLabel} onCommit={commitEntry} title="Verb label on the entry side" />
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function PropertyPanel() {
  const selection        = useDiagramStore(s => s.selection)
  const diagram          = useDiagramStore(s => s.diagram)
  const deleteArc        = useDiagramStore(s => s.deleteExclusiveArc)
  const setSelection     = useDiagramStore(s => s.setSelection)
  const addRelationship  = useDiagramStore(s => s.addRelationship)
  const addEntity        = useDiagramStore(s => s.addEntity)

  const selectedEntityId = selection.entityIds[0] ?? null
  const selectedRelId    = selection.relationshipIds[0] ?? null
  const selectedArcId    = selection.arcIds?.[0] ?? null

  const entity = selectedEntityId
    ? diagram.entities.find(e => e.id === selectedEntityId) ?? null
    : null
  const rel = selectedRelId
    ? diagram.relationships.find(r => r.id === selectedRelId) ?? null
    : null
  const arc = selectedArcId
    ? diagram.exclusiveArcs.find(a => a.id === selectedArcId) ?? null
    : null

  const hasSelection = !!(entity || rel || arc)

  return (
    <>
    <div
      className={`shrink-0 h-full bg-white flex flex-col overflow-hidden transition-all duration-200 ease-in-out${hasSelection ? ' border-l border-gray-200' : ''}`}
      style={{ width: hasSelection ? 280 : 0, minWidth: hasSelection ? 280 : 0 }}
    >
      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ width: 280 }}>
      {hasSelection && (
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Properties</p>
      )}

      {/* ── Entity section ── */}
      {entity && (() => {
        const superEntity = entity.parentEntityId
          ? diagram.entities.find(e => e.id === entity.parentEntityId)
          : null
        const subEntities = diagram.entities.filter(e => e.parentEntityId === entity.id)

        return (
          <div className="space-y-3">
            {/* Identity */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {superEntity ? 'Sub-entity' : subEntities.length > 0 ? 'Super-entity' : 'Entity'}
              </p>
              <p className="text-sm font-bold text-gray-900">{entity.name}</p>
              {superEntity && (
                <p className="text-xs text-gray-500">
                  of <span className="font-semibold text-gray-700">{superEntity.name}</span>
                </p>
              )}
              {subEntities.length > 0 && (
                <p className="text-xs text-gray-500">
                  {subEntities.length} sub-entit{subEntities.length === 1 ? 'y' : 'ies'}:{' '}
                  {subEntities.map(s => s.name).join(', ')}
                </p>
              )}
              <p className="text-xs text-gray-400 italic">Double-click on canvas to rename.</p>
            </div>

            <hr className="border-gray-100" />

            {/* Actions */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Actions</p>
              <button
                className={ACT_BTN}
                title="Add a self-referencing relationship"
                onClick={() => addRelationship({
                  sourceEntityId: entity.id,
                  targetEntityId: entity.id,
                  sourceEnd: { cardinality: 'one',  optionality: 'optional', label: '', uidBar: false },
                  targetEnd: { cardinality: 'many', optionality: 'optional', label: '', uidBar: false },
                })}
              >
                Recursive
              </button>
              <button
                className={ACT_BTN}
                title="Create an intersection entity for many-to-many"
                onClick={() => {
                  const name = window.prompt('Intersection entity name:')
                  if (!name?.trim()) return
                  const base = entity.position
                  const intersectionId = addEntity({
                    name: name.trim().toUpperCase(),
                    attributes: [],
                    position: { x: base.x + 200, y: base.y - 150 },
                  })
                  const ends = {
                    sourceEnd: { cardinality: 'one'  as const, optionality: 'optional'  as const, label: '', uidBar: false },
                    targetEnd: { cardinality: 'many' as const, optionality: 'mandatory' as const, label: '', uidBar: false },
                  }
                  addRelationship({ sourceEntityId: entity.id, targetEntityId: intersectionId, ...ends })
                  addRelationship({ sourceEntityId: entity.id, targetEntityId: intersectionId, ...ends })
                }}
              >
                Recursive m:m
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── Relationship section ── */}
      {rel && (
        rel.sourceEntityId === rel.targetEntityId
          ? <SelfRefSection rel={rel} />
          : (() => {
              const srcEntity = diagram.entities.find(e => e.id === rel.sourceEntityId)
              const tgtEntity = diagram.entities.find(e => e.id === rel.targetEntityId)
              return (
                <div className="space-y-4">
                  <EndSection title="Source end" entityName={srcEntity?.name} end={rel.sourceEnd} relId={rel.id} endKey="source" />
                  <hr className="border-gray-200" />
                  {rel.sourceEnd.cardinality === 'many' && rel.targetEnd.cardinality === 'many' && (
                    <div className="rounded border border-yellow-400 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 leading-snug">
                      ⚠ Barker notation does not allow direct many-to-many.
                      Add an intersection entity between these two.
                    </div>
                  )}
                  <EndSection title="Target end" entityName={tgtEntity?.name} end={rel.targetEnd} relId={rel.id} endKey="target" />
                </div>
              )
            })()
      )}

      {/* ── Exclusive arc section ── */}
      {arc && (() => {
        const srcEntity = diagram.entities.find(e => e.id === arc.sourceEntityId)
        const targets = arc.relationshipIds
          .map(rid => diagram.relationships.find(r => r.id === rid))
          .filter(Boolean)
          .map(r => diagram.entities.find(e => e.id === r!.targetEntityId)?.name ?? '?')
        return (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Exclusive Arc</p>
            {srcEntity && (
              <p className="text-xs text-gray-500">
                on <span className="font-semibold text-gray-700">{srcEntity.name}</span>
              </p>
            )}
            <div className="space-y-0.5">
              {targets.map((name, i) => (
                <p key={i} className="text-xs text-gray-700">• {name}</p>
              ))}
            </div>
            <button
              className={DEL_BTN}
              title="Remove this exclusive arc constraint"
              onClick={() => {
                deleteArc(arc.id)
                setSelection({ arcIds: [] })
              }}
            >
              Delete Arc
            </button>
          </div>
        )
      })()}

      </div>{/* end scrollable content */}
    </div>
    </>
  )
}
