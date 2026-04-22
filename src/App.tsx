import Canvas from './components/canvas/Canvas'
import PropertyPanel from './components/panels/PropertyPanel'

export default function App() {
  return (
    <div className="flex w-full h-full">
      <div className="flex-1 min-w-0">
        <Canvas />
      </div>
      <PropertyPanel />
    </div>
  )
}
