> This project was developed with the assistance of Claude Code (Anthropic). DESIGN.md served as the primary context document across all development sessions.

# ER Diagram Editor: Design Document

**Project codename:** `CD_002fa7` (#002FA7)
**Status:** Pre-implementation design complete. Ready for scaffolding.
**Last updated:** 2026-04-19

---

## 1. Project Overview

### Motivation

Entity Relationship (ER) data modeling is a core skill in database design courses, and Barker notation is the specific graphical standard taught at Ivey Business School and many other institutions. Existing visual ERD tools (Lucidchart, draw.io, dbdiagram.io, Mermaid) predominantly use crow's foot notation or its variants, and none strictly adhere to Barker notation. Students required to produce Barker notation diagrams are currently limited to:

1. Hand drawing, which is time consuming and whose quality varies with handwriting and layout ability.
2. General purpose diagram tools adapted imperfectly, which miss Barker specific elements like UID bars, exclusive arcs, dotted line optionality, and double ended verb labels.
3. Code to diagram tools like Mermaid ERD, which are not visual first and still not strict Barker.

This project fills that niche: a strict Barker notation visual editor, free and open source, usable in a browser with zero install friction.

### Target users

Business and information systems students enrolled in data modeling courses, instructors teaching Barker notation who need a tool to demonstrate or evaluate student work, and anyone producing Barker notation diagrams for documentation or planning.

### Reference material

The canonical specification for Barker notation is Ivey Publishing technical note **W38454 "Data Modelling with Barker Notation"** by Derrick Neufeld (2024). All rule enforcement and visual conventions in this tool should adhere to that note.

---

## 2. Scope

### Phase 1 (MVP)

- Strong entities with attributes (identifier, required, optional)
- Relationships: 1:1 and 1:m (m:m is represented via intersection entity plus two 1:m relationships, never directly)
- Optionality on each end of a relationship (mandatory solid line, optional dashed line)
- Verb labels on both ends of every relationship
- Save and load diagrams as JSON files
- Export as PNG and SVG

### Phase 2

- Weak entities with UID bar annotations
- Recursive relationships (self referential)
- Half optional relationship variants
- SQL DDL export (CREATE TABLE statements with foreign keys)

### Phase 3

- Super entities with nested sub entities
- Exclusive relationship arcs
- Undo and redo
- Grid snap and alignment helpers
- Keyboard shortcuts
- Optional desktop build via Tauri

### Explicitly out of scope (for the foreseeable future)

- Other notations (Chen, IDEF1X, crow's foot, UML)
- Real time multi user collaboration
- Server side persistence or user accounts
- Mobile responsive editing (desktop viewport only)

---

## 3. Distribution

- Hosted on GitHub Pages from the project repository
- MIT License
- README with live demo link, feature list, screenshots, and basic usage guide
- Shared with instructor (Ivey Data Management course) for teaching use
- Portfolio piece for job applications in consulting, tech consulting, and analytics

---

## 4. Tech Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | React 19 with TypeScript | Ecosystem, type safety |
| Build tool | Vite | Fast hot module reload, simple config |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` | Utility first, avoids CSS file proliferation; v4 uses a Vite plugin instead of `tailwind.config.js` |
| Node editor | `@xyflow/react` (React Flow) | Purpose built for node based editors, MIT licensed, handles drag, zoom, pan, selection, minimap |
| State | Zustand | Lightweight, used internally by React Flow |
| Undo and redo | `zundo` | Zustand middleware for history |
| PNG export | `html-to-image` | DOM to PNG conversion |
| SVG export | React Flow built in `toSvg` | Native support |

---

## 5. Data Schema

All TypeScript interfaces below are the canonical schema for the Diagram model. The root of any saved JSON file is a `Diagram` object. This schema lives at `src/types/diagram.ts`.

```typescript
// ============================================================
// Top level container
// ============================================================
interface Diagram {
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
interface Entity {
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
interface Attribute {
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
interface Relationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;       // equals sourceEntityId iff recursive
  sourceEnd: RelationshipEnd;
  targetEnd: RelationshipEnd;
  waypoints?: Array<{ x: number; y: number }>;  // optional custom routing
  loopCorner?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';  // self-loop corner placement
}

interface RelationshipEnd {
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
interface ExclusiveArc {
  id: string;
  sourceEntityId: string;        // the entity bearing the exclusive constraint
  relationshipIds: string[];     // at least 2 relationships in the arc
}
```

---

## 6. Key Design Decisions

Each decision below is stated with its rationale, so edge cases can be reasoned about consistently.

### 6.1 Recursive relationships require no special type

A recursive relationship is simply a `Relationship` where `sourceEntityId === targetEntityId`. The renderer detects this condition and draws a self loop. No separate `RecursiveRelationship` interface is needed.

### 6.2 Many to many is not directly representable

Per Barker spec, a true m:m always requires an intersection entity. The schema reflects this constraint: only `cardinality: 'one'` and `cardinality: 'many'` exist, and there is no way to have `many` on both ends because m:m must be decomposed. When the user requests an m:m in the UI, the tool atomically creates an intersection `Entity` plus two `Relationship` records via the `createManyToMany` store action.

### 6.3 Half optional is emergent, not declared

Barker describes four half optional variants. Rather than enumerate them in the type system, the schema gives each `RelationshipEnd` its own independent `optionality`. Any combination is valid, and half optional patterns emerge naturally from the per end configuration.

### 6.4 UID bars attach to RelationshipEnds

Weak entity identification is expressed per end, not per relationship. In an m:m weak intersection, both ends of both relationships may carry UID bars simultaneously. Placing `uidBar: boolean` on `RelationshipEnd` handles all cases without special casing.

### 6.5 Exclusive arcs are top level

An exclusive arc spans multiple relationships, so it cannot be a property of any one of them. It gets its own top level collection, referencing the shared source entity and the participating relationship IDs.

### 6.6 Data type hints are optional, not part of the logical model

Barker is explicitly software agnostic at the logical level, and data types belong to physical modeling. However, SQL DDL export requires type information. The compromise: `Attribute.dataTypeHint` is optional, hidden by default in the logical view, editable only via a dedicated SQL Export panel. Users can enter a type explicitly, or the exporter can infer one from the attribute name (for example, `id` becomes `INT`, names containing `date` become `DATE`, default to `VARCHAR(255)`).

### 6.7 Attribute ordering is free form with UI defaults

The `order` field on `Attribute` allows arbitrary sequencing. When the UI creates a new attribute, the default behavior is to place `identifier` kind attributes before any `required` or `optional` attributes. Users can then manually reorder via drag. This respects the Barker convention of identifiers first while allowing composite identifier fine tuning.

### 6.8 One diagram per browser tab

The tool does not manage multiple diagrams within a single session. Each tab holds one `Diagram`. Users needing to work on several diagrams simultaneously open multiple tabs. Rationale: ER diagrams, unlike spreadsheets, have no cross diagram references to justify in app multi document management.

---

## 7. Component Architecture

```
<App>
├── <Toolbar>                  Top bar: File menu, Export, View controls, Undo and Redo
├── <MainLayout>
│   ├── <Sidebar>              Left: tool palette (Add Entity, Add Relationship, Snippets)
│   ├── <CanvasArea>
│   │   └── <ReactFlow>        Core canvas
│   │       ├── <EntityNode>   Custom node: rounded rectangle plus attribute list
│   │       └── <BarkerEdge>   Custom edge: crow's foot, dashed lines, UID bars, verb labels
│   └── <PropertyPanel>        Right: detailed editor for selected element
└── <StatusBar>                Bottom: validation warnings, zoom level, diagram name
```

### Editing principles

- All mutations flow through a single Zustand store. Dual edit surfaces (inline on canvas and via PropertyPanel) both call the same store actions to avoid inconsistent edit paths.
- `EntityNode` handles inline editing of entity name and attribute list. Relationship configuration (cardinality, optionality, labels, UID bar) happens only in `PropertyPanel`, because inline controls on edges would clutter the canvas.
- Validation runs as a passive layer. It emits warnings to `StatusBar` without blocking user input, since partial states during editing are normal and expected.

---

## 8. State Management

Using Zustand with the `zundo` middleware for undo and redo. Key slices of the store:

```typescript
interface DiagramStore {
  diagram: Diagram;
  selection: { entityIds: string[]; relationshipIds: string[] };
  viewport: { x: number; y: number; zoom: number };

  // Entity actions
  addEntity(partial: Partial<Entity>): string;
  updateEntity(id: string, patch: Partial<Entity>): void;
  deleteEntity(id: string): void;

  // Attribute actions
  addAttribute(entityId: string, partial: Partial<Attribute>): void;
  updateAttribute(entityId: string, attrId: string, patch: Partial<Attribute>): void;
  deleteAttribute(entityId: string, attrId: string): void;
  reorderAttributes(entityId: string, newOrder: string[]): void;

  // Relationship actions
  addRelationship(partial: Partial<Relationship>): string;
  updateRelationshipEnd(
    id: string,
    end: 'source' | 'target',
    patch: Partial<RelationshipEnd>
  ): void;
  deleteRelationship(id: string): void;

  // Atomic m:m creation: intersection entity plus 2 relationships in one operation
  createManyToMany(
    sourceId: string,
    targetId: string,
    intersectionName: string
  ): void;

  // Selection
  setSelection(selection: Partial<DiagramStore['selection']>): void;

  // Persistence
  saveToJSON(): string;
  loadFromJSON(json: string): void;
  reset(): void;
}
```

---

## 9. File Structure

```
barker-erd/
├── src/
│   ├── types/
│   │   └── diagram.ts              Canonical Diagram schema (Section 5)
│   ├── store/
│   │   ├── diagramStore.ts         Zustand store (Section 8)
│   │   └── history.ts              zundo undo/redo middleware
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── Canvas.tsx          React Flow wrapper
│   │   │   ├── EntityNode.tsx      Custom node component
│   │   │   └── BarkerEdge.tsx      Custom edge component (handles all variants)
│   │   ├── panels/
│   │   │   ├── Toolbar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── PropertyPanel.tsx
│   │   └── ui/                     Shared primitives (Button, Input, etc.)
│   ├── lib/
│   │   ├── validation/
│   │   │   └── barkerRules.ts      Validator for Barker conventions (Section 12)
│   │   ├── export/
│   │   │   ├── toPNG.ts
│   │   │   ├── toSVG.ts
│   │   │   └── toSQL.ts            SQL DDL generator (Phase 2)
│   │   └── import/
│   │       └── fromJSON.ts
│   ├── hooks/
│   └── App.tsx
├── public/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── DESIGN.md                       This document
└── README.md
```

---

## 10. Phase 1 Task Breakdown

Tasks listed in dependency order. Each task should be individually small enough to produce a working commit.

1. **Project scaffolding.** ✓ Initialize a Vite plus React plus TypeScript project. Install Tailwind CSS v4 via `@tailwindcss/vite`, `@xyflow/react`, Zustand, zundo, html-to-image. Configure Tailwind via the Vite plugin (no `tailwind.config.js` in v4) and base CSS.
2. **Type definitions.** ✓ Create `src/types/diagram.ts` with the exact interfaces from Section 5.
3. **Minimal Zustand store.** ✓ Implement `DiagramStore` with entity CRUD, attribute CRUD, and relationship CRUD. Skip history and validation for now.
4. **EntityNode rendering.** ✓ Render a read only entity box: rounded rectangle, name in bold uppercase, attribute list below with prefix indicators (`#`, `*`, `o`).
5. **BarkerEdge rendering (basic).** ✓ Implement one edge variant first: solid line with crow's foot on the 'many' end, no UID bar, no label. Verify the custom edge registers correctly with React Flow.
6. **Canvas integration.** ✓ Wire EntityNode and BarkerEdge into React Flow. Test basic drag, zoom, and pan.
7. **EntityNode inline editing.** ✓ Click name to rename. Double click empty area to add attribute. Click attribute prefix to cycle through `#`, `*`, `o`. Click attribute name to rename. Delete key removes attribute.
8. **Relationship creation UX.** ✓ Drag from an entity's connection handle to another entity to create a Relationship with sensible defaults (mandatory 1:m).
9. **PropertyPanel.** ✓ When an entity or relationship is selected, show detailed fields in the right panel. For relationships, expose cardinality, optionality, label, and UID bar for each end.
10. **All relationship variants.** ✓ Extend BarkerEdge to render every combination: solid or dashed, crow's foot direction, UID bar, verb labels at both ends. This task is visually intensive, budget time accordingly.
11. **m:m special flow.** ✓ Add a menu item "Create Many to Many" that takes two selected entities, prompts for an intersection entity name, and calls `createManyToMany` on the store.
12. **Recursive relationship.** ✓ Allow Relationship creation when source equals target. BarkerEdge renders a self loop with four movable corner positions.
13. **Save and Load JSON.** ✓ File download with a generated name, file upload that replaces the current diagram. Confirm overwrite if unsaved changes exist.
14. **PNG export.** ✓ Use `html-to-image` on the React Flow container. Strip UI chrome (handles, controls) before capture. Fit all nodes in frame via `getNodesBounds` / `getViewportForBounds`.
15. **SVG export.** ✓ Use `html-to-image` `toSvg` with the same fit-all-nodes approach as PNG export.

### Phase 1 acceptance test

The tool should be able to reproduce the **Broken Phone Wizard Part 1** diagram from Ivey technical note W38454 (page 8), which uses only Phase 1 features: 6 entities, a mandatory 1:1 between CUSTOMER and CUST_PROFILE, mandatory 1:m between CUSTOMER and DEVICE, another between DEVICE and REPAIR_TICKET, and an m:m between TECHNICIAN and REPAIR_TICKET resolved through a TECH_TICKET intersection entity.

---

## 11. Future Phases

### Phase 2: Weak entities, recursion, half optional, SQL export

Acceptance test: reproduce the **Broken Phone Wizard Part 2** diagram from W38454 (page 14), which adds UID bars on TECH_TICKET's relationships, a recursive supervise relationship on TECHNICIAN, and optional side variants on several relationships.

### Phase 3: Super entities, exclusive arcs, polish

Covers super entity nesting (the VEHICLE containing CAR and TRUCK example on W38454 page 13), exclusive relationship arcs (the EMPLOYEE, DEPARTMENT, PROJECT, CONTRACT example on W38454 page 13), undo and redo, grid snap, keyboard shortcuts, and optional Tauri desktop build.

---

## 12. Barker Rules Reference

The validation layer in `src/lib/validation/barkerRules.ts` should flag the following conditions. Warnings surface in the StatusBar and highlight the offending element on hover.

### Naming conventions

- Entity names must be uppercase and singular.
- Attribute names must be lowercase.
- Relationship labels should be verbs (best effort only, not programmatically verifiable, but UI should warn on empty labels).

### Structural rules

- Every entity must have at least one identifier attribute, unless it is a weak entity identified via UID bar on an incoming relationship end.
- Every relationship must have non empty labels on both ends.
- Every relationship must specify cardinality and optionality on both ends.
- No direct many to many: both ends cannot be `'many'`.

### Weak entity rules

- A weak entity relies on one or more strong entities for identification, indicated by a UID bar on the relationship end pointing to the weak entity.
- A weak entity may have partial identifier attributes in addition to inherited identifiers.

### Exclusive arc rules

- An exclusive arc must include at least two relationships.
- All relationships in an exclusive arc must share the same source entity.

---

## 13. Open questions for later

- Should the persisted JSON include viewport state (zoom and pan position)? The store holds viewport, but the `Diagram` interface does not. Revisit when implementing save and load.
- How to handle copy and paste of entities with attributes? Generate new IDs but preserve structure. Defer to Phase 2 or 3.
- Theming: light mode only for Phase 1, dark mode in Phase 3.

---

## 14. Context for future Claude Code sessions

### Where we are

All design work is complete. No code has been written yet. The immediate next step is **Phase 1 Task 1: Project scaffolding** (Section 10).

### How to proceed

1. Read this document in full before making changes.
2. Use the file structure in Section 9 as the target layout.
3. Respect the Schema in Section 5 as the single source of truth for the Diagram data model. If a feature seems to require changing the schema, raise it explicitly rather than silently modifying interfaces.
4. When implementing Phase 1 tasks, proceed in the dependency order given in Section 10. Each task should produce a working commit.
5. Keep a running `CHANGELOG.md` alongside this document to record what has been implemented.

### Conventions

- All code is TypeScript, no plain JavaScript files.
- Functional React components only, no class components.
- Prefer composition over inheritance for custom node and edge variants.
- Keep Tailwind utility classes inline, avoid creating CSS files unless truly global.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).

### Reference

The canonical Barker notation spec is Ivey technical note W38454 by Derrick Neufeld (2024). A copy should be kept in the project under `docs/W38454.pdf` for reference. All visual conventions and rule enforcement should match this document.

---

## Local Development

```bash
npm install
npm run dev
```

To deploy to GitHub Pages:

```bash
npm run deploy
```
