# SparkER

[**A Barker notation ER diagram editor**](https://testing-tree.github.io/SparkER/)

![Screenshot placeholder](./docs:/screenshot.png)

---

## Background

Entity-Relationship (ER) data modeling is a foundational skill in database design. **Barker’s Notation** remains the graphical standard taught across many universities and professional programs—including the Ivey Business School, where this project originated.

The challenge is that mainstream ERD tools, such as Lucidchart, draw.io, dbdiagram.io, and Mermaid, do not fully support the specific visual syntax of Barker’s Notation. This notation requires a unique set of rules: solid and dashed lines to denote mandatory and optional relationships, verb labels at both ends of every relationship, UID bars for weak entity identification, and exclusive relationship arcs. Consequently, students and practitioners are often forced to manually draw these diagrams or struggle with tools not built for the task.

This project bridges that gap. It is a custom-built, web-based visual editor designed from the ground up to generate diagrams that are fully compliant with Barker’s Notation standards.

The tool is officially named **SparkER**, a nod to Entity-Relationship modelling, and to the idea that a single course can spark something that outlasts the semester. The name was suggested by Professor Derrick Neufeld of Ivey Business School.

> During development, the project carried the codename **CD_002fa7**, inspired by International Klein Blue (#002FA7), also the iconic cover color of David Tao’s self-titled debut album (1997). As this represents my first independent project, the choice of color serves both as a personal milestone and a tribute to the artistry of David Tao.

> 项目名称源自国际克莱因蓝 (#002FA7)。它也是音乐人陶喆 (David Tao) 首张个人专辑《陶喆》(1997) 的封面颜色。这同样是我首次尝试独立完成这样的项目，使用此颜色谨作纪念和表示对陶喆音乐创作的喜爱。

---

## Privacy & Data Security

SparkER runs entirely in your browser. No data ever leaves your device.

- No backend server, no database, no cloud storage
- Diagrams are saved only to local files you explicitly export
- No analytics, cookies, tracking, or third-party services
- No outbound network calls of any kind

A Content Security Policy (`connect-src 'none'`) is enforced at the browser level to make this a technical guarantee. 

Click the **Privacy** button in the app for full details and instructions on how to verify this yourself.

---

## Features

### Entities
- Create entity boxes (rounded rectangles, uppercase singular names) via the toolbar
- Add and edit attributes inline; prefix symbols cycle through `#` (identifier), `*` (required), and `o` (optional) on click
- First attribute added to an entity defaults to `#` (identifier); subsequent attributes default to `*` (required)
- While editing an attribute name, press **Enter** to confirm and immediately jump to a new attribute row (the new name is auto-selected, ready to type over); press **Escape** or click away to confirm without adding a new row
- Clear an attribute name entirely, then press **Backspace** again to delete that attribute
- Delete entities and all connected relationships with the Delete key
- Select an entity to reveal up/down arrows (left) and data type tags (right) outside the entity box for each attribute; click the arrows to reorder attributes, click the data type tag to cycle through `auto` / `INT` / `VARCHAR(255)` / `TEXT` / `DATE` / `BOOLEAN` / `DECIMAL(10,2)` / `FLOAT`

### Super-entities and Sub-entities
- Super-entity / sub-entity hierarchies are supported for display and SQL export; diagrams containing them can be loaded via JSON
- The super-entity auto-expands to contain its sub-entities; a labeled separator line divides the name/attributes section from the sub-entity area
- Sub-entities inherit a foreign-key-as-primary-key in SQL export, referencing their super-entity
- Deleting a super-entity cascades and removes all its sub-entities and their relationships

### Relationships
- Drag from any of an entity's four connection handles to create a relationship
- Relationships route with clean right-angle lines, automatic side selection with U-turn avoidance, and **distributed connection points** (multiple lines entering or exiting the same entity side are spread evenly, never stacked)
- Configure per-end properties in the Properties panel: cardinality (one / many), optionality (mandatory / optional), verb label, and UID bar
- Optional ends render as dashed lines; the two halves of a relationship line are styled independently (half-dashed, half-solid)
- Crow's foot symbol on the "many" end; UID bar tick mark for weak entity identification
- Verb labels default to alternating sides of the line for cleaner readability; click any label to flip it to the opposite side
- **Manual side selection:** select a relationship to reveal connection dots on each connected entity. Click any dot to route the line through that side of the entity box. The Properties panel shows the current side; click it to restore auto-routing
- **Draggable waypoints:** when a side has been manually chosen, a draggable handle appears at the line bend. Drag it to reposition; on release it snaps to the nearest valid orthogonal corner. Double-click the handle to clear the waypoint and return to auto-routing
  > Manual side selection and waypoint dragging give you full control over line layout, but may produce routings that the auto mode would avoid (e.g. visually awkward paths). Adjust manually or restore auto-routing if needed.

### Recursive Loops
- Add a recursive relationship to any entity via the **Recursive** button
- The loop renders as a smooth circular arc at one of four corners of the entity; the exit half and entry half are styled independently (dashed / solid) based on their optionality
- Click the corner indicator dots (visible when the loop is selected) to reposition the loop and avoid overlap with other lines
- Drag to create a recursive relationship directly by connecting any handle back to the same entity; the corner is determined automatically from the handles used
- **Recursive m:m**: creates an intersection entity offset from the selected entity and connects it with two 1:m relationships, forming a V-shape for recursive many-to-many scenarios

### Exclusive Relationship Arcs
- Exclusive arcs are supported for display and deletion; diagrams containing them can be loaded via JSON
- The arc renders as a quadratic Bézier curve passing through all selected relationship endpoints on the source entity side, with a filled dot at each endpoint
- Click the arc to select it (highlights in blue); the Properties panel shows the arc's source entity and target entities
- Delete a selected arc with the **Delete** key or via the **Delete Arc** button in the Properties panel
- Arcs are automatically cleaned up when a relationship they reference is deleted

### Many-to-Many Relationships
- Direct many-to-many is not allowed in Barker notation; the Properties panel warns when both ends are set to "many"
- Create an intersection entity manually, then connect it with two 1:m relationships

### Properties Panel
- Click any entity, relationship, or arc to open its Properties panel on the right
- **Entity**: shows entity type (entity / super-entity / sub-entity), hierarchy info, and an **Actions** section with context-sensitive operations: Recursive and Recursive m:m
- **Relationship**: configure cardinality, optionality, verb label, and UID bar for each end independently; many-to-many warning shown inline
- **Arc**: shows source entity and target entity list; Delete Arc button

### Canvas
- Pan and zoom freely; zoom controls in the bottom-left corner
- Snap-to-center alignment guides appear (in #002FA7) when dragging an entity near the horizontal or vertical centre line of another entity
- Undo / Redo with Ctrl+Z / Ctrl+Shift+Z (or Cmd equivalents on macOS)

### Export and Save
- **Save JSON**: download the full diagram as a `.json` file for later editing
- **Load JSON**: restore a previously saved diagram
- **Export PNG**: white-background image cropped tightly to diagram content
- **Export SVG**: scalable vector export, also cropped to content
- **Export SQL**: generates `CREATE DATABASE` / `USE` header from the diagram name, followed by `CREATE TABLE` statements sorted with independent tables (no foreign keys) before dependent ones; attribute data types follow manual overrides when set, otherwise are auto-inferred (`*_id` → `INT`, `*date*` → `DATE`, others → `VARCHAR(255)`)

---

## How to Use

### Interface overview

| Location | Controls |
|:---|:---|
| **Top-left** | Diagram name (click to edit), **Add Entity**, **Add Attribute** (when an entity is selected) |
| **Top-right** | **Save JSON**, **Load JSON**, **Export PNG**, **Export SVG**, **Export SQL** |
| **Bottom-left** | Zoom controls (zoom in, zoom out, fit-to-view), **?** help button |
| **Bottom-right** | **Lock/Unlock** viewport, **Undo**, **Redo** |
| **Bottom edge** | **Privacy** link (opens privacy & data use info) |
| **Right side** | **Properties** panel (appears when an entity, relationship, or arc is selected) |

### Hover tooltips

Hover over any interactive control for about one second to see a brief explanation. The following elements have tooltips:

| Element | Tooltip |
|:---|:---|
| Entity name | Double-click to rename |
| Attribute prefix (`#` `*` `o`) | Identifier / Required / Optional — click to cycle |
| Attribute name | Click to edit — Enter to confirm and add next row |
| Data type tag | Click to set SQL data type |
| Side connection dots | Connected side / Switch to top, right, bottom, left |
| Cardinality toggle | Single entity / Multiple entities (crow's foot) |
| Optionality toggle | Required (solid line) / Optional (dashed line) |
| Label input | Relationship verb label |
| UID bar checkbox | Weak entity identification bar |
| Side auto / side name | Click a side dot on the entity box / Click to restore auto-routing |
| Recursive / Recursive m:m | Add a self-referencing relationship / Create an intersection entity |
| Delete Arc | Remove this exclusive arc constraint |
| Verb label (on the line) | Click to flip to other side of the line |
| Waypoint handle (on the bend) | Drag to adjust corner / Double-click to reset |

### 1. Create and name entities

Click **Add Entity** (top-left toolbar) to create a new entity box labelled `ENTITY`. The entity appears on the canvas with a staggered position. Double-click the entity name to rename it (Barker convention: uppercase, singular — e.g. `CUSTOMER`). The name is auto-converted to uppercase with spaces replaced by underscores; maximum 64 characters.

### 2. Add and manage attributes

Select an entity (click it), then click **Add Attribute** (top-left). The first attribute defaults to `#` (identifier / primary key); subsequent attributes default to `*` (required / NOT NULL). Click the prefix symbol to cycle through:

- `#` — identifier (primary key)
- `*` — required (NOT NULL)
- `o` — optional (nullable)

Click the attribute name to rename it (Barker convention: lowercase, e.g. `customer_id`). Spaces are auto-converted to underscores; maximum 64 characters. Press **Enter** to confirm and immediately jump to a new attribute row. Press **Escape** or click away to finish editing. Press **Backspace** on an empty attribute name to delete it.

**Reorder attributes:** When an entity is selected, each attribute row shows small up/down arrow buttons to the left of the entity box. Clicking them moves the attribute up or down one position.

**Set SQL data type:** When an entity is selected, each attribute row shows a data type tag to the right of the entity box (e.g. `INT`, `VARCHAR(255)`). Click the tag to cycle through `auto` (infers type from the name) → `INT` → `VARCHAR(255)` → `TEXT` → `DATE` → `BOOLEAN` → `DECIMAL(10,2)` → `FLOAT`. The chosen type is used in SQL export.

### 3. Connect entities with relationships

Hover over an entity to reveal four blue connection handles (one on each side). Drag from any handle to any handle on another entity. A relationship line appears with default settings (1:1 mandatory). Relationship lines use clean orthogonal (right-angle) routing.

### 4. Configure relationships

Click the relationship line to select it. The **Properties** panel opens on the right side. For each end (source and target) you can configure:

- **Cardinality:** `one` or `many`. The "many" end displays a crow's foot symbol.
- **Optionality:** `mandatory` (solid line) or `optional` (dashed line). The two halves of a relationship line are styled independently.
- **Verb label:** descriptive text placed along the line (e.g. "owns", "belongs to"). Click the label to flip it to the opposite side of the line.
- **UID bar:** tick mark indicating weak entity identification (FK-as-PK).
- **Side:** which side of the entity box the line connects to. By default, the side is chosen automatically. To override, click one of the connection dots that appear on the entity boxes when a relationship is selected. Click the side name in the Properties panel to restore automatic selection.

**Dragging a waypoint:** after manually choosing a side, a draggable circle appears at the line bend. Drag it to reposition the corner; on release it snaps to the nearest right-angle position. Double-click the handle to clear the waypoint. Note that manual adjustment may produce layouts the automatic routing would avoid; adjust as needed.

Common configurations:

| Scenario | Source end | Target end |
|:---|:---|---|
| One customer owns many devices | one / mandatory | many / mandatory |
| Customer may optionally have a profile | one / optional | one / mandatory |
| Technician optionally supervises others | one / optional | many / optional |

### 5. Copy and paste entities

Select one or more entities, then press **Ctrl/Cmd+C** to copy. Press **Ctrl/Cmd+V** to paste. Pasted entities appear to the right of their originals, avoiding overlap with existing entities. All attributes (including data type hints) are preserved; relationships are not copied.

### 6. Lock the viewport

Click the **Lock** button (bottom-right, above Undo). When locked, the canvas ignores pan, zoom, select, and drag interactions — useful for preventing accidental edits during presentations or review. The button text changes to **Locked**; click again to unlock.

### 7. Export your work

Use the top-right toolbar buttons:

- **Save JSON:** download the full diagram as a `.json` file for later editing or sharing.
- **Load JSON:** restore a previously saved diagram from a file.
- **Export PNG:** download a white-background image cropped tightly to your diagram content.
- **Export SVG:** download a scalable vector version, also cropped to content.
- **Export SQL:** generate `CREATE DATABASE` / `USE` header followed by `CREATE TABLE` DDL statements. Tables are sorted with independent tables (no foreign keys) before dependent ones. Attribute data types follow your manual overrides when set.

### 8. Undo / Redo

Click **Undo** / **Redo** (bottom-right) or use keyboard shortcuts: **Ctrl/Cmd+Z** (undo) and **Ctrl/Cmd+Shift+Z** or **Ctrl/Cmd+Y** (redo).

### 9. Pan, zoom, and snap

**Pan** by dragging on empty canvas space. **Zoom** with the scroll wheel or the bottom-left zoom buttons. The **fit-to-view** button (bottom-left, third from top) automatically adjusts zoom to show all entities. When dragging an entity near the center alignment of another, a blue snap guide appears.

---

## Keyboard Shortcuts

| Key | Action |
|:---|:---|
| `Ctrl/Cmd + C` | Copy selected entity (or entities) |
| `Ctrl/Cmd + V` | Paste copied entities |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + A` | Select all entities |
| `Delete` / `Backspace` | Delete selected entity, relationship, or arc |
| `Escape` | Deselect all / cancel editing |
| `Enter` (while editing attribute name) | Confirm and jump to next new attribute row |
| `Backspace` (on empty attribute name) | Delete the attribute |

---

## Barker Notation Reference

This editor follows the Barker notation specification as described in Ivey Publishing technical note **W38454 "Data Modelling with Barker Notation"** by Derrick Neufeld (2024).

Key rules enforced or supported by this editor:

- Entity names: uppercase, singular
- Attribute names: lowercase
- Every relationship line must have verb labels on both ends
- Mandatory relationships: solid lines; optional relationships: dashed lines
- The "many" end of a relationship shows a crow's foot symbol
- Weak entity identification: UID bar tick mark on the relationship line
- Many-to-many relationships require an intersection entity (direct m:m is flagged as invalid)
- Super-entity / sub-entity hierarchies with visual nesting and FK-as-PK in SQL output
- Exclusive relationship arcs: Bézier arc with endpoint dots indicates mutually exclusive relationship participation

---

## Tech Stack

| Concern | Choice |
|:---|:---|
| Framework | React 19 with TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS v4 |
| Canvas / node editor | @xyflow/react v12 (React Flow) |
| State management | Zustand v5 |
| Undo / Redo | zundo |
| Image export | html-to-image |

---

## Advanced Features

Sub-entity creation and exclusive arc creation are available in the experimental branch [**CD_002fa7**](https://github.com/testing-tree/CD_002fa7), which serves as a development sandbox for features under exploration. Diagrams created there (including sub-entities and arcs) can be loaded in SparkER via JSON import for viewing, SQL export, and deletion.

---

## Design Document

The full design rationale, data schema, component architecture, and phase-by-phase task breakdown are in [`DESIGN.md`](./DESIGN.md).
