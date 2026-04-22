# #002FA7 — Barker ERD Editor

**A strict Barker notation ER diagram editor** built with React, TypeScript, and React Flow.

Live demo: _https://\<your-github-username\>.github.io/CD_002fa7/_

---

## Features
- Barker notation rendering — crow's feet, optionality dashes, UID bars, verb labels
- Self-reference loops — four-corner placement with smooth arc
- Inline editing — double-click entity name or attribute
- Relationship properties — per-end cardinality, optionality, label, UID bar
- Snap-to-center alignment guides
- Undo / Redo (Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z)
- Keyboard shortcuts — Escape, Ctrl+A, Delete/Backspace
- Save / Load JSON
- Export PNG / SVG
- SQL DDL export

## Screenshot
![screenshot](screenshot.png)

## Getting Started
```
npm install
npm run dev
```

## Deploy to GitHub Pages
```
npm run deploy
```

## Tech Stack
React 19, @xyflow/react v12, Zustand v5 + zundo, Tailwind CSS v4, html-to-image, Vite
# CD_002fa7
