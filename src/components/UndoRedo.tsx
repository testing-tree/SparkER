import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Panel, useStore, useStoreApi } from '@xyflow/react'
import { useDiagramStore, useUndoRedo } from '../store/diagramStore'
import PrivacyModal from './PrivacyModal'

const BTN = 'w-[82px] px-4 py-1.5 bg-white border border-gray-300 rounded shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 cursor-pointer text-center disabled:opacity-40 disabled:cursor-not-allowed'

export default function UndoRedo() {
  const canUndo = useUndoRedo(s => s.pastStates.length > 0)
  const canRedo = useUndoRedo(s => s.futureStates.length > 0)
  const locked = useStore(s => !(s.nodesDraggable ?? true))
  const api = useStoreApi()
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [attributionEl, setAttributionEl] = useState<Element | null>(null)

  useEffect(() => {
    const el = document.querySelector('.react-flow__attribution')
    if (el) setAttributionEl(el)
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
      <Panel position="bottom-right" style={{ marginBottom: '18px' }}>
        <div className="flex flex-col gap-1">
          <button className={BTN}
            onClick={() => {
              const next = !api.getState().nodesDraggable
              api.setState({ nodesDraggable: next, nodesConnectable: next, elementsSelectable: next })
            }}>
            {locked ? 'Locked' : 'Lock'}
          </button>
          <button className={BTN} disabled={!canUndo}
            onClick={() => useDiagramStore.temporal.getState().undo()}>
            Undo
          </button>
          <button className={BTN} disabled={!canRedo}
            onClick={() => useDiagramStore.temporal.getState().redo()}>
            Redo
          </button>
        </div>
      </Panel>
      {attributionEl && createPortal(
        <>
          <span aria-hidden style={{ color: '#999', fontSize: '10px', userSelect: 'none' }}> · </span>
          <button
            onClick={() => setShowPrivacy(true)}
            style={{ fontSize: '10px', color: '#999', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Privacy
          </button>
        </>,
        attributionEl
      )}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
    </>
  )
}
