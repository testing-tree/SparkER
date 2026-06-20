# Changelog

## Phase 1 — Complete (2026-04-20)

### Task 15 — SVG export
- Toolbar "Export SVG" button: `html-to-image` `toSvg` on `.react-flow__viewport`
- Same fit-all-nodes approach as PNG: `getNodesBounds` + `getViewportForBounds` at 1600×1200
- Handles and controls hidden during capture, restored in `finally` block
- Downloads `<diagram-name>.svg`

### Task 14 — PNG export
- Toolbar "Export PNG" button: `html-to-image` `toPng` on `.react-flow__viewport`
- `getNodesBounds(getNodes())` + `getViewportForBounds(bounds, 1600, 1200, 0.5, 2, 40)` fits all entities
- `.react-flow__handle` and `.react-flow__controls` hidden during capture
- Downloads `<diagram-name>.png`

### Task 13 — Save and Load JSON
- Toolbar "Save JSON": `saveToJSON()` → `Blob` → anchor download → `<name>.json`
- Toolbar "Load JSON": hidden `<input type="file" accept=".json">`, `FileReader`, `loadFromJSON(json)`
- Confirms overwrite (`window.confirm`) when diagram has existing entities
- Diagram name input (inline text field at top of toolbar): calls `setDiagramName` on blur/Enter
- `setDiagramName(name)` action added to `DiagramStore`

### Task 12 — Recursive relationship (self-loop enhancements)
- Self-loop geometry: ARM + 270° arc + ARM for four movable corners
- Per-corner geometry table (`geo` Record): correct exit/entry sides, ARM directions, sweep flags
  - top-right: exit=Right, entry=Top, sweep=0
  - top-left: exit=Left, entry=Top, sweep=1
  - bottom-right: exit=Right, entry=Bottom, sweep=1
  - bottom-left: exit=Left, entry=Bottom, sweep=0
- Corner picker: four dots outside entity corners, visible when edge selected; click moves loop
- Large transparent hit circle (r=18) behind each visible dot (r=5) for easy clicking

### Task 11 — m:m atomic creation
- `createManyToMany` store action: creates intersection entity + two 1:m relationships atomically
- Intersection entity positioned at midpoint of source and target entities

### Verb label flip (labelFlipped)
- `RelationshipEnd.labelFlipped?: boolean` added to schema and store
- Clicking a verb label in BarkerEdge toggles `labelFlipped` via `updateRelationshipEnd`
- Right/Left: flipped shifts label from y−10 to y+14; Top/Bottom: flipped shifts from x+8 to x−14

---

## [Unreleased]

### Phase 1

#### Task 10 — Full BarkerEdge rendering (2026-04-19)
- Verb labels: SVG `<text>` at each end, positioned LABEL_ALONG=16px along edge + LABEL_PERP=10px perpendicular; skipped when label is empty string
- UID bars: `<UidBar>` component draws a 12px perpendicular tick at UID_DIST=16px from the entity; rendered when `uidBar: true`
- Crow's foot dashes now per-end: optional end gets `strokeDasharray="6 4"`, mandatory end solid

#### Fix — half-dashed edge rendering (2026-04-19)
- Replaced single `BaseEdge` with two `<path>` elements sharing same `d`, each using `pathLength={1}` normalization
- Source half (0→50%): solid `"0.5 1"` or dashed `"0.04 0.03 × 7 … 10"` per sourceEnd.optionality
- Target half (50%→100%): solid `"0 0.5 0.5 1"` or dashed `"0 0.5 0.04 0.03 × 7 … 10"` per targetEnd.optionality
- Wide transparent `strokeWidth={20}` path retained for hit-area / click-to-select

#### Fix — handle border positioning (2026-04-19)
- Replaced single shared `handleStyle` with per-position `handleStyleFor(pos, hovered)`
- Explicit `top/bottom/left/right` + `transform` overrides ensure each dot is centered exactly on its entity border edge

#### Fix — new attribute default kind (2026-04-19)
- `commitNewAttr` in EntityNode checks `entity.attributes.some(a => a.kind === 'identifier')` before adding
- First attribute defaults to `identifier`; subsequent attributes default to `required`

#### Fix — PropertyPanel width (2026-04-19)
- Increased panel from `w-60` (240px) to `w-72` (288px) so "mandatory"/"optional" toggle buttons render without truncation

#### Task 9 — PropertyPanel (2026-04-19)
- Created `src/components/panels/PropertyPanel.tsx`
- Reads `selection` slice from Zustand (no RF hooks needed — works outside `<ReactFlow>`)
- No selection: hint text; Entity selected: name display + edit hint
- Relationship selected: `EndSection` for source and target ends
  - Cardinality toggle (one / many), Optionality toggle (mandatory / optional)
  - Label input (local state, commits on blur / Enter), UID Bar checkbox
  - Calls `updateRelationshipEnd(relId, endKey, patch)` on each change
- `App.tsx` updated to flex layout: Canvas (flex-1) + PropertyPanel (w-60, fixed sidebar)

