import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { AppBar } from './components/AppBar'
import { FloatingMode } from './components/modes/FloatingMode'
import { SpatialMode } from './components/modes/SpatialMode'
import { GraphMode } from './components/modes/GraphMode'
import { useUIStore } from './store/ui'
import { useNotesStore } from './store/notes'

export function App() {
  const { mode, theme, fontScale, showHandles } = useUIStore()
  const loadNotes = useNotesStore(s => s.loadNotes)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.style.setProperty('font-size', `${fontScale * 16}px`)
  }, [fontScale])

  useEffect(() => {
    document.documentElement.style.setProperty('--handle-display', showHandles ? 'flex' : 'none')
  }, [showHandles])

  useEffect(() => { loadNotes() }, [])

  const renderMode = () => {
    if (mode === 'spatial') return <SpatialMode />
    if (mode === 'graph') return <GraphMode />
    return <FloatingMode />
  }

  return (
    <>
      <AppBar />
      <main className="stage">{renderMode()}</main>
      <Toaster position="bottom-right" />
    </>
  )
}
