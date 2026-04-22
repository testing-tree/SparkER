import { useState, useEffect } from 'react'
import { useDiagramStore } from '../../store/diagramStore'
import type { Relationship, RelationshipEnd } from '../../types/diagram'

function Toggle({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: [string, string]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
      <div className="flex rounded border border-gray-300 overflow-hidden text-xs">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
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

  useEffect(() => {
    setLabelVal(end.label)
  }, [end.label])

  const commitLabel = () => {
    updateRelationshipEnd(relId, endKey, { label: labelVal })
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
      {entityName && (
        <p className="text-sm font-bold text-gray-900 tracking-wide">{entityName}</p>
      )}
      <Toggle
        label="Cardinality"
        options={['one', 'many']}
        value={end.cardinality}
        onChange={v => updateRelationshipEnd(relId, endKey, { cardinality: v as 'one' | 'many' })}
      />
      <Toggle
        label="Optionality"
        options={['mandatory', 'optional']}
        value={end.optionality}
        onChange={v => updateRelationshipEnd(relId, endKey, { optionality: v as 'mandatory' | 'optional' })}
      />
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-20 shrink-0">Label</span>
        <input
          value={labelVal}
          onChange={e => setLabelVal(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commitLabel() }
          }}
          className="flex-1 min-w-0 text-xs border border-gray-300 rounded px-2 py-0.5 outline-none focus:border-gray-500"
          placeholder="(none)"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-20 shrink-0">UID bar</span>
        <input
          type="checkbox"
          checked={end.uidBar}
          onChange={e => updateRelationshipEnd(relId, endKey, { uidBar: e.target.checked })}
          className="cursor-pointer"
        />
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
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Self-reference</p>
      {entity && <p className="text-sm font-bold text-gray-900">{entity.name}</p>}

      <Toggle
        label="Cardinality"
        options={['one', 'many']}
        value={rel.targetEnd.cardinality}
        onChange={v => updateRelationshipEnd(rel.id, 'target', { cardinality: v as 'one' | 'many' })}
      />
      <Toggle
        label="Optionality"
        options={['mandatory', 'optional']}
        value={rel.targetEnd.optionality}
        onChange={v => {
          useDiagramStore.temporal.getState().pause()
          updateRelationshipEnd(rel.id, 'source', { optionality: v as 'mandatory' | 'optional' })
          updateRelationshipEnd(rel.id, 'target', { optionality: v as 'mandatory' | 'optional' })
          useDiagramStore.temporal.getState().resume()
        }}
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
      <LabelInput label="Exit label"  value={exitLabel}  onChange={setExitLabel}  onCommit={commitExit} />
      <LabelInput label="Entry label" value={entryLabel} onChange={setEntryLabel} onCommit={commitEntry} />
    </div>
  )
}

export default function PropertyPanel() {
  const selection  = useDiagramStore(s => s.selection)
  const diagram    = useDiagramStore(s => s.diagram)

  const selectedEntityId = selection.entityIds[0] ?? null
  const selectedRelId    = selection.relationshipIds[0] ?? null

  const entity = selectedEntityId
    ? diagram.entities.find(e => e.id === selectedEntityId) ?? null
    : null
  const rel = selectedRelId
    ? diagram.relationships.find(r => r.id === selectedRelId) ?? null
    : null

  if (!entity && !rel) return null

  return (
    <div className="shrink-0 h-full border-l border-gray-200 bg-white overflow-y-auto overflow-x-hidden p-4 space-y-4" style={{ minWidth: 280, width: 280 }}>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Properties</p>

      {entity && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Entity</p>
          <p className="text-sm font-bold text-gray-900">{entity.name}</p>
          <p className="text-xs text-gray-400 italic">Double-click on canvas to rename.</p>
        </div>
      )}

      {rel && (
        rel.sourceEntityId === rel.targetEntityId
          ? <SelfRefSection rel={rel} />
          : (() => {
              const srcEntity = diagram.entities.find(e => e.id === rel.sourceEntityId)
              const tgtEntity = diagram.entities.find(e => e.id === rel.targetEntityId)
              return (
                <div className="space-y-4">
                  <EndSection title="Target end" entityName={tgtEntity?.name} end={rel.targetEnd} relId={rel.id} endKey="target" />
                  <hr className="border-gray-200" />
                  {rel.sourceEnd.cardinality === 'many' && rel.targetEnd.cardinality === 'many' && (
                    <div className="rounded border border-yellow-400 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 leading-snug">
                      ⚠ Barker notation does not allow direct many-to-many.
                      Add an intersection entity between these two.
                    </div>
                  )}
                  <EndSection title="Source end" entityName={srcEntity?.name} end={rel.sourceEnd} relId={rel.id} endKey="source" />
                </div>
              )
            })()
      )}
    </div>
  )
}
