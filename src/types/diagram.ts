// ============================================================
// Top level container
// ============================================================
export interface Diagram {
  id: string;
  name: string;
  schemaVersion: string;        // e.g. "1.0.0", for future migrations
  notation: 'barker';           // future-proofing for other notations
  entities: Entity[];
  relationships: Relationship[];
  exclusiveArcs: ExclusiveArc[];
  createdAt: string;            // ISO 8601
  updatedAt: string;
}

// ============================================================
// Entity covers strong, weak, super, and sub entities.
// Differentiation is implicit through parentEntityId and via
// UID bars on incoming relationship ends.
// ============================================================
export interface Entity {
  id: string;
  name: string;                 // UPPERCASE singular (enforced by UI)
  attributes: Attribute[];
  position: { x: number; y: number };
  parentEntityId?: string;      // set on sub entities, references the super entity
  size?: { width: number; height: number };  // only when user manually resized
}

// ============================================================
// Attribute
// ============================================================
export interface Attribute {
  id: string;
  name: string;                 // lowercase (enforced by UI)
  kind: 'identifier' | 'required' | 'optional';  // maps to #, *, o
  order: number;                // position within the entity
  dataTypeHint?: string;        // optional, consumed only by SQL DDL export
}

// ============================================================
// Relationship covers 1:1, 1:m, recursive (source == target),
// and all optionality mixes.
// Many to many does NOT exist at this layer; it is always
// represented as two 1:m relationships joined by an
// intersection Entity.
// ============================================================
export interface Relationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;       // equals sourceEntityId iff recursive
  sourceEnd: RelationshipEnd;
  targetEnd: RelationshipEnd;
  waypoints?: Array<{ x: number; y: number }>;  // optional custom routing
  loopCorner?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';  // self-loop corner placement
}

export interface RelationshipEnd {
  cardinality: 'one' | 'many';           // 'many' renders crow's foot
  optionality: 'mandatory' | 'optional'; // solid line vs dashed
  label: string;                         // verb, required by Barker spec
  uidBar: boolean;                       // UID bar for weak entity identification
  labelFlipped?: boolean;               // true = render label on opposite side of ARM
}

// ============================================================
// Exclusive arcs span multiple relationships, so they are a
// top level collection rather than a property of any single
// relationship.
// ============================================================
export interface ExclusiveArc {
  id: string;
  sourceEntityId: string;        // the entity bearing the exclusive constraint
  relationshipIds: string[];     // at least 2 relationships in the arc
}
