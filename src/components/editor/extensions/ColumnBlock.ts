/**
 * ColumnBlock — two TipTap nodes for multi-column layouts.
 *
 *  ColumnList  group:'block'   content:'column+'
 *    Column    (no group)      content:'block+'   isolating:true
 *
 * The user creates them via the slash menu (/2 colunas, /3 colunas).
 * Each Column accepts any block: paragraphs, headings, PDFs, images, etc.
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ColumnListView } from '../../ui/ColumnListView'
import { ColumnView } from '../../ui/ColumnView'

/* ── ColumnList ─────────────────────────────────────────────────────── */
export const ColumnList = Node.create({
  name: 'columnList',
  group: 'block',
  content: 'column+',
  isolating: false,

  parseHTML() {
    return [{ tag: 'div[data-type="columnList"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'columnList' }, HTMLAttributes), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ColumnListView)
  },
})

/* ── Column ─────────────────────────────────────────────────────────── */
export const Column = Node.create({
  name: 'column',
  group: '',       // only valid inside a ColumnList
  content: 'block+',
  isolating: true, // keeps cursor & selection inside the column

  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'column' }, HTMLAttributes), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ColumnView)
  },
})
