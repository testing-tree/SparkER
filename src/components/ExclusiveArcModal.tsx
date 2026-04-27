import { useState } from 'react'
import type { Relationship, Entity } from '../types/diagram'

export default function ExclusiveArcModal({
  relationships,
  entities,
  onConfirm,
  onClose,
}: {
  relationships: Relationship[]
  entities: Entity[]
  onConfirm: (selectedIds: string[]) => void
  onClose: () => void
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const entityName = (id: string) => entities.find(e => e.id === id)?.name ?? id

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleConfirm = () => {
    if (checked.size >= 2) onConfirm([...checked])
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-lg shadow-xl flex flex-col" style={{ width: 420, maxHeight: '70vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-700">Add Exclusive Arc</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none cursor-pointer">×</button>
        </div>

        {/* Instructions */}
        <p className="px-4 pt-3 pb-1 text-xs text-gray-500">
          Select 2 or more outgoing relationships to mark as mutually exclusive.
        </p>

        {/* Relationship list */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
          {relationships.map(rel => {
            const tgtName  = entityName(rel.targetEntityId)
            const srcLabel = rel.sourceEnd.label
            const tgtLabel = rel.targetEnd.label
            const desc = [srcLabel, tgtLabel].filter(Boolean).join(' / ')
            return (
              <label key={rel.id} className="flex items-start gap-3 py-1.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={checked.has(rel.id)}
                  onChange={() => toggle(rel.id)}
                  className="mt-0.5 cursor-pointer shrink-0"
                />
                <span className="text-sm text-gray-800">
                  <span className="font-semibold">{tgtName}</span>
                  {desc && <span className="text-gray-500 ml-1 text-xs">({desc})</span>}
                </span>
              </label>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-gray-200 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium bg-white border border-gray-300 rounded hover:bg-gray-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={checked.size < 2}
            className="px-3 py-1.5 text-sm font-medium bg-gray-800 text-white rounded hover:bg-gray-700 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add Arc ({checked.size} selected)
          </button>
        </div>
      </div>
    </div>
  )
}
