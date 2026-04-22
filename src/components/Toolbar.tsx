import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Panel, useReactFlow, getNodesBounds, getViewportForBounds } from '@xyflow/react'
import { toPng, toSvg } from 'html-to-image'
import { useDiagramStore } from '../store/diagramStore'
import { toSQL } from '../lib/export/toSQL'
import SQLExportModal from './SQLExportModal'

const BTN  = 'w-fit min-w-[140px] px-3 py-1.5 bg-white border border-gray-300 rounded shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 cursor-pointer text-left'
const RBTN = 'w-full px-4 py-1.5 bg-white border border-gray-300 rounded shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 cursor-pointer text-left'

const PADDING = 40

export default function Toolbar() {
  const { getNodes }       = useReactFlow()
  const diagram            = useDiagramStore(s => s.diagram)
  const selection          = useDiagramStore(s => s.selection)
  const addEntity          = useDiagramStore(s => s.addEntity)
  const addAttribute       = useDiagramStore(s => s.addAttribute)
  const addRelationship    = useDiagramStore(s => s.addRelationship)
  const setDiagramName     = useDiagramStore(s => s.setDiagramName)
  const saveToJSON         = useDiagramStore(s => s.saveToJSON)
  const loadFromJSON       = useDiagramStore(s => s.loadFromJSON)

  const [nameVal, setNameVal]     = useState(diagram.name)
  const [sqlText, setSqlText]     = useState<string | null>(null)
  const [rightMinW, setRightMinW] = useState<number | undefined>(undefined)
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!rightPanelRef.current) return
    const btns = rightPanelRef.current.querySelectorAll<HTMLElement>('button')
    let max = 0
    btns.forEach(btn => { if (btn.offsetWidth > max) max = btn.offsetWidth })
    if (max > 0) setRightMinW(max)
  }, [])

  useEffect(() => { setNameVal(diagram.name) }, [diagram.name])

  const commitName = () => setDiagramName(nameVal.trim() || 'Untitled Diagram')

  // ── Canvas actions ───────────────────────────────────────────
  const handleAddEntity = useCallback(() => {
    const count = diagram.entities.length
    addEntity({
      name: 'ENTITY',
      attributes: [],
      position: { x: 80 + (count % 4) * 220, y: 80 + Math.floor(count / 4) * 180 },
    })
  }, [diagram.entities.length, addEntity])

  // ── Save / Load ──────────────────────────────────────────────
  const handleSave = useCallback(() => {
    const json = saveToJSON()
    const blob = new Blob([json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${diagram.name || 'diagram'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [saveToJSON, diagram.name])

  const handleLoad = () => fileInputRef.current?.click()

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = evt => {
      const json = evt.target?.result as string
      if (diagram.entities.length > 0 && !window.confirm('Replace current diagram?')) return
      loadFromJSON(json)
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [diagram.entities.length, loadFromJSON])

  // ── Export ───────────────────────────────────────────────────
  const exportImage = useCallback(async (format: 'png' | 'svg') => {
    const nodes = getNodes()
    if (nodes.length === 0) return

    const bounds = getNodesBounds(nodes)
    const width  = bounds.width  + PADDING * 2
    const height = bounds.height + PADDING * 2
    const { x, y, zoom } = getViewportForBounds(
      { x: bounds.x - PADDING, y: bounds.y - PADDING, width, height },
      width, height, 0.5, 2, 0,
    )

    const viewport = document.querySelector<HTMLElement>('.react-flow__viewport')
    if (!viewport) return

    const toHide = document.querySelectorAll<HTMLElement>('.react-flow__handle, .react-flow__controls')
    toHide.forEach(el => { el.style.visibility = 'hidden' })

    const options = {
      backgroundColor: '#ffffff',
      width,
      height,
      style: {
        width:     `${width}px`,
        height:    `${height}px`,
        transform: `translate(${x}px, ${y}px) scale(${zoom})`,
      },
    }

    try {
      const fn      = format === 'png' ? toPng : toSvg
      const dataUrl = await fn(viewport, options)
      const a       = document.createElement('a')
      a.href        = dataUrl
      a.download    = `${diagram.name || 'diagram'}.${format}`
      a.click()
    } finally {
      toHide.forEach(el => { el.style.visibility = '' })
    }
  }, [getNodes, diagram.name])

  // ── SQL export ───────────────────────────────────────────────
  const handleExportSQL = useCallback(() => {
    setSqlText(toSQL(diagram))
  }, [diagram])

  const oneEntity = selection.entityIds.length === 1

  return (
    <>
      {/* ── Left panel: canvas actions ── */}
      <Panel position="top-left">
        <div className="flex flex-col gap-1" style={{ width: 176 }}>
          <input
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onBlur={commitName}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitName() } }}
            placeholder="Untitled Diagram"
            className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded bg-white outline-none focus:border-gray-500 w-full"
          style={{ color: '#002FA7' }}
          />
          <button onClick={handleAddEntity} className={BTN}>Add Entity</button>
          {oneEntity && (
            <>
              <button
                onClick={() => addAttribute(selection.entityIds[0], { name: 'attribute', kind: 'identifier' })}
                className={BTN}
              >
                Add Attribute
              </button>
              <button
                onClick={() => addRelationship({
                  sourceEntityId: selection.entityIds[0],
                  targetEntityId: selection.entityIds[0],
                  sourceEnd: { cardinality: 'one',  optionality: 'optional', label: '', uidBar: false },
                  targetEnd: { cardinality: 'many', optionality: 'optional', label: '', uidBar: false },
                })}
                className={BTN}
              >
                Self-reference
              </button>
            </>
          )}
        </div>
      </Panel>

      {/* ── Right panel: save / load / export ── */}
      <Panel position="top-right">
        <div ref={rightPanelRef} className="flex flex-col gap-1" style={{ width: 'max-content', minWidth: rightMinW }}>
          <button onClick={handleSave}            className={RBTN} style={{ minWidth: rightMinW }}>Save JSON</button>
          <button onClick={handleLoad}            className={RBTN} style={{ minWidth: rightMinW }}>Load JSON</button>
          <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={onFileChange} />
          <button onClick={() => exportImage('png')} className={RBTN} style={{ minWidth: rightMinW }}>Export PNG</button>
          <button onClick={() => exportImage('svg')} className={RBTN} style={{ minWidth: rightMinW }}>Export SVG</button>
          <button onClick={handleExportSQL}       className={RBTN} style={{ minWidth: rightMinW }}>Export SQL</button>
        </div>
      </Panel>

      {sqlText !== null && (
        <SQLExportModal
          sql={sqlText}
          filename={`${diagram.name || 'diagram'}.sql`}
          onClose={() => setSqlText(null)}
        />
      )}
    </>
  )
}
