import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Panel } from '@xyflow/react'
import { useDiagramStore, useUndoRedo } from '../store/diagramStore'
import PrivacyModal from './PrivacyModal'

const BTN = 'w-full px-4 py-1.5 bg-white border border-gray-300 rounded shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 cursor-pointer text-left disabled:opacity-40 disabled:cursor-not-allowed'

export default function UndoRedo() {
  const canUndo = useUndoRedo(s => s.pastStates.length > 0)
  const canRedo = useUndoRedo(s => s.futureStates.length > 0)
  const selection = useDiagramStore(s => s.selection)
  const [minW, setMinW]             = useState<number | undefined>(undefined)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const panelRef                    = useRef<HTMLDivElement>(null)

  const hasSelection = selection.entityIds.length > 0
    || selection.relationshipIds.length > 0
    || (selection.arcIds?.length ?? 0) > 0

  useLayoutEffect(() => {
    if (!panelRef.current) return
    const btns = panelRef.current.querySelectorAll<HTMLElement>('button')
    let max = 0
    btns.forEach(btn => { if (btn.offsetWidth > max) max = btn.offsetWidth })
    if (max > 0) setMinW(max)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useDiagramStore.temporal.getState().undo()
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault()
        useDiagramStore.temporal.getState().redo()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      <Panel position="bottom-right" style={{ marginBottom: '3rem' }}>
        <div ref={panelRef} className="flex flex-col gap-1" style={{ width: 'max-content', minWidth: minW }}>
          <button className={BTN} style={{ minWidth: minW }} disabled={!canUndo}
            onClick={() => useDiagramStore.temporal.getState().undo()}>
            Undo
          </button>
          <button className={BTN} style={{ minWidth: minW }} disabled={!canRedo}
            onClick={() => useDiagramStore.temporal.getState().redo()}>
            Redo
          </button>
          {!hasSelection && (
            <button
              onClick={() => setShowPrivacy(true)}
              className="px-4 py-1 text-xs text-gray-400 hover:text-gray-600 cursor-pointer text-left"
            >
              Privacy
            </button>
          )}
        </div>
      </Panel>
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
    </>
  )
}
