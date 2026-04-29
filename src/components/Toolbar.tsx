import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Panel, useReactFlow, getNodesBounds, getViewportForBounds } from '@xyflow/react'
import { toPng, toSvg } from 'html-to-image'
import { useDiagramStore } from '../store/diagramStore'
import { toSQL } from '../lib/export/toSQL'
import SQLExportModal from './SQLExportModal'

const BTN  = 'w-[118px] px-3 py-1.5 bg-white border border-gray-300 rounded shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 cursor-pointer text-left'
const RBTN = 'w-full px-4 py-1.5 bg-white border border-gray-300 rounded shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 cursor-pointer text-left'

const PADDING = 40

export default function Toolbar() {
  const { getNodes, fitView } = useReactFlow()
  const diagram        = useDiagramStore(s => s.diagram)
  const selection      = useDiagramStore(s => s.selection)
  const addEntity      = useDiagramStore(s => s.addEntity)
  const addAttribute   = useDiagramStore(s => s.addAttribute)
  const setDiagramName = useDiagramStore(s => s.setDiagramName)
  const saveToJSON     = useDiagramStore(s => s.saveToJSON)
  const loadFromJSON   = useDiagramStore(s => s.loadFromJSON)

  const [nameVal, setNameVal]     = useState(diagram.name)
  const [sqlText, setSqlText]     = useState<string | null>(null)
  const [inputPx, setInputPx]     = useState(0)
  const [rightMinW, setRightMinW] = useState<number | undefined>(undefined)
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const nameSpanRef   = useRef<HTMLSpanElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!rightPanelRef.current) return
    const btns = rightPanelRef.current.querySelectorAll<HTMLElement>('button')
    let max = 0
    btns.forEach(btn => { if (btn.offsetWidth > max) max = btn.offsetWidth })
    if (max > 0) setRightMinW(max)
  }, [])

  useEffect(() => { setNameVal(diagram.name) }, [diagram.name])

  // Pixel-accurate input width: measure a hidden twin span after every value change
  useEffect(() => {
    if (nameSpanRef.current) setInputPx(nameSpanRef.current.offsetWidth + 2) // +2 for borders
  }, [nameVal])

  const commitName = () => setDiagramName(nameVal.trim() || 'Untitled Diagram')

  // ── Canvas actions ───────────────────────────────────────────
  const handleAddEntity = useCallback(() => {
    const count = diagram.entities.length
    addEntity({
      name: 'ENTITY',
      attributes: [],
      position: { x: 80 + (count % 4) * 220, y: 80 + Math.floor(count / 4) * 180 },
    })
    setTimeout(() => fitView({ padding: 0.15, duration: 200 }), 50)
  }, [diagram.entities.length, addEntity, fitView])

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

  const oneEntity      = selection.entityIds.length === 1
  const selectedEntity = oneEntity
    ? diagram.entities.find(e => e.id === selection.entityIds[0])
    : undefined

  return (
    <>
      {/* ── Left panel: canvas-level actions only ── */}
      <Panel position="top-left">
        <div className="flex flex-col gap-1 w-fit">
          {/* Hidden span used to measure exact pixel width of the input text */}
          <span
            ref={nameSpanRef}
            aria-hidden
            className="text-sm font-medium absolute invisible whitespace-pre pointer-events-none px-3"
          >
            {nameVal || 'Untitled Diagram'}
          </span>
          <input
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onBlur={commitName}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitName() } }}
            placeholder="Untitled Diagram"
            className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded bg-white outline-none focus:border-gray-500"
            style={{ color: '#002FA7', width: inputPx > 0 ? inputPx : undefined }}
          />
          <button onClick={handleAddEntity} className={BTN}>Add Entity</button>
          {oneEntity && (
            <button
              onClick={() => {
                const kind = (selectedEntity?.attributes.length ?? 0) === 0 ? 'identifier' : 'required'
                addAttribute(selection.entityIds[0], { name: 'attribute', kind })
                setTimeout(() => fitView({ padding: 0.15, duration: 200 }), 50)
              }}
              className={BTN}
            >
              Add Attribute
            </button>
          )}
        </div>
      </Panel>

      {/* ── Right panel: save / load / export ── */}
      <Panel position="top-right">
        <div ref={rightPanelRef} className="flex flex-col gap-1" style={{ width: 'max-content', minWidth: rightMinW }}>
          <button onClick={handleSave}               className={RBTN} style={{ minWidth: rightMinW }}>Save JSON</button>
          <button onClick={handleLoad}               className={RBTN} style={{ minWidth: rightMinW }}>Load JSON</button>
          <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={onFileChange} />
          <button onClick={() => exportImage('png')} className={RBTN} style={{ minWidth: rightMinW }}>Export PNG</button>
          <button onClick={() => exportImage('svg')} className={RBTN} style={{ minWidth: rightMinW }}>Export SVG</button>
          <button onClick={handleExportSQL}          className={RBTN} style={{ minWidth: rightMinW }}>Export SQL</button>
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
