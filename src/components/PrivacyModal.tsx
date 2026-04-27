import { useEffect } from 'react'

export default function PrivacyModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-lg shadow-xl flex flex-col" style={{ width: 460, maxHeight: '80vh' }}>
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <p className="text-sm font-semibold text-gray-800">Privacy &amp; Data Use</p>
            <p className="text-xs text-gray-500 mt-0.5">Your diagrams never leave your browser.</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none cursor-pointer ml-4 mt-0.5"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-xs text-gray-700 leading-relaxed">
          <ul className="space-y-2">
            <li className="flex gap-2">
              <span className="mt-0.5 text-gray-400 shrink-0">•</span>
              This tool runs entirely in your browser with no backend server
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-gray-400 shrink-0">•</span>
              No data is sent to or stored on any external server
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-gray-400 shrink-0">•</span>
              Your work is saved only to files on your own computer, when you choose to export
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-gray-400 shrink-0">•</span>
              No analytics, cookies, tracking, or third-party services of any kind
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-gray-400 shrink-0">•</span>
              No outbound network calls are made (enforced by Content Security Policy)
            </li>
          </ul>

          <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2.5 text-gray-500 leading-snug">
            <span className="font-medium text-gray-600">Verify it yourself: </span>
            Open browser developer tools (<kbd className="font-mono text-[10px] px-1 py-0.5 bg-white border border-gray-300 rounded">F12</kbd> or <kbd className="font-mono text-[10px] px-1 py-0.5 bg-white border border-gray-300 rounded">Cmd+Option+I</kbd>),
            go to the <span className="font-medium text-gray-600">Network</span> tab, and use the tool normally.
            You will see no external requests.
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            SparkER is fully open source.{' '}
            <a
              href="https://github.com/testing-tree/CD_002fa7"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-600"
            >
              View source on GitHub
            </a>
          </p>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
