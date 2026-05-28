import { useEditor, EditorContent, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import { StorageImage } from './extensions/StorageImage'
import TaskList from '@tiptap/extension-task-list'
import { CustomTaskItem } from './extensions/CustomTaskItem'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { BacklinkExtension } from './extensions/BacklinkExtension'
import { MathBlock } from './extensions/MathBlock'
import { CalloutBlock } from './extensions/CalloutBlock'
import { FocusMode } from './extensions/FocusMode'
import { PdfBlock } from './extensions/PdfBlock'
import { MarkdownShortcuts } from './extensions/MarkdownShortcuts'
import { ToggleBlock } from './extensions/ToggleBlock'
import { ColumnList, Column } from './extensions/ColumnBlock'
import { useNotesStore } from '../../store/notes'
import { useAuthStore } from '../../store/auth'
import { useSuggestionsStore } from '../../store/suggestions'
import { registerEditor } from '../../lib/editorRegistry'
import { getNoteContent } from '../../lib/db'
import { loadNoteContent } from '../../lib/localCache'
import { uploadFile } from '../../lib/storage'
import { BacklinkPicker } from '../ui/BacklinkPicker'
import { SlashMenu, type SlashItem } from '../ui/SlashMenu'
import { FormatToolbar } from '../ui/FormatToolbar'
import { TableToolbar } from './TableToolbar'

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
  const user = useAuthStore(s => s.user)
  const suggestionItems = useSuggestionsStore(s => s.items)
  const loadedRef = useRef<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  // Gate: suggestions only fire after the user has typed something in this document
  const hasInteractedRef = useRef(false)

  const [backlinkPos, setBacklinkPos] = useState<{ x: number; y: number } | null>(null)
  const [backlinkQuery, setBacklinkQuery] = useState('')
  const [slashPos, setSlashPos] = useState<{ x: number; y: number } | null>(null)
  const [slashQuery, setSlashQuery] = useState('')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSave = useCallback(
    debounce((content: JSONContent) => {
      if (!note) return
      saveNoteContent(noteId, note.title, note.folder, content)
      // Only run similarity suggestions after the user has interacted with the document
      if (hasInteractedRef.current) {
        useSuggestionsStore.getState().fetch(noteId, content)
      }
    }, 800),
    [noteId, note?.title, note?.folder]
  )

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Escreva ou / para comandos' }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      StorageImage.configure({ allowBase64: false }),
      TaskList,
      CustomTaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      BacklinkExtension,
      MathBlock,
      CalloutBlock,
      PdfBlock,
      FocusMode,
      MarkdownShortcuts,
      ToggleBlock,
      ColumnList,
      Column,
    ],
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      cacheContent(noteId, json)
      debouncedSave(json)
      checkPopovers(editor)
    },
  })

  // Keep the registry in sync with this editor instance
  useEffect(() => {
    registerEditor(editor)
    return () => { registerEditor(null) }
  }, [editor])

  // Reset interaction flag whenever the user switches to a different note
  useEffect(() => {
    hasInteractedRef.current = false
  }, [noteId])

  // Mark the first user keystroke in this document session
  useEffect(() => {
    const dom = editor?.view.dom
    if (!dom) return
    const onKey = () => { hasInteractedRef.current = true }
    dom.addEventListener('keydown', onKey)
    return () => dom.removeEventListener('keydown', onKey)
  }, [editor])

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

    // Slash menu: only trigger when "/" is the very first character of the block
    const $from = ed.state.doc.resolve(from)
    const blockStart = $from.start($from.depth)
    const textInBlock = ed.state.doc.textBetween(blockStart, from)
    const slashM = textInBlock.match(/^\/([^\s]*)$/)
    if (slashM) {
      const coords = ed.view.coordsAtPos(from)
      setSlashPos({ x: coords.left, y: coords.bottom + 6 })
      setSlashQuery(slashM[1])
    } else {
      setSlashPos(null)
    }
  }

  useEffect(() => {
    if (!editor || loadedRef.current === noteId) return
    loadedRef.current = noteId
    const cached = contentCache[noteId]
    if (cached) { editor.commands.setContent(cached); return }
    getNoteContent(noteId).then(raw => {
      let content: JSONContent
      try {
        content = raw ? JSON.parse(raw) : { type: 'doc', content: [{ type: 'paragraph' }] }
      } catch {
        content = { type: 'doc', content: [{ type: 'paragraph' }] }
      }
      editor.commands.setContent(content)
      cacheContent(noteId, content)
    }).catch(() => {
      const cachedRaw = loadNoteContent(noteId)
      let content: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }
      if (cachedRaw) {
        try { content = JSON.parse(cachedRaw) } catch {}
      }
      editor.commands.setContent(content)
      cacheContent(noteId, content)
    })
  }, [noteId, editor])

  // ── Drag & drop ──────────────────────────────────────────────────
  const [dragging, setDragging] = useState(false)

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    if (!user || !editor) return
    const files = Array.from(e.dataTransfer.files)
    for (const file of files) {
      try {
        const { url, path } = await uploadFile(user.id, file)
        if (file.type.startsWith('image/')) {
          editor.chain().focus().insertContent({ type: 'image', attrs: { src: url, alt: file.name, path } }).run()
        } else if (file.type === 'application/pdf') {
          editor.chain().focus().insertContent({ type: 'pdfBlock', attrs: { src: url, name: file.name, path } }).run()
        }
      } catch {
        toast.error(`Erro ao fazer upload de ${file.name}`)
      }
    }
  }

  return (
    <div
      className={`editor-wrap${dragging ? ' editor-wrap--dragging' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false) }}
      onDrop={handleDrop}
    >
      {dragging && <div className="editor-drop-overlay">Solte para inserir</div>}
      <FormatToolbar editor={editor} noteId={noteId} />
      <TableToolbar editor={editor} />
      <EditorContent editor={editor} className="doc" />

      <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={async e => {
          const file = e.target.files?.[0]
          if (!file || !user) return
          try {
            const { url, path } = await uploadFile(user.id, file)
            editor?.chain().focus().insertContent({ type: 'image', attrs: { src: url, alt: file.name, path } }).run()
          } catch { window.alert('Erro ao fazer upload da imagem.') }
          e.target.value = ''
        }}
      />

      <input ref={pdfInputRef} type="file" accept=".pdf" style={{ display: 'none' }}
        onChange={async e => {
          const file = e.target.files?.[0]
          if (!file || !user) return
          try {
            const { url, path } = await uploadFile(user.id, file)
            editor?.chain().focus().insertContent({ type: 'pdfBlock', attrs: { src: url, name: file.name, path } }).run()
          } catch { window.alert('Erro ao fazer upload do PDF.') }
          e.target.value = ''
        }}
      />
      {backlinkPos && editor && (
        <BacklinkPicker
          pos={backlinkPos}
          query={backlinkQuery}
          suggestions={suggestionItems.slice(0, 3)}
          onPick={(note) => {
            const { from } = editor.state.selection
            const deleteFrom = from - backlinkQuery.length - 2
            editor.chain().focus()
              .deleteRange({ from: deleteFrom, to: from })
              .insertContent({ type: 'backlink', attrs: { noteId: note.id, title: note.title } })
              .run()
            // Suppress this note from suggestions until 50 more words are written
            const wc = editor.state.doc.textContent.trim().split(/\s+/).filter(Boolean).length
            useSuggestionsStore.getState().markLinked(note.id, wc)
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

            if      (item.type === 'h1')        chain.setHeading({ level: 1 }).run()
            else if (item.type === 'h2')        chain.setHeading({ level: 2 }).run()
            else if (item.type === 'h3')        chain.setHeading({ level: 3 }).run()
            else if (item.type === 'todo')      chain.toggleTaskList().run()
            else if (item.type === 'list')      chain.toggleBulletList().run()
            else if (item.type === 'quote')     chain.toggleBlockquote().run()
            else if (item.type === 'code')      chain.toggleCodeBlock().run()
            else if (item.type === 'divider')   chain.setHorizontalRule().run()
            else if (item.type === 'math')      chain.insertContent({ type: 'mathBlock', attrs: { src: '' } }).run()
            else if (item.type === 'callout')   chain.insertContent({ type: 'calloutBlock' }).run()
            else if (item.type === 'toggle') {
              // insertContent can't reliably place block-with-block-content nodes.
              // Use a raw transaction instead — tr.selection reflects state AFTER
              // the preceding deleteRange step in the same chain.
              chain.command(({ tr, state }) => {
                const { $from } = tr.selection
                const depth = Math.max(1, $from.depth)
                const node  = state.schema.nodes.toggleBlock?.createAndFill({ open: true, title: '' })
                if (!node) return false
                tr.replaceWith($from.before(depth), $from.after(depth), node)
                return true
              }).run()
            }
            else if (item.type === 'table')     chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            else if (item.type === 'image') {
              chain.run()
              imageInputRef.current?.click()
            } else if (item.type === 'image-url') {
              chain.run()                                            // deleta o "/..." primeiro
              const url = window.prompt('URL da imagem:')
              if (url) editor.chain().focus().setImage({ src: url }).run()
            } else if (item.type === 'pdf') {
              chain.run()
              pdfInputRef.current?.click()
            } else if (item.type === 'pdf-url') {
              chain.run()
              const url = window.prompt('URL do PDF:')
              if (url) {
                const name = url.split('/').pop() ?? 'documento.pdf'
                editor.chain().focus().insertContent({ type: 'pdfBlock', attrs: { src: url, name } }).run()
              }
            } else if (item.type === '2col' || item.type === '3col') {
              const colCount = item.type === '2col' ? 2 : 3
              chain.command(({ tr, state }) => {
                const { $from } = tr.selection
                const depth = Math.max(1, $from.depth)
                const { paragraph, column, columnList } = state.schema.nodes
                if (!paragraph || !column || !columnList) return false
                const emptyPara = paragraph.createAndFill()!
                const cols = Array.from({ length: colCount }, () =>
                  column.createAndFill(null, emptyPara)!
                )
                const list = columnList.create(null, cols)
                tr.replaceWith($from.before(depth), $from.after(depth), list)
                return true
              }).run()
            } else {
              chain.setParagraph().run()
            }

            setSlashPos(null)
          }}
          onClose={() => setSlashPos(null)}
        />
      )}
    </div>
  )
}
