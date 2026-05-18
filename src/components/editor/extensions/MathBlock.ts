import { Node } from '@tiptap/core'

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  addAttributes() { return { src: { default: '' } } },
  parseHTML() { return [{ tag: 'div[data-math]' }] },
  renderHTML() { return ['div', { 'data-math': '' }, 0] },
})
