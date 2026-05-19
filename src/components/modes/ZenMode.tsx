import { useNotesStore } from '../../store/notes'
import { Editor } from '../editor/Editor'

export function ZenMode() {
  const { notes, activeNoteId, setActiveNote } = useNotesStore()
  const note = notes.find(n => n.id === activeNoteId) ?? notes[0] ?? null

  if (!note) return (
    <div className="zen">
      <div className="zen__empty">
        <div className="zen__empty-title">Nenhuma nota</div>
        <div className="zen__empty-hint">Crie uma nota em Floating para escrever aqui</div>
      </div>
    </div>
  )

  return (
    <div className="zen">
      <div className="zen__body">
        <Editor noteId={note.id} />
      </div>

      <div className="zen__footer">
        {notes.length > 1 && (
          <div className="zen__switcher">
            {notes.map(n => (
              <button key={n.id}
                className={`zen__switcher-dot ${n.id === note.id ? 'zen__switcher-dot--active' : ''}`}
                onClick={() => setActiveNote(n.id)}
                title={n.title}/>
            ))}
          </div>
        )}
        <span className="zen__note-title">{note.title}</span>
        <span className="zen__sep">·</span>
        <span className="zen__wc">{note.wordCount} palavras</span>
      </div>
    </div>
  )
}
