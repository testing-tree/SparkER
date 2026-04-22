# CD_002fa7

**A strict Barker notation ER diagram editor — built for clarity, built for the web.**

&nbsp;

[**→ Open Live Editor**](https://testing-tree.github.io/CD_002fa7/)

&nbsp;

![Screenshot placeholder](docs/screenshot.png)

---

## Background

Entity-Relationship (ER) data modelling is a foundational skill in database design, and Barker notation is the graphical standard taught in many university and professional programmes — including Ivey Business School, where this project originated.

The problem is that every mainstream ERD tool — Lucidchart, draw.io, dbdiagram.io, Mermaid — does not faithfully implement Barker notation, which has its own specific visual rules: solid and dashed lines for mandatory and optional relationships respectively, verb labels required on both ends of every relationship line, UID bars for weak entity identification, and exclusive relationship arcs. Students and practitioners who need strict Barker diagrams are left hand-drawing or adapting tools that were never designed for this purpose.

This project aims to fill that gap. It is a web-based visual editor designed from the ground up to produce diagrams that fully conform to the Barker notation specification.

The project name comes from International Klein Blue (#002FA7) — also the cover colour of David Tao's (陶喆) self-titled debut album *David Tao* (1997). This is also the first project I have independently completed from start to finish. I chose this colour as the codename as a small memorial to the experience and as an expression of my admiration and affection for David Tao's music.

> 项目名称源自国际克莱因蓝 (#002FA7)。它也是音乐人陶喆 (David Tao) 首张个人专辑《陶喆》(1997) 的封面颜色。这同样是我首次尝试独立完成这样的项目，以此颜色作为代号以表示我对此的一点纪念和对陶喆音乐创作的喜爱和敬意。

---

## Features

### Entities
- Create entity boxes (rounded rectangles, uppercase singular names) via the toolbar
- Add and edit attributes inline; prefix symbols cycle through `#` (identifier), `*` (required), and `o` (optional) on click
- First attribute added to an entity defaults to `#` (identifier); subsequent attributes default to `*` (required)
- While editing an attribute name, press **Enter** to confirm and immediately jump to a new attribute row (the new name is auto-selected, ready to type over); press **Escape** or click away to confirm without adding a new row
- Clear an attribute name entirely, then press **Backspace** again to delete that attribute
- Delete entities and all connected relationships with the Delete key

### Relationships
- Drag from any of an entity's four connection handles to create a relationship
- Relationships route orthogonally with automatic side selection and **distributed connection points** (multiple lines entering or exiting the same entity side are spread evenly, never stacked)
- Configure per-end properties in the Properties panel: cardinality (one / many), optionality (mandatory / optional), verb label, and UID bar
- Optional ends render as dashed lines; the two halves of a relationship line are styled independently (half-dashed, half-solid)
- Crow's foot symbol on the "many" end; UID bar tick mark for weak entity identification

### Self-Reference Loops
- Add a recursive relationship to any entity via the "Self-reference" button
- The loop renders as a smooth circular arc at one of four corners of the entity
- Click the corner indicator dots (visible when the loop is selected) to reposition the loop and avoid overlap with other lines
- Drag to create a self-reference directly by connecting any handle back to the same entity; the corner is determined automatically from the handles used

### Many-to-Many Relationships
- Direct many-to-many is not allowed in Barker notation; the Properties panel warns when both ends are set to "many"
- Create an intersection entity manually, then connect it with two 1:m relationships

### Canvas
- Pan and zoom freely; zoom controls in the bottom-left corner
- Snap-to-center alignment guides appear (in #002FA7) when dragging an entity near the horizontal or vertical centre line of another entity
- Undo / Redo with Ctrl+Z / Ctrl+Shift+Z (or Cmd equivalents on macOS)

### Export and Save
- **Save JSON**: download the full diagram as a `.json` file for later editing
- **Load JSON**: restore a previously saved diagram
- **Export PNG**: white-background image cropped tightly to diagram content
- **Export SVG**: scalable vector export, also cropped to content
- **Export SQL**: generate `CREATE TABLE` statements from the diagram, including primary keys, foreign keys, NOT NULL constraints, and composite keys for weak entities

---

## How to Use

### 1. Create your first entity

Click **Add Entity** in the top-left toolbar. A new entity box labelled `ENTITY` appears on the canvas. Double-click the name to rename it (Barker convention: uppercase, singular — e.g. `CUSTOMER`).

### 2. Add attributes

Select the entity, then click **Add Attribute**. A new attribute row appears with the `#` prefix (or `*` if identifiers already exist). Click the prefix symbol to cycle it:

- `#` — identifier (primary key)
- `*` — required (not null)
- `o` — optional (nullable)

Click the attribute name to rename it (Barker convention: lowercase, e.g. `customer_id`). Press **Enter** to confirm and immediately start a new row; press **Escape** or click away to finish without adding another.

### 3. Connect two entities

Hover over an entity to reveal four blue connection handles, one on each side. Drag from any handle to any handle on another entity. A relationship line appears with default settings (1:1 mandatory).

### 4. Configure the relationship

Click the relationship line to select it. The **Properties** panel opens on the right. Set cardinality, optionality, and verb labels for the source end and the target end independently.

Common configurations:

| Scenario | Source end | Target end |
|---|---|---|
| One customer owns many devices | one / mandatory | many / mandatory |
| Customer may optionally have a profile | one / optional | one / mandatory |
| Technician optionally supervises others | one / optional | many / optional |

### 5. Export

Use the buttons in the top-right corner. For sharing a diagram image, **Export PNG** produces a clean white-background file cropped to your diagram. For database implementation, **Export SQL** generates ready-to-use DDL statements.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Delete` / `Backspace` | Delete selected entity or relationship |
| `Escape` | Deselect all / cancel editing |
| `Ctrl/Cmd + A` | Select all entities |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
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

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | React 19 with TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS v4 |
| Canvas / node editor | @xyflow/react v12 (React Flow) |
| State management | Zustand v5 |
| Undo / Redo | zundo |
| Image export | html-to-image |

---

## Design Document

The full design rationale, data schema, component architecture, and phase-by-phase task breakdown are in [`DESIGN.md`](./DESIGN.md).
# CD_002fa7
