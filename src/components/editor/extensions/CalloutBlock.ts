import { Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { CalloutBlockView } from '../../ui/CalloutBlockView'

export const CalloutBlock = Node.create({
  name: 'calloutBlock',
  group: 'block',
  content: 'inline*',

  parseHTML() { return [{ tag: 'div[data-callout]' }] },

  renderHTML() { return ['div', { 'data-callout': '' }, 0] },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutBlockView)
  },
})
