import { useNotesStore } from '../../store/notes'
import { Editor } from '../editor/Editor'
import { Sidebar } from '../Sidebar'

export function FloatingMode() {
  const { notes, activeNoteId } = useNotesStore()
  const note = notes.find(n => n.id === activeNoteId)

  return (
    <div className="floating">
      <Sidebar />
      <div className="floating__doc">
        {note ? (
          <Editor noteId={note.id} />
        ) : (
          <div className="floating__empty">
            <p>Selecione uma nota ou clique em <strong>+ nota</strong></p>
          </div>
        )}
      </div>
    </div>
  )
}
