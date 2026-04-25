import type { Diagram, Entity, Attribute } from '../../types/diagram'

// ── Helpers ───────────────────────────────────────────────────

function tblName(entity: Entity): string {
  return entity.name.toLowerCase()
}

function inferType(name: string): string {
  if (/_id$|^id$/.test(name)) return 'INT'
  if (/date/.test(name))       return 'DATE'
  return 'VARCHAR(255)'
}

function colType(attr: Attribute): string {
  return attr.dataTypeHint || inferType(attr.name)
}

// Returns the PK column name of an entity.
// Prefers the single identifier attribute's name; falls back to {table}_id.
function pkColName(entity: Entity): string {
  const ids = entity.attributes.filter(a => a.kind === 'identifier')
  if (ids.length === 1) return ids[0].name
  return `${tblName(entity)}_id`
}

// ── Main export ───────────────────────────────────────────────

export function toSQL(diagram: Diagram): string {
  const entityMap = new Map(diagram.entities.map(e => [e.id, e]))

  interface FKEntry {
    colName:  string
    refTable: string
    refCol:   string
    notNull:  boolean
    uidBar:   boolean
  }

  const blocks: string[] = []

  for (const entity of diagram.entities) {
    const tbl  = tblName(entity)
    const fks: FKEntry[] = []

    // Sub-entity: FK-as-PK referencing the super-entity
    if (entity.parentEntityId) {
      const superEntity = entityMap.get(entity.parentEntityId)
      if (superEntity) {
        const refCol = pkColName(superEntity)
        fks.push({
          colName:  refCol,
          refTable: tblName(superEntity),
          refCol,
          notNull:  true,
          uidBar:   true,  // FK is also the PK
        })
      }
    }

    // ── Collect FK columns from relationships ──────────────────
    for (const rel of diagram.relationships) {
      const isSelf = rel.sourceEntityId === rel.targetEntityId

      if (isSelf && rel.sourceEntityId === entity.id) {
        // Self-referencing: FK on the 'many' end, always nullable
        const manyEnd =
          rel.sourceEnd.cardinality === 'many' ? rel.sourceEnd :
          rel.targetEnd.cardinality === 'many' ? rel.targetEnd : null
        if (!manyEnd) continue
        const refCol = pkColName(entity)
        fks.push({
          colName:  `parent_${refCol}`,
          refTable: tbl,
          refCol,
          notNull:  false,
          uidBar:   manyEnd.uidBar,
        })
        continue
      }

      // Many end is target
      if (rel.targetEntityId === entity.id && rel.targetEnd.cardinality === 'many') {
        const src = entityMap.get(rel.sourceEntityId)
        if (!src) continue
        const refCol = pkColName(src)
        fks.push({
          colName:  refCol,
          refTable: tblName(src),
          refCol,
          notNull:  rel.targetEnd.optionality === 'mandatory',
          uidBar:   rel.targetEnd.uidBar,
        })
        continue
      }

      // Many end is source
      if (rel.sourceEntityId === entity.id && rel.sourceEnd.cardinality === 'many') {
        const tgt = entityMap.get(rel.targetEntityId)
        if (!tgt) continue
        const refCol = pkColName(tgt)
        fks.push({
          colName:  refCol,
          refTable: tblName(tgt),
          refCol,
          notNull:  rel.sourceEnd.optionality === 'mandatory',
          uidBar:   rel.sourceEnd.uidBar,
        })
        continue
      }

      // 1:1 relationship — FK on target table
      if (
        rel.targetEntityId === entity.id &&
        rel.targetEnd.cardinality === 'one' &&
        rel.sourceEnd.cardinality === 'one'
      ) {
        const src = entityMap.get(rel.sourceEntityId)
        if (!src) continue
        const refCol = pkColName(src)
        fks.push({
          colName:  refCol,
          refTable: tblName(src),
          refCol,
          notNull:  rel.targetEnd.optionality === 'mandatory',
          uidBar:   rel.targetEnd.uidBar,
        })
      }
    }

    // ── Build column lines ─────────────────────────────────────
    const colLines: string[] = []

    // Own attributes
    const attrs = [...entity.attributes].sort((a, b) => a.order - b.order)
    for (const attr of attrs) {
      const notNull = attr.kind !== 'optional' ? ' NOT NULL' : ''
      colLines.push(`  ${attr.name} ${colType(attr)}${notNull}`)
    }

    // FK columns
    for (const fk of fks) {
      const notNull = fk.notNull ? ' NOT NULL' : ''
      colLines.push(`  ${fk.colName} INT${notNull}`)
    }

    // ── PRIMARY KEY ────────────────────────────────────────────
    const ownPkCols  = attrs.filter(a => a.kind === 'identifier').map(a => a.name)
    const fkPkCols   = fks.filter(f => f.uidBar).map(f => f.colName)
    const pkCols     = [...ownPkCols, ...fkPkCols]

    if (pkCols.length > 0) {
      colLines.push(`  PRIMARY KEY (${pkCols.join(', ')})`)
    }

    // ── FOREIGN KEY constraints ────────────────────────────────
    for (const fk of fks) {
      colLines.push(`  FOREIGN KEY (${fk.colName}) REFERENCES ${fk.refTable}(${fk.refCol})`)
    }

    blocks.push(`CREATE TABLE ${tbl} (\n${colLines.join(',\n')}\n);`)
  }

  return blocks.join('\n\n')
}
