import { useEditor, EditorContent, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BacklinkExtension } from './extensions/BacklinkExtension'
import { MathBlock } from './extensions/MathBlock'
import { CalloutBlock } from './extensions/CalloutBlock'
import { useNotesStore } from '../../store/notes'
import { getNoteContent } from '../../lib/db'
import { BacklinkPicker } from '../ui/BacklinkPicker'
import { SlashMenu, type SlashItem } from '../ui/SlashMenu'

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
      {backlinkPos && editor && (
        <BacklinkPicker
          pos={backlinkPos}
          query={backlinkQuery}
          onPick={(note) => {
            const { from } = editor.state.selection
            const deleteFrom = from - backlinkQuery.length - 2
            editor.chain().focus()
              .deleteRange({ from: deleteFrom, to: from })
              .insertContent({ type: 'backlink', attrs: { noteId: note.id, title: note.title } })
              .run()
            setBacklinkPos(null)
          }}
          onClose={() => setBacklinkPos(null)}
        />
      )}
      {slashPos && editor && (
        <SlashMenu
          pos={slashPos}
          query={slashQuery}
          onPick={(item: SlashItem) => {
            const { from } = editor.state.selection
            const deleteFrom = from - slashQuery.length - 1
            const chain = editor.chain().focus().deleteRange({ from: deleteFrom, to: from })
            if      (item.type === 'h1')      chain.setHeading({ level: 1 }).run()
            else if (item.type === 'h2')      chain.setHeading({ level: 2 }).run()
            else if (item.type === 'h3')      chain.setHeading({ level: 3 }).run()
            else if (item.type === 'todo')    chain.toggleTaskItem().run()
            else if (item.type === 'list')    chain.toggleBulletList().run()
            else if (item.type === 'quote')   chain.toggleBlockquote().run()
            else if (item.type === 'code')    chain.toggleCodeBlock().run()
            else if (item.type === 'divider') chain.setHorizontalRule().run()
            else if (item.type === 'math')    chain.insertContent({ type: 'mathBlock', attrs: { src: '' } }).run()
            else if (item.type === 'callout') chain.insertContent({ type: 'calloutBlock' }).run()
            else chain.setParagraph().run()
            setSlashPos(null)
          }}
          onClose={() => setSlashPos(null)}
        />
      )}
    </div>
  )
}
