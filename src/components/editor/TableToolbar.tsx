import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/core'

interface Props { editor: Editor | null }

export function TableToolbar({ editor }: Props) {
  if (!editor) return null

  const run = (cmd: () => boolean) => (e: React.MouseEvent) => { e.preventDefault(); cmd() }
  const c = () => editor.chain().focus()

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: ed }) => ed.isActive('tableCell') || ed.isActive('tableHeader')}
      options={{ placement: 'bottom', offset: 6 }}
    >
      <div className="tbl-bar">
        <button className="tbl-bar__btn" onMouseDown={run(() => c().addRowBefore().run())} title="Linha acima">↑ linha</button>
        <button className="tbl-bar__btn" onMouseDown={run(() => c().addRowAfter().run())} title="Linha abaixo">↓ linha</button>
        <button className="tbl-bar__btn" onMouseDown={run(() => c().deleteRow().run())} title="Excluir linha">− linha</button>
        <div className="tbl-bar__sep" />
        <button className="tbl-bar__btn" onMouseDown={run(() => c().addColumnBefore().run())} title="Coluna antes">← col</button>
        <button className="tbl-bar__btn" onMouseDown={run(() => c().addColumnAfter().run())} title="Coluna depois">→ col</button>
        <button className="tbl-bar__btn" onMouseDown={run(() => c().deleteColumn().run())} title="Excluir coluna">− col</button>
        <div className="tbl-bar__sep" />
        <button className="tbl-bar__btn" onMouseDown={run(() => c().toggleHeaderRow().run())} title="Alternar cabeçalho">cab.</button>
        <button className="tbl-bar__btn tbl-bar__btn--del" onMouseDown={run(() => c().deleteTable().run())} title="Excluir tabela">✕ tabela</button>
      </div>
    </BubbleMenu>
  )
}
