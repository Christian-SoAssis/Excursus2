import { Node } from '@tiptap/core'

export const BacklinkExtension = Node.create({
  name: 'backlink',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { noteId: { default: null }, title: { default: '' } }
  },
  parseHTML() { return [{ tag: 'span[data-backlink]' }] },
  renderHTML({ HTMLAttributes }) {
    return ['span', { 'data-backlink': '', ...HTMLAttributes }, HTMLAttributes.title ?? '']
  },
})
