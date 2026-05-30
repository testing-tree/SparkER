export default function WelcomeModal({ onClose }: { onClose: () => void }) {
  const dismiss = () => {
    localStorage.setItem('sparker_about_seen', '1')
    localStorage.setItem('sparker_privacy_seen', '1')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) dismiss() }}
    >
      <div className="bg-white rounded-lg shadow-xl flex flex-col" style={{ width: 420, maxHeight: '80vh' }}>
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">Welcome to SparkER</p>
            <p className="text-xs text-gray-500 mt-0.5">A Barker notation ER diagram editor</p>
          </div>
          <button onClick={dismiss} className="text-gray-400 hover:text-gray-600 text-xl leading-none cursor-pointer">&times;</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4 text-xs leading-relaxed">
          {/* ── About ── */}
          <div className="space-y-2 text-gray-600">
            <p>SparkER was created by CD at the Ivey Business School.</p>
            <p>Press the <b>?</b> button (bottom-left) anytime for tips. Full documentation is on{' '}
              <a href="https://github.com/testing-tree/SparkER#readme" target="_blank" rel="noopener noreferrer"
                className="underline hover:text-gray-600">GitHub</a>.
            </p>
          </div>

          <hr className="border-gray-200" />

          {/* ── Privacy ── */}
          <div className="space-y-2">
            <p className="font-semibold text-gray-800">Privacy &amp; Data Use</p>
            <ul className="space-y-1.5 text-gray-700">
              <li className="flex gap-2"><span className="text-gray-400 shrink-0">•</span>This tool runs entirely in your browser with no backend server</li>
              <li className="flex gap-2"><span className="text-gray-400 shrink-0">•</span>No data is sent to or stored on any external server</li>
              <li className="flex gap-2"><span className="text-gray-400 shrink-0">•</span>Your work is saved only to files on your own computer</li>
              <li className="flex gap-2"><span className="text-gray-400 shrink-0">•</span>No analytics, cookies, tracking, or third-party services</li>
              <li className="flex gap-2"><span className="text-gray-400 shrink-0">•</span>No outbound network calls (enforced by Content Security Policy)</li>
            </ul>
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 leading-snug">
              <span className="font-medium">Save your work: </span>
              SparkER does not auto-save. Use <span className="font-medium">Save JSON</span> (top right) before closing or refreshing.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-gray-200">
          <button onClick={dismiss}
            className="px-4 py-1.5 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer">
            Get started
          </button>
        </div>
      </div>
    </div>
  )
}
