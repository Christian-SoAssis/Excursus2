import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { MathBlockView } from '../../ui/MathBlockView'

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: {
        default: '',
        // Keep src out of HTMLAttributes so it never leaks as a raw attribute
        renderHTML: () => ({}),
        // Support both new (data-src) and old (src) HTML for backward compat
        parseHTML: el => el.getAttribute('data-src') ?? el.getAttribute('src') ?? '',
      },
    }
  },

  parseHTML() { return [{ tag: 'div[data-math]' }] },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-math': '', 'data-src': node.attrs.src ?? '' }, HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView)
  },
})
