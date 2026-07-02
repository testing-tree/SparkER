import { create } from 'zustand'
import { temporal } from 'zundo'
import { useStore } from 'zustand'
import type {
  Diagram,
  Entity,
  Attribute,
  Relationship,
  RelationshipEnd,
  ExclusiveArc,
} from '../types/diagram'

function now(): string {
  return new Date().toISOString()
}

function emptyDiagram(): Diagram {
  return {
    id: crypto.randomUUID(),
    name: 'Untitled Diagram',
    schemaVersion: '1.0.0',
    notation: 'barker',
    entities: [],
    relationships: [],
    exclusiveArcs: [],
    createdAt: now(),
    updatedAt: now(),
  }
}


export interface DiagramStore {
  diagram: Diagram
  selection: { entityIds: string[]; relationshipIds: string[]; arcIds: string[] }
  viewport: { x: number; y: number; zoom: number }

  // Entity actions
  addEntity(partial: Partial<Omit<Entity, 'id'>>): string
  updateEntity(id: string, patch: Partial<Omit<Entity, 'id'>>): void
  deleteEntity(id: string): void
  addSubEntity(superEntityId: string, partial: Partial<Omit<Entity, 'id' | 'parentEntityId'>>): string

  // Attribute actions
  addAttribute(entityId: string, partial: Partial<Omit<Attribute, 'id' | 'order'>>): string
  updateAttribute(entityId: string, attrId: string, patch: Partial<Omit<Attribute, 'id'>>): void
  deleteAttribute(entityId: string, attrId: string): void
  reorderAttributes(entityId: string, newOrder: string[]): void

  // Relationship actions
  addRelationship(partial: Partial<Omit<Relationship, 'id'>>): string
  updateRelationship(id: string, patch: Partial<Relationship>): void
  updateRelationshipEnd(id: string, end: 'source' | 'target', patch: Partial<RelationshipEnd>): void
  deleteRelationship(id: string): void

  // Exclusive arc actions
  addExclusiveArc(arc: Omit<ExclusiveArc, 'id'>): string
  deleteExclusiveArc(id: string): void

  // Atomic m:m creation
  createManyToMany(sourceId: string, targetId: string, intersectionName: string): void

  // Selection
  setSelection(selection: Partial<DiagramStore['selection']>): void

  // Persistence
  setDiagramName(name: string): void
  saveToJSON(): string
  loadFromJSON(json: string): void
  reset(): void
}

function defaultRelationshipEnd(): RelationshipEnd {
  return {
    cardinality: 'many',
    optionality: 'mandatory',
    label: '',
    uidBar: false,
  }
}

