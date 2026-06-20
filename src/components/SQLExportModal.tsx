import { useRef } from 'react'

export default function SQLExportModal({
  sql,
  filename,
  onClose,
}: {
  sql: string
  filename: string
  onClose: () => void
}) {
  const taRef = useRef<HTMLTextAreaElement>(null)

  const handleCopy = () => {
    taRef.current?.select()
    document.execCommand('copy')
  }

  const handleDownload = () => {
    const blob = new Blob([sql], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-lg shadow-xl flex flex-col" style={{ width: 640, maxHeight: '80vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-700">SQL DDL Export</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* SQL text */}
        <textarea
          ref={taRef}
          readOnly
          value={sql}
          className="flex-1 font-mono text-xs p-4 resize-none outline-none overflow-auto"
          style={{ minHeight: 300 }}
          onClick={() => taRef.current?.select()}
        />

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-gray-200 justify-end">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-sm font-medium bg-white border border-gray-300 rounded hover:bg-gray-50 cursor-pointer"
          >
            Copy
          </button>
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 text-sm font-medium bg-gray-800 text-white rounded hover:bg-gray-700 cursor-pointer"
          >
            Download .sql
          </button>
        </div>
      </div>
    </div>
  )
}
