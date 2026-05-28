import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react'

/**
 * NodeView for the ColumnList node.
 *
 * Renders:
 *  - NodeViewContent (display:flex) — the actual column nodes live here
 *  - "+" button to append a column (max 4)
 *  - "÷ Sair do layout" button to append a paragraph BELOW the list so
 *    the user can continue writing outside the columns
 */
export function ColumnListView({ node, editor, getPos }: NodeViewProps) {
  const colCount = node.childCount
  const canAdd = colCount < 4

  /* Insert a new empty column at the end of the list */
  const addColumn = () => {
    if (!canAdd || !editor || typeof getPos !== 'function') return
    const pos = getPos() ?? 0
    const { column, paragraph } = editor.schema.nodes
    if (!column || !paragraph) return
    const emptyPara = paragraph.createAndFill()!
    const newCol = column.createAndFill(null, emptyPara)!
    // insertContentAt just before the closing token of the columnList
    editor
      .chain()
      .insertContentAt(pos + node.nodeSize - 1, newCol.toJSON())
      .run()
  }

  /* Append a blank paragraph immediately after the whole column list */
  const addBlockBelow = () => {
    if (!editor || typeof getPos !== 'function') return
    const pos = getPos() ?? 0
    const afterPos = pos + node.nodeSize
    editor
      .chain()
      .insertContentAt(afterPos, { type: 'paragraph' })
      .setTextSelection(afterPos + 1)
      .run()
  }

  return (
    <NodeViewWrapper className="cl-wrap">
      {/* NodeViewContent is the flex row — columns render inside here */}
      <NodeViewContent className="cl-row" />

      {/* Footer controls */}
      <div className="cl-footer" contentEditable={false}>
        {canAdd && (
          <button className="cl-btn" onClick={addColumn} title="Adicionar coluna">
            + coluna
          </button>
        )}
        <button className="cl-btn cl-btn--exit" onClick={addBlockBelow} title="Continuar escrevendo fora das colunas">
          ↓ bloco abaixo
        </button>
        <span className="cl-meta">{colCount} col{colCount > 1 ? 's' : ''}</span>
      </div>
    </NodeViewWrapper>
  )
}
