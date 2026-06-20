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
  const dbName = diagram.name
    ? diagram.name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_|_$/g, '')
    : 'my_database'

  const header = `CREATE DATABASE ${dbName};\nUSE ${dbName};\n`
  const entityMap = new Map(diagram.entities.map(e => [e.id, e]))

  interface FKEntry {
    colName:  string
    refTable: string
    refCol:   string
    notNull:  boolean
    uidBar:   boolean
  }

  // ── Build CREATE TABLE blocks (unordered) ────────────────────
  interface TableBlock {
    name: string
    sql: string
    deps: Set<string>  // table names this table depends on
  }
  const tableBlocks: TableBlock[] = []

  for (const entity of diagram.entities) {
    const tbl  = tblName(entity)
    const fks: FKEntry[] = []
    const deps = new Set<string>()

    // Sub-entity: FK-as-PK referencing the super-entity
    if (entity.parentEntityId) {
      const superEntity = entityMap.get(entity.parentEntityId)
      if (superEntity) {
        const refCol = pkColName(superEntity)
        const refTbl = tblName(superEntity)
        fks.push({ colName: refCol, refTable: refTbl, refCol, notNull: true, uidBar: true })
        deps.add(refTbl)
      }
    }

    // ── Collect FK columns from relationships ──────────────────
    for (const rel of diagram.relationships) {
      const isSelf = rel.sourceEntityId === rel.targetEntityId

      if (isSelf && rel.sourceEntityId === entity.id) {
        const manyEnd =
          rel.sourceEnd.cardinality === 'many' ? rel.sourceEnd :
          rel.targetEnd.cardinality === 'many' ? rel.targetEnd : null
        if (!manyEnd) continue
        const refCol = pkColName(entity)
        fks.push({ colName: `parent_${refCol}`, refTable: tbl, refCol, notNull: false, uidBar: manyEnd.uidBar })
        continue
      }

      if (rel.targetEntityId === entity.id && rel.targetEnd.cardinality === 'many') {
        const src = entityMap.get(rel.sourceEntityId)
        if (!src) continue
        const refCol = pkColName(src)
        const refTbl = tblName(src)
        fks.push({ colName: refCol, refTable: refTbl, refCol, notNull: rel.targetEnd.optionality === 'mandatory', uidBar: rel.targetEnd.uidBar })
        deps.add(refTbl)
        continue
      }

      if (rel.sourceEntityId === entity.id && rel.sourceEnd.cardinality === 'many') {
        const tgt = entityMap.get(rel.targetEntityId)
        if (!tgt) continue
        const refCol = pkColName(tgt)
        const refTbl = tblName(tgt)
        fks.push({ colName: refCol, refTable: refTbl, refCol, notNull: rel.sourceEnd.optionality === 'mandatory', uidBar: rel.sourceEnd.uidBar })
        deps.add(refTbl)
        continue
      }

      if (
        rel.targetEntityId === entity.id &&
        rel.targetEnd.cardinality === 'one' &&
        rel.sourceEnd.cardinality === 'one'
      ) {
        const src = entityMap.get(rel.sourceEntityId)
        if (!src) continue
        const refCol = pkColName(src)
        const refTbl = tblName(src)
        fks.push({ colName: refCol, refTable: refTbl, refCol, notNull: rel.targetEnd.optionality === 'mandatory', uidBar: rel.targetEnd.uidBar })
        deps.add(refTbl)
      }
    }

    // ── Build column lines ─────────────────────────────────────
    const colLines: string[] = []
    const attrs = [...entity.attributes].sort((a, b) => a.order - b.order)
    for (const attr of attrs) {
      const notNull = attr.kind !== 'optional' ? ' NOT NULL' : ''
      colLines.push(`  ${attr.name} ${colType(attr)}${notNull}`)
    }
    for (const fk of fks) {
      const notNull = fk.notNull ? ' NOT NULL' : ''
      colLines.push(`  ${fk.colName} INT${notNull}`)
    }
    const ownPkCols = attrs.filter(a => a.kind === 'identifier').map(a => a.name)
    const fkPkCols  = fks.filter(f => f.uidBar).map(f => f.colName)
    const pkCols    = [...ownPkCols, ...fkPkCols]
    if (pkCols.length > 0) {
      colLines.push(`  PRIMARY KEY (${pkCols.join(', ')})`)
    }
    for (const fk of fks) {
      colLines.push(`  FOREIGN KEY (${fk.colName}) REFERENCES ${fk.refTable}(${fk.refCol})`)
    }

    tableBlocks.push({
      name: tbl,
      sql: `CREATE TABLE ${tbl} (\n${colLines.join(',\n')}\n);`,
      deps,
    })
  }

  // ── Topological sort: independent tables first ──────────────
  const sorted: TableBlock[] = []
  const emitted = new Set<string>()
  let remaining = [...tableBlocks]

  while (remaining.length > 0) {
    const readyIdx = remaining.findIndex(
      b => [...b.deps].every(d => d === b.name || emitted.has(d))
    )
    if (readyIdx === -1) {
      // Shouldn't happen with valid diagrams, but fall back to remaining order
      sorted.push(...remaining)
      break
    }
    const block = remaining.splice(readyIdx, 1)[0]
    sorted.push(block)
    emitted.add(block.name)
  }

  return header + '\n' + sorted.map(b => b.sql).join('\n\n')
}
