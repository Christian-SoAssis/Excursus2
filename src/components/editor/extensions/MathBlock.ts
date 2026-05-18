import { Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { MathBlockView } from '../../ui/MathBlockView'

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return { src: { default: '' } }
  },

  parseHTML() { return [{ tag: 'div[data-math]' }] },

  renderHTML({ HTMLAttributes }) {
    return ['div', { 'data-math': '', ...HTMLAttributes }, HTMLAttributes.src ?? '']
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView)
  },
})
