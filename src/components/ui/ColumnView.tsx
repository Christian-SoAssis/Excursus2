import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react'

/**
 * NodeView for a single Column node.
 *
 * Shows a delete button (×) on hover when there are ≥ 2 sibling columns.
 * The NodeViewContent area is the fully editable column body.
 */
export function ColumnView({ deleteNode, editor, getPos }: NodeViewProps) {
  /* Only allow deletion when the parent ColumnList still has > 1 column */
  const canDelete = (() => {
    if (!editor || typeof getPos !== 'function') return false
    try {
      const pos = getPos() ?? -1
      if (pos < 0) return false
      const $pos = editor.state.doc.resolve(pos)
      return $pos.parent.childCount > 1
    } catch {
      return false
    }
  })()

  return (
    <NodeViewWrapper className="col">
      {/* Toolbar (delete button) — not editable */}
      <div className="col__toolbar" contentEditable={false}>
        {canDelete && (
          <button
            className="col__del"
            onClick={deleteNode}
            title="Remover coluna"
          >
            ×
          </button>
        )}
      </div>

      {/* Editable column body */}
      <NodeViewContent className="col__content" />
    </NodeViewWrapper>
  )
}
