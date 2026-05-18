import { useEditor, EditorContent, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BacklinkExtension } from './extensions/BacklinkExtension'
import { MathBlock } from './extensions/MathBlock'
import { CalloutBlock } from './extensions/CalloutBlock'
import { useNotesStore } from '../../store/notes'
import { getNoteContent } from '../../lib/db'

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}

interface EditorProps { noteId: string }

export function Editor({ noteId }: EditorProps) {
  const { notes, saveNoteContent, cacheContent, contentCache } = useNotesStore()
  const note = notes.find(n => n.id === noteId)
  const loadedRef = useRef<string | null>(null)

  const [backlinkPos, setBacklinkPos] = useState<{ x: number; y: number } | null>(null)
  const [backlinkQuery, setBacklinkQuery] = useState('')
  const [slashPos, setSlashPos] = useState<{ x: number; y: number } | null>(null)
  const [slashQuery, setSlashQuery] = useState('')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSave = useCallback(
    debounce((content: JSONContent) => {
      if (!note) return
      saveNoteContent(noteId, note.title, note.folder, content)
    }, 800),
    [noteId, note?.title, note?.folder]
  )

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Escreva ou / para comandos' }),
      BacklinkExtension,
      MathBlock,
      CalloutBlock,
    ],
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      cacheContent(noteId, json)
      debouncedSave(json)
      checkPopovers(editor)
    },
  })

  function checkPopovers(ed: ReturnType<typeof useEditor>) {
    if (!ed) return
    const { from } = ed.state.selection
    const before2  = ed.state.doc.textBetween(Math.max(0, from - 2), from)
    const before20 = ed.state.doc.textBetween(Math.max(0, from - 20), from)

    if (before2 === '[[') {
      const coords = ed.view.coordsAtPos(from)
      setBacklinkPos({ x: coords.left, y: coords.bottom + 6 })
      setBacklinkQuery('')
    } else if (backlinkPos) {
      const m = before20.match(/\[\[([^\]]{0,18})$/)
      if (m) setBacklinkQuery(m[1])
      else setBacklinkPos(null)
    }

    const slashM = before20.match(/(^|\s)\/([^\s]*)$/)
    if (slashM) {
      const coords = ed.view.coordsAtPos(from)
      setSlashPos({ x: coords.left, y: coords.bottom + 6 })
      setSlashQuery(slashM[2])
    } else {
      setSlashPos(null)
    }
  }

  useEffect(() => {
    if (!editor || loadedRef.current === noteId) return
    loadedRef.current = noteId
    const cached = contentCache[noteId]
    if (cached) { editor.commands.setContent(cached, false); return }
    getNoteContent(noteId).then(raw => {
      const content: JSONContent = raw
        ? JSON.parse(raw)
        : { type: 'doc', content: [{ type: 'paragraph' }] }
      editor.commands.setContent(content, false)
      cacheContent(noteId, content)
    })
  }, [noteId, editor])

  return (
    <div className="editor-wrap">
      <EditorContent editor={editor} className="doc" />
      {/* BacklinkPicker and SlashMenu added in Tasks 9 and 10 */}
    </div>
  )
}