export const useDiagramStore = create<DiagramStore>()(
  temporal<DiagramStore>(
    (set, get) => ({
      diagram: emptyDiagram(),
      selection: { entityIds: [], relationshipIds: [], arcIds: [] },
      viewport: { x: 0, y: 0, zoom: 1 },

      // ── Entity ──────────────────────────────────────────────────

      addEntity(partial) {
        const id = crypto.randomUUID()
        const entity: Entity = {
          name: 'ENTITY',
          attributes: [],
          position: { x: 100, y: 100 },
          ...partial,
          id,
        }
        set(s => ({
          diagram: {
            ...s.diagram,
            entities: [...s.diagram.entities, entity],
            updatedAt: now(),
          },
        }))
        return id
      },

      updateEntity(id, patch) {
        set(s => ({
          diagram: {
            ...s.diagram,
            entities: s.diagram.entities.map(e => e.id === id ? { ...e, ...patch } : e),
            updatedAt: now(),
          },
        }))
      },

      deleteEntity(id) {
        set(s => {
          // Cascade-delete sub-entities that belong to this super-entity
          const toDelete = new Set([id, ...s.diagram.entities.filter(e => e.parentEntityId === id).map(e => e.id)])
          return {
            diagram: {
              ...s.diagram,
              entities: s.diagram.entities.filter(e => !toDelete.has(e.id)),
              relationships: s.diagram.relationships.filter(
                r => !toDelete.has(r.sourceEntityId) && !toDelete.has(r.targetEntityId)
              ),
              exclusiveArcs: s.diagram.exclusiveArcs.filter(a => !toDelete.has(a.sourceEntityId)),
              updatedAt: now(),
            },
          }
        })
      },

      addSubEntity(superEntityId, partial) {
        const superEntity = get().diagram.entities.find(e => e.id === superEntityId)
        if (!superEntity) return ''

        const existingChildren = get().diagram.entities.filter(e => e.parentEntityId === superEntityId)
        const childIndex = existingChildren.length

        // Estimate super-entity header height based on its current attributes
        const NAME_H    = 42  // name section: min-h-40 + 2px border-b
        const ATTR_ROW  = 22  // text-sm + py-0.5 per attribute row
        const ATTR_PAD  = 8
        const attrH     = Math.max(40, superEntity.attributes.length * ATTR_ROW + ATTR_PAD)
        const SEP_GAP   = 36  // separator line + label + breathing room
        const SUB_START_Y  = Math.max(120, NAME_H + attrH + SEP_GAP)

        const SUB_W       = 168
        const SUB_H_EST   = 100
        const SUB_PADDING = 16

        const subPosition = {
          x: SUB_PADDING + childIndex * (SUB_W + SUB_PADDING),
          y: SUB_START_Y,
        }

        const subId = crypto.randomUUID()
        const subEntity: Entity = {
          name: 'SUB_ENTITY',
          attributes: [],
          position: subPosition,
          ...partial,
          id: subId,
          parentEntityId: superEntityId,
        }

        // Expand super-entity to contain the new child
        const requiredW = Math.max(superEntity.size?.width  ?? 0, subPosition.x + SUB_W + SUB_PADDING, 280)
        const requiredH = Math.max(superEntity.size?.height ?? 0, SUB_START_Y + SUB_H_EST + 20, 260)
        const newSize = { width: requiredW, height: requiredH }

        set(s => ({
          diagram: {
            ...s.diagram,
            entities: [
              ...s.diagram.entities.map(e => e.id === superEntityId ? { ...e, size: newSize } : e),
              subEntity,
            ],
            updatedAt: now(),
          },
        }))
        return subId
      },

      // ── Attribute ────────────────────────────────────────────────

      addAttribute(entityId, partial) {
        const entity = get().diagram.entities.find(e => e.id === entityId)
        if (!entity) return ''
        const order = entity.attributes.length
        const attr: Attribute = {
          name: 'attribute',
          kind: 'optional',
          ...partial,
          id: crypto.randomUUID(),
          order,
        }
        set(s => ({
          diagram: {
            ...s.diagram,
            entities: s.diagram.entities.map(e =>
              e.id === entityId
                ? { ...e, attributes: [...e.attributes, attr] }
                : e
            ),
            updatedAt: now(),
          },
        }))
        return attr.id
      },

      updateAttribute(entityId, attrId, patch) {
        set(s => ({
          diagram: {
            ...s.diagram,
            entities: s.diagram.entities.map(e =>
              e.id === entityId
                ? {
                    ...e,
                    attributes: e.attributes.map(a =>
                      a.id === attrId ? { ...a, ...patch } : a
                    ),
                  }
                : e
            ),
            updatedAt: now(),
          },
        }))
      },

      deleteAttribute(entityId, attrId) {
        set(s => ({
          diagram: {
            ...s.diagram,
            entities: s.diagram.entities.map(e =>
              e.id === entityId
                ? { ...e, attributes: e.attributes.filter(a => a.id !== attrId) }
                : e
            ),
            updatedAt: now(),
          },
        }))
      },

      reorderAttributes(entityId, newOrder) {
        set(s => ({
          diagram: {
            ...s.diagram,
            entities: s.diagram.entities.map(e => {
              if (e.id !== entityId) return e
              const byId = Object.fromEntries(e.attributes.map(a => [a.id, a]))
              const reordered = newOrder
                .map((id, i) => ({ ...byId[id], order: i }))
                .filter(Boolean)
              return { ...e, attributes: reordered }
            }),
            updatedAt: now(),
          },
        }))
      },

      // ── Relationship ─────────────────────────────────────────────

      addRelationship(partial) {
        const id = crypto.randomUUID()
        const rel: Relationship = {
          sourceEntityId: '',
          targetEntityId: '',
          sourceEnd: defaultRelationshipEnd(),
          targetEnd: { ...defaultRelationshipEnd(), cardinality: 'one' },
          ...partial,
          id,
        }
        // Default target label to opposite side so labels alternate visually
        if (rel.targetEnd.labelFlipped === undefined) {
          rel.targetEnd.labelFlipped = true
        }
        set(s => ({
          diagram: {
            ...s.diagram,
            relationships: [...s.diagram.relationships, rel],
            updatedAt: now(),
          },
        }))
        return id
      },

      updateRelationship(id, patch) {
        set(s => ({
          diagram: {
            ...s.diagram,
            relationships: s.diagram.relationships.map(r =>
              r.id === id ? { ...r, ...patch } : r
            ),
            updatedAt: now(),
          },
        }))
      },

      updateRelationshipEnd(id, end, patch) {
        const key = end === 'source' ? 'sourceEnd' : 'targetEnd'
        set(s => ({
          diagram: {
            ...s.diagram,
            relationships: s.diagram.relationships.map(r =>
              r.id === id ? { ...r, [key]: { ...r[key], ...patch } } : r
            ),
            updatedAt: now(),
          },
        }))
      },

      deleteRelationship(id) {
        set(s => ({
          diagram: {
            ...s.diagram,
            relationships: s.diagram.relationships.filter(r => r.id !== id),
            exclusiveArcs: s.diagram.exclusiveArcs
              .map(a => ({ ...a, relationshipIds: a.relationshipIds.filter(rid => rid !== id) }))
              .filter(a => a.relationshipIds.length >= 2),
            updatedAt: now(),
          },
        }))
      },

      // ── Exclusive arc ────────────────────────────────────────────

      addExclusiveArc(arc) {
        const id = crypto.randomUUID()
        const newArc: ExclusiveArc = { ...arc, id }
        set(s => ({
          diagram: {
            ...s.diagram,
            exclusiveArcs: [...s.diagram.exclusiveArcs, newArc],
            updatedAt: now(),
          },
        }))
        return id
      },

      deleteExclusiveArc(id) {
        set(s => ({
          diagram: {
            ...s.diagram,
            exclusiveArcs: s.diagram.exclusiveArcs.filter(a => a.id !== id),
            updatedAt: now(),
          },
        }))
      },

      // ── m:m atomic creation ──────────────────────────────────────

      createManyToMany(sourceId, targetId, intersectionName) {
        const intersectionId = crypto.randomUUID()
        const rel1Id = crypto.randomUUID()
        const rel2Id = crypto.randomUUID()

        const entities = get().diagram.entities
        const src = entities.find(e => e.id === sourceId)
        const tgt = entities.find(e => e.id === targetId)
        const pos = src && tgt
          ? { x: (src.position.x + tgt.position.x) / 2, y: (src.position.y + tgt.position.y) / 2 }
          : { x: 300, y: 300 }

        const intersection: Entity = {
          id: intersectionId,
          name: intersectionName.toUpperCase(),
          attributes: [],
          position: pos,
        }

        const rel1: Relationship = {
          id: rel1Id,
          sourceEntityId: sourceId,
          targetEntityId: intersectionId,
          sourceEnd: { cardinality: 'one', optionality: 'mandatory', label: '', uidBar: false },
          targetEnd: { cardinality: 'many', optionality: 'mandatory', label: '', uidBar: false },
        }

        const rel2: Relationship = {
          id: rel2Id,
          sourceEntityId: targetId,
          targetEntityId: intersectionId,
          sourceEnd: { cardinality: 'one', optionality: 'mandatory', label: '', uidBar: false },
          targetEnd: { cardinality: 'many', optionality: 'mandatory', label: '', uidBar: false },
        }

        set(s => ({
          diagram: {
            ...s.diagram,
            entities: [...s.diagram.entities, intersection],
            relationships: [...s.diagram.relationships, rel1, rel2],
            updatedAt: now(),
          },
        }))
      },

      // ── Selection ────────────────────────────────────────────────

      setSelection(selection) {
        set(s => ({ selection: { ...s.selection, ...selection } }))
      },

      // ── Persistence ──────────────────────────────────────────────

      setDiagramName(name) {
        set(s => ({
          diagram: { ...s.diagram, name, updatedAt: now() },
        }))
      },

      saveToJSON() {
        return JSON.stringify(get().diagram, null, 2)
      },

      loadFromJSON(json) {
        const diagram = JSON.parse(json) as Diagram
        set({ diagram, selection: { entityIds: [], relationshipIds: [], arcIds: [] } })
      },

      reset() {
        set({ diagram: emptyDiagram(), selection: { entityIds: [], relationshipIds: [], arcIds: [] } })
      },
    }),
    {
      limit: 50,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      partialize: (state) => ({ diagram: state.diagram }) as any,
    }
  )
)

// Expose the temporal store for undo/redo consumers
export const useUndoRedo = <T>(
  selector: (state: ReturnType<typeof useDiagramStore.temporal.getState>) => T
) => useStore(useDiagramStore.temporal, selector)