#### Task 8 — Relationship creation UX (2026-04-19)
- `Canvas.tsx` rewrote with `onConnect` → `addRelationship` (source:one/mandatory, target:many/mandatory defaults)
- Append-only `useEffect` sync: new store entities/relationships appear as RF nodes/edges without full state reset
- `onSelectionChange` → `setSelection` in store so PropertyPanel can read current selection
- `<Panel position="top-left">` with "+ Add Entity" button — grid-based positioning (4 columns, 220×180 spacing)
- `relationshipToEdge` simplified (BarkerEdge reads live data from store by id, no data prop needed)

#### Fix — BarkerEdge optionality rendering (2026-04-19)
- BarkerEdge now reads live relationship from store by `id` (EdgeProps)
- `strokeDasharray: '6 4'` applied to both BaseEdge line and CrowsFoot tines when either end is optional
- Removed `BarkerEdgeData` export — edge data prop no longer used

#### Task 7 — EntityNode inline editing (2026-04-19)
- Double-click entity name header → inline input (blur/Enter commits, Escape cancels)
- Double-click empty body area of entity → adds attribute row with `kind: required`
- Single-click attribute prefix (#/*/o) → cycles kind: identifier→required→optional→identifier
- Single-click attribute name → inline edit (blur/Enter commits, Escape cancels)
- Delete/Backspace on selected entity node → `deleteEntity` (cascades relationships in store)
- Delete/Backspace on selected relationship edge → `deleteRelationship`
- EntityNode now reads live entity from store by `entityId` — edits are immediately visible
- All inputs call `e.stopPropagation()` on keyDown to prevent RF canvas shortcuts during editing
- Store initial state changed to empty diagram (blank canvas on startup)

#### Fix — BarkerEdge gap & edge interactivity (2026-04-19)
- Set `offset: 0` in `getSmoothStepPath` — path now starts flush at the handle/entity edge
- Replaced `<path>` with `<BaseEdge>` for the main line — adds invisible wider hit area for click-to-select
- Added `position: relative` to EntityNode root div for correct handle CSS containment

#### Task 6 — React Flow canvas integration (2026-04-19)
- Created `src/components/canvas/Canvas.tsx`: ReactFlow wrapper wired to Zustand store
- `entityToNode` / `relationshipToEdge` convert store model to RF format
- `nodeTypes` / `edgeTypes` defined outside component (stable references, no re-init)
- `onNodeDragStop` syncs final drag position back to store
- EntityNode updated: accepts `NodeProps`, adds 8 invisible handles (4 source + 4 target, one per side) for RF edge routing
- BarkerEdge updated: accepts `EdgeProps`, uses `sourceX/Y` + `targetX/Y` from RF
- Store seeded with CUSTOMER + DEVICE entities and their 1:m relationship
- `@xyflow/react/dist/style.css` imported in `main.tsx`
- App.tsx now just renders `<Canvas />`

#### Task 5 — BarkerEdge rendering, basic (2026-04-19)
- Created `src/components/canvas/BarkerEdge.tsx`: pure SVG `<g>` component
- Renders solid line with crow's-foot tines on the `'many'` end
- Tine angles computed via 2D rotation (works for any line direction, not just horizontal)
- App.tsx uses `useLayoutEffect` + refs to measure real entity box bounds for precise connection points
- Hardcoded CUSTOMER (one) ↔ DEVICE (many) demo visible at `/`

#### Task 4 — EntityNode rendering (2026-04-19)
- Created `src/components/canvas/EntityNode.tsx`: standalone read-only entity box
- Rounded border, bold uppercase name header, attribute list with `#`/`*`/`o` prefixes
- Identifiers rendered with dotted underline per Barker convention
- Hardcoded CUSTOMER test entity in `App.tsx` for visual verification

#### Task 3 — Zustand store (2026-04-19)
- Created `src/store/diagramStore.ts` with full `DiagramStore` interface
- Entity CRUD, attribute CRUD (with reorder), relationship CRUD
- Atomic `createManyToMany` action (intersection entity + 2 relationships)
- `saveToJSON` / `loadFromJSON` / `reset` persistence helpers
- Uses `crypto.randomUUID()` (no extra dependency)

#### Task 2 — Type definitions (2026-04-19)
- Created `src/types/diagram.ts` with all interfaces from DESIGN.md Section 5
- `Diagram`, `Entity`, `Attribute`, `Relationship`, `RelationshipEnd`, `ExclusiveArc`

#### Task 1 — Project scaffolding (2026-04-19)
- Initialized Vite + React 19 + TypeScript project
- Installed `@xyflow/react`, `zustand`, `zundo`, `html-to-image`
- Installed Tailwind CSS v4 via `@tailwindcss/vite` plugin
- Configured `vite.config.ts` with Tailwind plugin
- Replaced boilerplate CSS with minimal base styles and Tailwind import
- Cleaned up Vite template boilerplate in `App.tsx`
- Verified `npm run build` passes with zero errors
