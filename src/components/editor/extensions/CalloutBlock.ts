import { Node } from '@tiptap/core'

export const CalloutBlock = Node.create({
  name: 'calloutBlock',
  group: 'block',
  content: 'inline*',
  parseHTML() { return [{ tag: 'div[data-callout]' }] },
  renderHTML() { return ['div', { 'data-callout': '' }, 0] },
})
