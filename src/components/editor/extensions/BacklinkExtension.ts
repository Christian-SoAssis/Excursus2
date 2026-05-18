import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { BacklinkChip } from '../../ui/BacklinkChip'

export const BacklinkExtension = Node.create({
  name: 'backlink',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      noteId: { default: null },
      title: { default: '' },
    }
  },

  parseHTML() { return [{ tag: 'span[data-backlink]' }] },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-backlink': '' }, HTMLAttributes), HTMLAttributes.title ?? '']
  },

  addNodeView() {
    return ReactNodeViewRenderer(BacklinkChip)
  },
})
