import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { PdfBlockView } from '../../ui/PdfBlockView'

export const PdfBlock = Node.create({
  name: 'pdfBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src:  { default: '' },
      name: { default: 'documento.pdf' },
    }
  },

  parseHTML() { return [{ tag: 'div[data-pdf]' }] },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-pdf': '' }, HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(PdfBlockView)
  },
})
