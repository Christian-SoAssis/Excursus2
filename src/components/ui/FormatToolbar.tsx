import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/core'

const TEXT_COLORS = [
  { value: null,       dot: null,      title: 'Padrão' },
  { value: '#a09898',  dot: '#a09898', title: 'Cinza' },
  { value: '#e07055',  dot: '#e07055', title: 'Terracota' },
  { value: '#d4a03a',  dot: '#d4a03a', title: 'Âmbar' },
  { value: '#7dd3a3',  dot: '#7dd3a3', title: 'Verde' },
  { value: '#c4b6ff',  dot: '#c4b6ff', title: 'Lilás' },
]

const HIGHLIGHT_COLORS = [
  { value: null,                        dot: null,      title: 'Sem fundo' },
  { value: 'rgba(224,112,85,0.28)',     dot: '#e07055', title: 'Terracota' },
  { value: 'rgba(212,160,58,0.28)',     dot: '#d4a03a', title: 'Âmbar' },
  { value: 'rgba(125,211,163,0.28)',    dot: '#7dd3a3', title: 'Verde' },
  { value: 'rgba(196,182,255,0.28)',    dot: '#c4b6ff', title: 'Lilás' },
  { value: 'rgba(255,255,255,0.12)',    dot: '#ccc',    title: 'Branco' },
]

interface Props { editor: Editor | null }

export function FormatToolbar({ editor }: Props) {
  if (!editor) return null

  const md = (e: React.MouseEvent) => e.preventDefault()

  return (
    <BubbleMenu editor={editor}>
      <div className="fmt-bar">
        <button className="fmt-btn fmt-btn--b" data-active={editor.isActive('bold') || undefined}
          title="Negrito (Ctrl+B)" onMouseDown={md}
          onClick={() => editor.chain().focus().toggleBold().run()}>N</button>

        <button className="fmt-btn fmt-btn--i" data-active={editor.isActive('italic') || undefined}
          title="Itálico (Ctrl+I)" onMouseDown={md}
          onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>

        <button className="fmt-btn fmt-btn--u" data-active={editor.isActive('underline') || undefined}
          title="Sublinhado (Ctrl+U)" onMouseDown={md}
          onClick={() => editor.chain().focus().toggleUnderline().run()}>S</button>

        <button className="fmt-btn fmt-btn--s" data-active={editor.isActive('strike') || undefined}
          title="Tachado" onMouseDown={md}
          onClick={() => editor.chain().focus().toggleStrike().run()}>
          <s>T</s>
        </button>

        <div className="fmt-sep" />

        <div className="fmt-group" title="Cor do texto">
          <span className="fmt-group__label">A</span>
          {TEXT_COLORS.map((c, i) => (
            <button key={i} className="fmt-dot" title={c.title}
              data-active={c.value && editor.isActive('textStyle', { color: c.value }) || undefined}
              style={{ background: c.dot ?? 'transparent', border: c.dot ? 'none' : '1px solid var(--border-strong)' }}
              onMouseDown={md}
              onClick={() => {
                if (c.value) editor.chain().focus().setColor(c.value).run()
                else editor.chain().focus().unsetColor().run()
              }}
            />
          ))}
        </div>

        <div className="fmt-sep" />

        <div className="fmt-group" title="Cor do fundo">
          <span className="fmt-group__label">▥</span>
          {HIGHLIGHT_COLORS.map((c, i) => (
            <button key={i} className="fmt-dot" title={c.title}
              data-active={c.value && editor.isActive('highlight', { color: c.value }) || undefined}
              style={{ background: c.dot ?? 'transparent', border: c.dot ? 'none' : '1px solid var(--border-strong)' }}
              onMouseDown={md}
              onClick={() => {
                if (c.value) editor.chain().focus().setHighlight({ color: c.value }).run()
                else editor.chain().focus().unsetHighlight().run()
              }}
            />
          ))}
        </div>
      </div>
    </BubbleMenu>
  )
}
